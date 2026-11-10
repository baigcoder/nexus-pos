BEGIN;

SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.order_creation_receipts (
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    request_key uuid NOT NULL,
    request_hash bytea NOT NULL,
    result jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (restaurant_id, request_key)
);

ALTER TABLE public.order_creation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_creation_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.order_creation_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.create_checkout_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_restaurant_id uuid := (p_payload->>'restaurant_id')::uuid;
    v_key uuid := (p_payload->>'client_order_id')::uuid;
    v_hash bytea := sha256(convert_to((p_payload - 'client_order_id' - 'delivery_fee')::text, 'UTF8'));
    v_receipt public.order_creation_receipts%ROWTYPE;
    v_result jsonb;
    v_item jsonb;
    v_choice jsonb;
    v_options jsonb;
    v_option jsonb;
    v_normalized jsonb := '[]';
    v_modifiers jsonb;
    v_seen text[];
    v_option_id text;
    v_fee_text text;
    v_delivery_fee numeric := 0;
BEGIN
    IF v_key IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(v_restaurant_id::text || ':' || v_key::text, 0));

        SELECT * INTO v_receipt FROM public.order_creation_receipts
        WHERE restaurant_id = v_restaurant_id AND request_key = v_key;

        IF FOUND THEN
            IF v_receipt.request_hash IS DISTINCT FROM v_hash THEN
                RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Order request key already used for different details');
            END IF;
            RETURN v_receipt.result || jsonb_build_object(
                'idempotent_replay', true,
                'credential_issued_at', EXTRACT(EPOCH FROM v_receipt.created_at)::bigint
            );
        END IF;
    END IF;

    IF p_payload->>'source' = 'qr_menu' AND p_payload->>'table_id' IS NOT NULL THEN
        PERFORM id FROM public.tables WHERE id = (p_payload->>'table_id')::uuid
          AND restaurant_id = v_restaurant_id AND is_qr_active IS DISTINCT FROM false
        FOR UPDATE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Table is unavailable for QR orders');
        END IF;
    END IF;

    IF p_payload->>'order_type' = 'delivery' THEN
        SELECT settings->>'delivery_fee' INTO v_fee_text FROM public.restaurants WHERE id = v_restaurant_id;
        IF v_fee_text IS NOT NULL THEN
            IF v_fee_text !~ '^[0-9]{1,7}(\.[0-9]{1,2})?$' THEN
                RETURN jsonb_build_object('success', false, 'error', 'Restaurant delivery fee is invalid');
            END IF;
            v_delivery_fee := v_fee_text::numeric;
        END IF;
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items')
    LOOP
        v_modifiers := '[]';
        v_seen := ARRAY[]::text[];

        IF jsonb_typeof(v_item->'modifiers') = 'array' AND jsonb_array_length(v_item->'modifiers') > 0 THEN
            SELECT customizations INTO v_options FROM public.menu_items
            WHERE id = (v_item->>'menu_item_id')::uuid AND restaurant_id = v_restaurant_id
            FOR SHARE;

            FOR v_choice IN SELECT value FROM jsonb_array_elements(v_item->'modifiers')
            LOOP
                v_option_id := v_choice->>'modifier_option_id';
                IF v_option_id IS NULL OR v_option_id = ANY(v_seen) THEN
                    RETURN jsonb_build_object('success', false, 'error', 'Choose distinct catalog modifiers');
                END IF;
                v_seen := array_append(v_seen, v_option_id);

                SELECT opt.value INTO v_option
                FROM jsonb_array_elements(COALESCE(v_options, '[]')) AS grp(value)
                CROSS JOIN LATERAL jsonb_array_elements(grp.value->'options') AS opt(value)
                WHERE opt.value->>'id' = v_option_id;

                IF NOT FOUND OR jsonb_typeof(v_option->'price_modifier') IS DISTINCT FROM 'number'
                   OR (v_option->>'price_modifier')::numeric < 0 THEN
                    RETURN jsonb_build_object('success', false, 'error', 'Modifier is unavailable for this menu item');
                END IF;

                v_modifiers := v_modifiers || jsonb_build_array(jsonb_build_object(
                    'name', v_option->>'name', 'price_modifier', (v_option->>'price_modifier')::numeric,
                    'modifier_option_id', CASE WHEN v_option_id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
                        THEN v_option_id ELSE NULL END
                ));
            END LOOP;

            IF EXISTS (
                SELECT 1 FROM jsonb_array_elements(COALESCE(v_options, '[]')) AS grp(value)
                WHERE grp.value->>'type' = 'single' AND (
                    SELECT count(*) FROM jsonb_array_elements(grp.value->'options') AS opt(value)
                    WHERE opt.value->>'id' = ANY(v_seen)
                ) > 1
            ) THEN
                RETURN jsonb_build_object('success', false, 'error', 'Choose only one option for each single-choice modifier');
            END IF;
        END IF;

        v_normalized := v_normalized || jsonb_build_array(v_item || jsonb_build_object('modifiers', v_modifiers));
    END LOOP;

    -- The installed routine may return an error after making writes.
    -- Roll back that subtransaction while preserving its business response.
    BEGIN
        v_result := public.create_order_atomic(
            p_payload || jsonb_build_object('items', v_normalized, 'delivery_fee', v_delivery_fee)
        );
        IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
            RAISE EXCEPTION USING ERRCODE = 'PZ023', MESSAGE = 'Checkout rejected';
        END IF;
    EXCEPTION WHEN SQLSTATE 'PZ023' THEN
        RETURN COALESCE(v_result, jsonb_build_object('success', false, 'error', 'Checkout rejected'));
    END;

    -- An older order can exist without a receipt. Its legacy replay does not
    -- prove that the supplied payload belongs to its original customer.
    IF COALESCE((v_result->>'idempotent_replay')::boolean, false) THEN
        RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Order request key is already in use');
    END IF;

    IF p_payload->>'customer_count' IS NOT NULL AND p_payload->>'table_id' IS NOT NULL THEN
        UPDATE public.tables SET customer_count = (p_payload->>'customer_count')::integer
        WHERE id = (p_payload->>'table_id')::uuid AND restaurant_id = v_restaurant_id;
    END IF;

    IF v_key IS NOT NULL THEN
        INSERT INTO public.order_creation_receipts (restaurant_id, request_key, request_hash, result)
        VALUES (v_restaurant_id, v_key, v_hash, v_result)
        RETURNING * INTO v_receipt;
        v_result := v_result || jsonb_build_object(
            'credential_issued_at', EXTRACT(EPOCH FROM v_receipt.created_at)::bigint
        );
    END IF;

    RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_checkout_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
