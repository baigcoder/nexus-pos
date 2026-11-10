-- Disposable staging only. Use an available table and an available menu item in one restaurant.
-- psql -v restaurant_id=... -v table_id=... -v menu_item_id=... -f tests/backend/atomic-checkout-requests.sql
\set ON_ERROR_STOP on
BEGIN;

SELECT set_config('test.restaurant_id', :'restaurant_id', true),
       set_config('test.table_id', :'table_id', true),
       set_config('test.menu_item_id', :'menu_item_id', true);

DO $$
DECLARE
    restaurant uuid := current_setting('test.restaurant_id')::uuid;
    dining_table uuid := current_setting('test.table_id')::uuid;
    menu_item uuid := current_setting('test.menu_item_id')::uuid;
    request_key uuid := gen_random_uuid();
    request_payload jsonb;
    first_result jsonb;
    result jsonb;
    orders_before bigint;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.tables WHERE id = dining_table AND restaurant_id = restaurant AND status = 'available'
    ) THEN RAISE EXCEPTION 'Use an available table in the selected restaurant'; END IF;

    IF has_function_privilege('anon', 'public.create_checkout_order(jsonb)', 'EXECUTE')
       OR has_table_privilege('authenticated', 'public.order_creation_receipts', 'SELECT') THEN
        RAISE EXCEPTION 'Checkout internals are exposed';
    END IF;

    SELECT count(*) INTO orders_before FROM public.orders WHERE restaurant_id = restaurant;

    request_payload := jsonb_build_object(
        'restaurant_id', restaurant, 'table_id', dining_table, 'order_type', 'dine_in',
        'client_order_id', request_key, 'items', jsonb_build_array(jsonb_build_object(
            'menu_item_id', gen_random_uuid(), 'quantity', 1
        ))
    );
    result := public.create_checkout_order(request_payload);
    IF result->>'success' IS DISTINCT FROM 'false'
       OR NOT EXISTS (SELECT 1 FROM public.tables WHERE id = dining_table AND status = 'available') THEN
        RAISE EXCEPTION 'Invalid checkout changed the table: %', result;
    END IF;

    request_payload := jsonb_set(request_payload, '{items,0,menu_item_id}', to_jsonb(menu_item));
    first_result := public.create_checkout_order(request_payload);
    IF first_result->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Order creation failed: %', first_result; END IF;

    result := public.create_checkout_order(request_payload);
    IF result->>'order_id' IS DISTINCT FROM first_result->>'order_id'
       OR result->>'credential_issued_at' IS DISTINCT FROM first_result->>'credential_issued_at'
       OR result->>'idempotent_replay' IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Retry did not return the original order: %', result;
    END IF;

    result := public.create_checkout_order(jsonb_set(request_payload, '{items,0,quantity}', '2'));
    IF result->>'code' IS DISTINCT FROM 'conflict'
       OR (SELECT count(*) FROM public.orders WHERE restaurant_id = restaurant) <> orders_before + 1 THEN
        RAISE EXCEPTION 'Changed checkout payload created a second order: %', result;
    END IF;
END;
$$;

ROLLBACK;
