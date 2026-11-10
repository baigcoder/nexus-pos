BEGIN;

SET LOCAL lock_timeout = '10s';

ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS qr_order_version uuid NOT NULL DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION public.rotate_changed_table_qr()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    IF OLD.is_qr_active IS DISTINCT FROM NEW.is_qr_active
       OR OLD.table_number IS DISTINCT FROM NEW.table_number
       OR OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id THEN
        NEW.qr_order_version := gen_random_uuid();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rotate_changed_table_qr ON public.tables;
CREATE TRIGGER rotate_changed_table_qr BEFORE UPDATE ON public.tables
FOR EACH ROW EXECUTE FUNCTION public.rotate_changed_table_qr();
REVOKE EXECUTE ON FUNCTION public.rotate_changed_table_qr() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_verified_checkout_order(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
    v_restaurant_id uuid := (p_payload->>'restaurant_id')::uuid;
    v_key uuid := (p_payload->>'client_order_id')::uuid;
BEGIN
    IF p_payload->>'source' = 'qr_menu' THEN
        -- Match the order receipt lock order, then hold the table through creation.
        IF v_key IS NOT NULL THEN
            PERFORM pg_advisory_xact_lock(hashtextextended(v_restaurant_id::text || ':' || v_key::text, 0));
        END IF;
        PERFORM id FROM public.tables
        WHERE id = (p_payload->>'table_id')::uuid AND restaurant_id = v_restaurant_id
          AND is_qr_active IS DISTINCT FROM false
          AND qr_order_version = (p_payload->>'qr_order_version')::uuid
        FOR UPDATE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'error', 'Scan the current QR code for this table');
        END IF;
    END IF;

    RETURN public.create_checkout_order(p_payload - 'qr_order_version');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_verified_checkout_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_verified_checkout_order(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
