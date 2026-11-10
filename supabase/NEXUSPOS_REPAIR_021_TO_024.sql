-- NexusPOS staging repair for missing migrations 021 through 024.
-- Keeps migrations 025 and 026 in place. Run the entire file together.
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';

DO $preflight$
BEGIN
    IF to_regprocedure('public.create_order_atomic(jsonb)') IS NULL
       OR to_regprocedure('public.settle_restaurant_order_payment(jsonb)') IS NULL
       OR to_regprocedure('public.complete_delivery_with_cash(uuid,uuid,uuid,boolean,numeric)') IS NULL
       OR to_regclass('public.restaurant_events') IS NULL
       OR to_regclass('public.delivery_assignments') IS NULL THEN
        RAISE EXCEPTION 'NexusPOS foundation through migration 020 is required';
    END IF;
END;
$preflight$;

-- 021_protect_operational_endpoints.sql
SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.ai_action_proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    skill_name varchar(64) NOT NULL,
    proposal_type varchar(64) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
    confidence_score numeric(4,3) NOT NULL,
    reasoning text NOT NULL,
    proposed_payload jsonb NOT NULL DEFAULT '{}',
    reviewed_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_proposals_status
    ON public.ai_action_proposals(restaurant_id, status, created_at DESC);

ALTER TABLE public.ai_action_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_action_proposals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_action_proposals TO service_role;

ALTER TABLE public.restaurant_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.restaurant_events TO service_role;

DO $$
DECLARE
    event_sequence regclass := pg_get_serial_sequence('public.restaurant_events', 'id')::regclass;
BEGIN
    IF event_sequence IS NOT NULL THEN
        EXECUTE format('GRANT USAGE ON SEQUENCE %s TO service_role', event_sequence);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_ai_proposal(
    p_restaurant_id uuid, p_staff_id uuid, p_proposal_id uuid, p_action text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    proposal public.ai_action_proposals%ROWTYPE;
    category jsonb;
    v_category_id uuid;
    next_status text;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.staff WHERE id = p_staff_id AND restaurant_id = p_restaurant_id
          AND is_active AND role IN ('owner', 'manager')
    ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'error', 'Review access denied');
    END IF;

    SELECT * INTO proposal FROM public.ai_action_proposals
    WHERE id = p_proposal_id AND restaurant_id = p_restaurant_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_found', 'error', 'Proposal not found');
    END IF;
    IF proposal.status IS DISTINCT FROM 'pending' THEN
        RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Proposal has already been reviewed');
    END IF;

    IF p_action = 'reject' THEN
        next_status := 'rejected';
    ELSIF p_action = 'approve' THEN
        next_status := 'executed';
        CASE proposal.proposal_type
            WHEN 'auto_86_item' THEN
                UPDATE public.menu_items SET is_available = false
                WHERE restaurant_id = p_restaurant_id
                  AND id::text IN (
                    SELECT value FROM jsonb_array_elements_text(proposal.proposed_payload->'items_to_auto_86')
                  );
            WHEN 'bulk_menu_import' THEN
                FOR category IN SELECT value FROM jsonb_array_elements(proposal.proposed_payload->'categories')
                LOOP
                    INSERT INTO public.categories (restaurant_id, name, description, is_active)
                    VALUES (p_restaurant_id, category->>'name', category->>'description', true)
                    RETURNING id INTO v_category_id;

                    INSERT INTO public.menu_items (restaurant_id, category_id, name, description,
                                                   price, cost_price, preparation_time, is_available, customizations)
                    SELECT p_restaurant_id, v_category_id, item.name, item.description, item.price,
                           COALESCE(item.cost_price, 0), COALESCE(item.preparation_time, 15),
                           true, COALESCE(item.customizations, '[]')
                    FROM jsonb_to_recordset(category->'items') AS item(
                        name text, description text, price numeric, cost_price numeric,
                        preparation_time integer, customizations jsonb
                    );
                END LOOP;
            WHEN 'pacing_throttle', 'flag_cashier_discrepancy' THEN
                next_status := 'approved';
            ELSE
                RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Unsupported proposal type');
        END CASE;
    ELSE
        RETURN jsonb_build_object('success', false, 'code', 'invalid', 'error', 'Invalid review action');
    END IF;

    UPDATE public.ai_action_proposals
    SET status = next_status, reviewed_by = p_staff_id, reviewed_at = now()
    WHERE id = p_proposal_id AND restaurant_id = p_restaurant_id
    RETURNING * INTO proposal;

    INSERT INTO public.restaurant_events (restaurant_id, aggregate_type, aggregate_id, event_type, payload)
    VALUES (p_restaurant_id, 'AI_PROPOSAL', p_proposal_id, 'AI_PROPOSAL_' || upper(next_status),
            jsonb_build_object('proposal_id', p_proposal_id, 'proposal_type', proposal.proposal_type,
                               'skill_name', proposal.skill_name, 'reviewed_by', p_staff_id,
                               'status', next_status));

    RETURN jsonb_build_object('success', true, 'proposal', to_jsonb(proposal));
END;
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_restaurant_template(
    p_restaurant_id uuid, p_staff_id uuid, p_archetype text, p_currency text,
    p_tax_rate numeric, p_template jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    prior jsonb;
    category jsonb;
    v_category_id uuid;
    tables_added integer;
    categories_added integer := 0;
    items_added integer := 0;
    registers_added integer;
    rows_added integer;
    stats jsonb;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.staff s JOIN public.restaurants r ON r.id = s.restaurant_id
        WHERE s.id = p_staff_id AND s.restaurant_id = p_restaurant_id
          AND s.is_active AND s.role = 'owner' AND s.user_id = r.owner_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'error', 'Restaurant owner access required');
    END IF;

    PERFORM id FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_found', 'error', 'Restaurant not found');
    END IF;

    SELECT payload INTO prior FROM public.restaurant_events
    WHERE restaurant_id = p_restaurant_id AND aggregate_type = 'RESTAURANT'
      AND aggregate_id = p_restaurant_id AND event_type = 'RESTAURANT_BOOTSTRAPPED'
    ORDER BY id DESC LIMIT 1;

    IF FOUND THEN
        IF prior->>'archetype' IS DISTINCT FROM p_archetype
           OR prior->>'currency' IS DISTINCT FROM p_currency
           OR (prior->>'tax_rate')::numeric IS DISTINCT FROM p_tax_rate THEN
            RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Restaurant setup already completed');
        END IF;
        RETURN jsonb_build_object('success', true, 'stats', prior - 'staff_id');
    END IF;

    UPDATE public.restaurants SET currency = p_currency, tax_rate = p_tax_rate WHERE id = p_restaurant_id;

    INSERT INTO public.tables (restaurant_id, table_number, capacity, status, version, is_qr_active)
    SELECT p_restaurant_id, t.table_number, t.capacity, 'available', 1, true
    FROM jsonb_to_recordset(p_template->'tables') AS t(table_number text, capacity integer)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.tables existing WHERE existing.restaurant_id = p_restaurant_id
          AND existing.table_number = t.table_number
    );
    GET DIAGNOSTICS tables_added = ROW_COUNT;

    FOR category IN SELECT value FROM jsonb_array_elements(p_template->'categories')
    LOOP
        SELECT id INTO v_category_id FROM public.categories
        WHERE restaurant_id = p_restaurant_id AND name = category->>'name'
        ORDER BY id LIMIT 1;

        IF NOT FOUND THEN
            INSERT INTO public.categories (restaurant_id, name, description, display_order, is_active)
            VALUES (p_restaurant_id, category->>'name', category->>'description',
                    (category->>'display_order')::integer, true)
            RETURNING id INTO v_category_id;
            categories_added := categories_added + 1;
        END IF;

        INSERT INTO public.menu_items (restaurant_id, category_id, name, description, price, cost_price,
                                       preparation_time, is_available, customizations)
        SELECT p_restaurant_id, v_category_id, item.name, item.description, item.price, item.cost_price,
               item.preparation_time, true, COALESCE(item.customizations, '[]')
        FROM jsonb_to_recordset(category->'items') AS item(
            name text, description text, price numeric, cost_price numeric,
            preparation_time integer, customizations jsonb
        )
        WHERE NOT EXISTS (
            SELECT 1 FROM public.menu_items existing WHERE existing.restaurant_id = p_restaurant_id
              AND existing.category_id = v_category_id AND existing.name = item.name
        );
        GET DIAGNOSTICS rows_added = ROW_COUNT;
        items_added := items_added + rows_added;
    END LOOP;

    INSERT INTO public.cash_registers (restaurant_id, name, is_active)
    SELECT p_restaurant_id, entry.value, true FROM jsonb_array_elements_text(p_template->'registers') entry
    WHERE NOT EXISTS (
        SELECT 1 FROM public.cash_registers existing
        WHERE existing.restaurant_id = p_restaurant_id AND existing.name = entry.value
    );
    GET DIAGNOSTICS registers_added = ROW_COUNT;

    stats := jsonb_build_object('archetype', p_archetype, 'currency', p_currency, 'tax_rate', p_tax_rate,
                                'tables_created', tables_added, 'categories_created', categories_added,
                                'items_created', items_added, 'registers_created', registers_added);
    INSERT INTO public.restaurant_events (restaurant_id, aggregate_type, aggregate_id, event_type, payload)
    VALUES (p_restaurant_id, 'RESTAURANT', p_restaurant_id, 'RESTAURANT_BOOTSTRAPPED',
            stats || jsonb_build_object('staff_id', p_staff_id));

    RETURN jsonb_build_object('success', true, 'stats', stats);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_ai_proposal(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_ai_proposal(uuid, uuid, uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.bootstrap_restaurant_template(uuid, uuid, text, text, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_restaurant_template(uuid, uuid, text, text, numeric, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

-- 022_signup_verification.sql
CREATE OR REPLACE FUNCTION public.find_signup_user_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT u.id
    FROM auth.users u
    WHERE u.email = p_email AND u.deleted_at IS NULL
      AND COALESCE(u.is_sso_user, false) = false
    ORDER BY u.created_at
    LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.find_signup_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_signup_user_by_email(text) TO service_role;

NOTIFY pgrst, 'reload schema';

-- 023_atomic_checkout_requests.sql
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

-- 024_unify_legacy_delivery.sql
SET LOCAL lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.report_delivery_exception(
    p_restaurant_id uuid, p_assignment_id uuid, p_staff_id uuid, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_assignment public.delivery_assignments%ROWTYPE;
    v_role text;
    v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
    IF v_reason IS NULL OR length(v_reason) > 500 THEN
        RETURN jsonb_build_object('success', false, 'code', 'invalid', 'error', 'A delivery exception reason is required');
    END IF;

    SELECT role INTO v_role FROM public.staff
    WHERE id = p_staff_id AND restaurant_id = p_restaurant_id AND is_active;
    IF NOT FOUND OR v_role NOT IN ('owner', 'manager', 'rider', 'delivery') THEN
        RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'error', 'Delivery access denied');
    END IF;

    SELECT * INTO v_assignment FROM public.delivery_assignments
    WHERE id = p_assignment_id AND restaurant_id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND OR (v_role IN ('rider', 'delivery') AND v_assignment.rider_id IS DISTINCT FROM p_staff_id) THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_found', 'error', 'Delivery assignment not found');
    END IF;

    IF v_assignment.status = 'dispatch_exception' AND v_assignment.cancel_reason = v_reason THEN
        RETURN jsonb_build_object('success', true, 'status', 'dispatch_exception');
    END IF;
    IF v_assignment.status NOT IN ('assigned', 'ready_pickup', 'picked_up', 'en_route', 'arrived') THEN
        RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Delivery is not active');
    END IF;

    UPDATE public.delivery_assignments
    SET status = 'dispatch_exception', cancel_reason = v_reason, updated_at = now()
    WHERE id = p_assignment_id;

    INSERT INTO public.restaurant_events (restaurant_id, aggregate_type, aggregate_id, event_type, payload)
    VALUES (p_restaurant_id, 'DELIVERY', p_assignment_id, 'DELIVERY_EXCEPTION_REPORTED',
            jsonb_build_object('order_id', v_assignment.order_id, 'staff_id', p_staff_id, 'reason', v_reason));

    RETURN jsonb_build_object('success', true, 'status', 'dispatch_exception');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_delivery_exception(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_delivery_exception(uuid, uuid, uuid, text) TO service_role;

DO $$
BEGIN
    IF to_regclass('public.delivery_tracking') IS NULL THEN RETURN; END IF;

    -- Keep legacy history, migrate only orders with no existing canonical assignment.
    LOCK TABLE public.delivery_tracking IN SHARE MODE;
    LOCK TABLE public.delivery_assignments IN SHARE ROW EXCLUSIVE MODE;

    INSERT INTO public.delivery_assignments (
        order_id, restaurant_id, rider_id, customer_name, customer_phone, delivery_address,
        delivery_lat, delivery_lng, status, actual_pickup_time, actual_delivery_time,
        estimated_minutes, actual_minutes, distance_km, customer_feedback, rating, created_at
    )
    SELECT DISTINCT ON (dt.order_id)
        dt.order_id, dt.restaurant_id, rider.id, COALESCE(o.customer_name, 'Customer'), o.customer_phone,
        COALESCE(dt.delivery_address, o.delivery_address, 'Address not recorded'),
        dt.customer_lat, dt.customer_lng,
        CASE
            WHEN o.status = 'cancelled' THEN 'cancelled'
            WHEN dt.status = 'delivered' THEN 'delivered'
            WHEN dt.status = 'failed' THEN 'dispatch_exception'
            WHEN dt.status IN ('picked_up', 'in_transit') AND rider.id IS NULL THEN 'dispatch_exception'
            WHEN dt.status = 'picked_up' THEN 'picked_up'
            WHEN dt.status = 'in_transit' THEN 'en_route'
            WHEN rider.id IS NOT NULL THEN 'assigned'
            ELSE 'pending_dispatch'
        END,
        dt.pickup_time, dt.delivery_time, COALESCE(dt.estimated_minutes, 30),
        COALESCE(dt.actual_minutes, 0), dt.distance_km, dt.customer_feedback, dt.rating,
        COALESCE(dt.created_at, now())
    FROM public.delivery_tracking dt
    JOIN public.orders o ON o.id = dt.order_id AND o.restaurant_id = dt.restaurant_id
    LEFT JOIN public.staff rider ON rider.id = dt.rider_id AND rider.restaurant_id = dt.restaurant_id
        AND rider.is_active AND rider.role IN ('rider', 'delivery')
    WHERE o.order_type = 'delivery' AND NOT EXISTS (
        SELECT 1 FROM public.delivery_assignments da WHERE da.order_id = dt.order_id
    )
    ORDER BY dt.order_id, dt.created_at DESC NULLS LAST, dt.id DESC;

    REVOKE ALL ON public.delivery_tracking FROM PUBLIC, anon, authenticated;
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.delivery_tracking FROM service_role;
END;
$$;

NOTIFY pgrst, 'reload schema';

DO $verify$
BEGIN
    IF to_regprocedure('public.bootstrap_restaurant_template(uuid,uuid,text,text,numeric,jsonb)') IS NULL
       OR to_regprocedure('public.review_ai_proposal(uuid,uuid,uuid,text)') IS NULL
       OR to_regprocedure('public.find_signup_user_by_email(text)') IS NULL
       OR to_regprocedure('public.create_checkout_order(jsonb)') IS NULL
       OR to_regprocedure('public.report_delivery_exception(uuid,uuid,uuid,text)') IS NULL THEN
        RAISE EXCEPTION 'One or more repaired NexusPOS functions are still missing';
    END IF;
END;
$verify$;

COMMIT;
