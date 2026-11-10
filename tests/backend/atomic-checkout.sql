-- Run on disposable staging after migration 018.
-- psql -v order_id=... -v cashier_id=... -v other_restaurant_id=... -f tests/backend/atomic-checkout.sql
\set ON_ERROR_STOP on
BEGIN;

SELECT set_config('test.order_id', :'order_id', true),
       set_config('test.cashier_id', :'cashier_id', true),
       set_config('test.other_restaurant_id', :'other_restaurant_id', true);

DO $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_other uuid := current_setting('test.other_restaurant_id')::uuid;
    v_cashier uuid := current_setting('test.cashier_id')::uuid;
    v_key uuid := gen_random_uuid();
    v_payload jsonb;
    v_first jsonb;
    v_result jsonb;
    v_payments bigint;
    v_kitchen_events bigint;
BEGIN
    SELECT * INTO STRICT v_order FROM public.orders WHERE id = current_setting('test.order_id')::uuid;
    IF v_order.status <> 'pending' OR COALESCE(v_order.amount_paid, 0) <> 0
       OR v_order.total < 1 OR v_other = v_order.restaurant_id THEN
        RAISE EXCEPTION 'Expected a fresh pending order with a positive balance and a different restaurant';
    END IF;

    IF has_function_privilege('anon', 'public.transition_kitchen_order(uuid,uuid,text,uuid)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.settle_restaurant_order_payment(jsonb)', 'EXECUTE')
       OR has_table_privilege('authenticated', 'public.payments', 'INSERT') THEN
        RAISE EXCEPTION 'Browser database role can bypass server commands';
    END IF;

    SELECT count(*) INTO v_kitchen_events FROM public.restaurant_events
    WHERE aggregate_id = v_order.id AND event_type = 'KITCHEN_ORDER_STATUS_UPDATED';

    v_result := public.transition_kitchen_order(v_other, v_order.id, 'preparing', v_cashier);
    IF v_result->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'Cross-tenant kitchen access'; END IF;
    v_result := public.transition_kitchen_order(v_order.restaurant_id, v_order.id, 'ready', v_cashier);
    IF v_result->>'code' IS DISTINCT FROM 'conflict' THEN RAISE EXCEPTION 'Skipped kitchen stage'; END IF;
    v_result := public.transition_kitchen_order(v_order.restaurant_id, v_order.id, 'preparing', v_cashier);
    IF v_result->>'status' IS DISTINCT FROM 'preparing' THEN RAISE EXCEPTION 'Kitchen start failed: %', v_result; END IF;
    v_result := public.transition_kitchen_order(v_order.restaurant_id, v_order.id, 'preparing', v_cashier);
    IF v_result->>'status' IS DISTINCT FROM 'preparing' OR (
        SELECT count(*) FROM public.restaurant_events
        WHERE aggregate_id = v_order.id AND event_type = 'KITCHEN_ORDER_STATUS_UPDATED'
    ) <> v_kitchen_events + 1 THEN RAISE EXCEPTION 'Kitchen retry duplicated a transition'; END IF;

    v_result := public.transition_kitchen_order(v_order.restaurant_id, v_order.id, 'ready', v_cashier);
    IF v_result->>'status' IS DISTINCT FROM 'ready' THEN RAISE EXCEPTION 'Kitchen ready failed: %', v_result; END IF;

    SELECT count(*) INTO v_payments FROM public.payments WHERE order_id = v_order.id;
    v_payload := jsonb_build_object(
        'restaurant_id', v_order.restaurant_id, 'order_id', v_order.id,
        'staff_id', v_cashier, 'payment_method', 'card', 'request_key', v_key,
        'discount', 0.10
    );

    v_result := public.settle_restaurant_order_payment(v_payload || jsonb_build_object('restaurant_id', v_other));
    IF v_result->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'Cross-tenant payment access'; END IF;
    v_result := public.settle_restaurant_order_payment(v_payload || '{"amount":-1}');
    IF v_result->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Negative payment accepted'; END IF;

    v_first := public.settle_restaurant_order_payment(v_payload);
    IF v_first->>'status' IS DISTINCT FROM 'paid'
       OR (v_first->>'amount_paid')::numeric IS DISTINCT FROM (v_order.total - 0.10) THEN
        RAISE EXCEPTION 'Discounted payment failed: %', v_first;
    END IF;

    v_result := public.settle_restaurant_order_payment(v_payload);
    IF v_first IS DISTINCT FROM v_result THEN RAISE EXCEPTION 'Payment retry changed the result'; END IF;
    v_result := public.settle_restaurant_order_payment(v_payload || '{"payment_method":"mobile"}');
    IF v_result->>'code' IS DISTINCT FROM 'conflict' THEN RAISE EXCEPTION 'Key reuse with a new tender was accepted'; END IF;

    IF (SELECT count(*) FROM public.payments WHERE order_id = v_order.id) <> v_payments + 1 THEN
        RAISE EXCEPTION 'Settlement must produce exactly one payment row';
    END IF;
END;
$$;

ROLLBACK;
