-- Disposable staging after 026. Use an available table and menu item in one restaurant.
-- psql -v table_id=... -v menu_item_id=... -f tests/backend/table-qr.sql
\set ON_ERROR_STOP on
BEGIN;

SELECT set_config('test.table_id', :'table_id', true),
       set_config('test.menu_item_id', :'menu_item_id', true);

DO $$
DECLARE
    table_row public.tables%ROWTYPE;
    next_version uuid;
    payload jsonb;
    result jsonb;
BEGIN
    SELECT * INTO STRICT table_row FROM public.tables
    WHERE id = current_setting('test.table_id')::uuid;

    IF table_row.is_qr_active IS FALSE OR table_row.status <> 'available' THEN
        RAISE EXCEPTION 'Use an available table with QR ordering enabled';
    END IF;
    IF has_function_privilege('anon', 'public.create_verified_checkout_order(jsonb)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Browser can bypass table credential validation';
    END IF;

    payload := jsonb_build_object(
        'restaurant_id', table_row.restaurant_id, 'table_id', table_row.id,
        'order_type', 'dine_in', 'source', 'qr_menu', 'client_order_id', gen_random_uuid(),
        'items', jsonb_build_array(jsonb_build_object(
            'menu_item_id', current_setting('test.menu_item_id')::uuid, 'quantity', 1
        ))
    );

    result := public.create_verified_checkout_order(payload);
    IF result->>'code' IS DISTINCT FROM 'forbidden' THEN RAISE EXCEPTION 'Missing QR accepted'; END IF;

    UPDATE public.tables SET is_qr_active = false WHERE id = table_row.id;
    UPDATE public.tables SET is_qr_active = true WHERE id = table_row.id RETURNING qr_order_version INTO next_version;
    IF next_version = table_row.qr_order_version THEN RAISE EXCEPTION 'Disable/enable did not rotate QR'; END IF;

    result := public.create_verified_checkout_order(payload || jsonb_build_object('qr_order_version', table_row.qr_order_version));
    IF result->>'code' IS DISTINCT FROM 'forbidden' THEN RAISE EXCEPTION 'Revoked QR accepted'; END IF;

    result := public.create_verified_checkout_order(payload || jsonb_build_object('qr_order_version', next_version));
    IF result->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Current QR failed: %', result; END IF;
END;
$$;

ROLLBACK;
