-- Use disposable staging and a picked-up COD assignment with a positive unpaid balance.
-- psql -v assignment_id=... -v cashier_id=... -f tests/backend/cash-on-delivery.sql
\set ON_ERROR_STOP on
BEGIN;

SELECT set_config('test.assignment_id', :'assignment_id', true),
       set_config('test.cashier_id', :'cashier_id', true);

DO $$
DECLARE
    v_assignment public.delivery_assignments%ROWTYPE;
    v_order public.orders%ROWTYPE;
    v_cashier uuid := current_setting('test.cashier_id')::uuid;
    v_due numeric;
    v_payment_count bigint;
    v_result jsonb;
BEGIN
    SELECT * INTO STRICT v_assignment FROM public.delivery_assignments
    WHERE id = current_setting('test.assignment_id')::uuid;
    SELECT * INTO STRICT v_order FROM public.orders WHERE id = v_assignment.order_id;
    v_due := v_order.total - COALESCE(v_order.amount_paid, 0);

    IF v_assignment.status NOT IN ('picked_up', 'en_route', 'arrived')
       OR v_assignment.rider_id IS NULL OR v_order.payment_method IS DISTINCT FROM 'cash_on_delivery'
       OR v_order.status NOT IN ('ready', 'served') OR v_due <= 0 THEN
        RAISE EXCEPTION 'Expected an in-transit COD order with a positive balance';
    END IF;

    SELECT count(*) INTO v_payment_count FROM public.payments WHERE order_id = v_order.id;

    v_result := public.complete_delivery_with_cash(v_order.restaurant_id, v_assignment.id, v_assignment.rider_id, false, v_due + 1);
    IF v_result->>'code' IS DISTINCT FROM 'conflict' THEN RAISE EXCEPTION 'Wrong cash amount accepted'; END IF;

    v_result := public.complete_delivery_with_cash(v_order.restaurant_id, v_assignment.id, v_assignment.rider_id, false, v_due);
    IF v_result->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Cash collection failed: %', v_result; END IF;

    v_result := public.complete_delivery_with_cash(v_order.restaurant_id, v_assignment.id, v_assignment.rider_id, false, v_due);
    IF v_result->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Cash collection retry failed: %', v_result; END IF;

    IF EXISTS (SELECT 1 FROM public.orders WHERE id = v_order.id AND status = 'paid')
       OR (SELECT count(*) FROM public.payments WHERE order_id = v_order.id) <> v_payment_count THEN
        RAISE EXCEPTION 'Rider collection prematurely posted a payment';
    END IF;

    BEGIN
        UPDATE public.orders SET status = 'paid' WHERE id = v_order.id;
        RAISE EXCEPTION 'Direct COD settlement was accepted';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;

    v_result := public.reconcile_delivery_cash(v_order.restaurant_id, v_assignment.id, v_assignment.rider_id);
    IF v_result->>'code' IS DISTINCT FROM 'forbidden' THEN RAISE EXCEPTION 'Rider could reconcile their own handoff'; END IF;

    v_result := public.reconcile_delivery_cash(v_order.restaurant_id, v_assignment.id, v_cashier);
    IF v_result->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Cash reconciliation failed: %', v_result; END IF;

    v_result := public.reconcile_delivery_cash(v_order.restaurant_id, v_assignment.id, v_cashier);
    IF v_result->>'success' IS DISTINCT FROM 'true'
       OR (SELECT count(*) FROM public.payments WHERE order_id = v_order.id) <> v_payment_count + 1
       OR NOT EXISTS (SELECT 1 FROM public.orders WHERE id = v_order.id AND status = 'paid') THEN
        RAISE EXCEPTION 'Cash handoff must settle the order and record exactly one payment';
    END IF;
END;
$$;

ROLLBACK;
