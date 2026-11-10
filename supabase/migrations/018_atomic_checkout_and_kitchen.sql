BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_command_receipts (
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    request_key uuid NOT NULL,
    request_payload jsonb NOT NULL,
    result jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (order_id, request_key)
);

ALTER TABLE public.payment_command_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_command_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.payment_command_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.settle_restaurant_order_payment(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_receipt public.payment_command_receipts%ROWTYPE;
    v_table public.tables%ROWTYPE;
    v_key uuid := (p_payload->>'request_key')::uuid;
    v_request jsonb := p_payload - 'request_key';
    v_method text := p_payload->>'payment_method';
    v_discount numeric := COALESCE((p_payload->>'discount')::numeric, 0);
    v_tip numeric := COALESCE((p_payload->>'tip')::numeric, 0);
    v_cash numeric := (p_payload->>'cash_received')::numeric;
    v_amount numeric;
    v_balance numeric;
    v_result jsonb;
    v_splits jsonb := p_payload->'split_payments';
    v_split_total numeric;
    v_split_valid boolean;
    v_split_cash numeric;
    v_split_card numeric;
    v_split_mobile numeric;
BEGIN
    SELECT * INTO v_order FROM public.orders
    WHERE id = (p_payload->>'order_id')::uuid
      AND restaurant_id = (p_payload->>'restaurant_id')::uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found', 'code', 'not_found');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.staff
        WHERE id = (p_payload->>'staff_id')::uuid AND restaurant_id = v_order.restaurant_id
          AND is_active AND role IN ('owner', 'manager', 'cashier')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'An active cashier or manager profile is required');
    END IF;

    SELECT * INTO v_receipt FROM public.payment_command_receipts
    WHERE order_id = v_order.id AND request_key = v_key;

    IF FOUND THEN
        IF v_receipt.request_payload <> v_request THEN
            RETURN jsonb_build_object('success', false, 'error', 'Payment request key was already used', 'code', 'conflict');
        END IF;
        RETURN v_receipt.result;
    END IF;

    IF v_order.status NOT IN ('ready', 'served') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only ready or served orders can be settled', 'code', 'conflict');
    END IF;

    IF v_method IS NULL OR v_method NOT IN ('cash', 'card', 'mobile', 'split') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid payment method');
    END IF;

    v_balance := GREATEST(0, v_order.total - COALESCE(v_order.amount_paid, 0));
    v_amount := COALESCE((p_payload->>'amount')::numeric, v_balance - v_discount);

    IF v_tip <> 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Record tips through the separate tips workflow');
    END IF;

    IF v_discount < 0 OR v_discount > v_balance OR v_discount <> round(v_discount, 2)
       OR v_amount < 0 OR v_amount > v_balance - v_discount OR v_amount <> round(v_amount, 2)
       OR (v_amount = 0 AND v_balance > v_discount)
       OR (v_cash IS NOT NULL AND (v_cash < 0 OR v_cash <> round(v_cash, 2)))
       OR (v_method = 'cash' AND v_cash IS NOT NULL AND v_cash < v_amount) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid payment amount, discount, or cash received');
    END IF;

    -- The legacy settlement routine uses a one-cent tolerance. Do not let it
    -- close an order with a cent still due.
    IF v_balance - v_discount - v_amount = 0.01 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment would leave a one-cent balance');
    END IF;

    IF v_key IS NULL AND v_amount < v_balance - v_discount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Idempotency-Key is required for partial payments');
    END IF;

    IF v_method = 'split' THEN
        IF jsonb_typeof(v_splits) IS DISTINCT FROM 'array' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Split payments are required');
        END IF;

        SELECT SUM(amount),
               bool_and(amount IS NOT NULL AND amount > 0 AND amount = round(amount, 2)
                        AND COALESCE(method IN ('cash', 'card', 'mobile'), false)),
               COALESCE(SUM(amount) FILTER (WHERE method = 'cash'), 0),
               COALESCE(SUM(amount) FILTER (WHERE method = 'card'), 0),
               COALESCE(SUM(amount) FILTER (WHERE method = 'mobile'), 0)
        INTO v_split_total, v_split_valid, v_split_cash, v_split_card, v_split_mobile
        FROM jsonb_to_recordset(v_splits) AS tender(amount numeric, method text);

        IF v_split_valid IS DISTINCT FROM true OR v_split_total IS DISTINCT FROM v_amount THEN
            RETURN jsonb_build_object('success', false, 'error', 'Split tenders must add up to the payment amount');
        END IF;
    ELSIF COALESCE((p_payload->>'is_split')::boolean, false) OR v_splits IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Use the split method for split tenders');
    END IF;

    IF v_order.table_id IS NOT NULL THEN
        SELECT * INTO v_table FROM public.tables
        WHERE id = v_order.table_id AND restaurant_id = v_order.restaurant_id
        FOR UPDATE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Order table not found');
        END IF;
    END IF;

    v_result := public.settle_order_payment_atomic(
        v_request || jsonb_build_object('amount', v_amount, 'is_split', v_method = 'split',
                                         'cash_received', COALESCE(v_cash, v_amount))
    );
    IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
        RETURN v_result;
    END IF;

    IF v_discount > 0 THEN
        UPDATE public.orders SET total = v_order.total - v_discount WHERE id = v_order.id;
    END IF;

    IF v_table.id IS NOT NULL AND (v_result->>'table_released')::boolean AND EXISTS (
        SELECT 1 FROM public.orders
        WHERE table_id = v_table.id AND restaurant_id = v_order.restaurant_id
          AND id <> v_order.id AND status NOT IN ('paid', 'cancelled')
    ) THEN
        UPDATE public.tables
        SET status = CASE WHEN v_table.status = 'billing' THEN 'billing' ELSE 'occupied' END,
            current_waiter_id = v_table.current_waiter_id,
            customer_count = v_table.customer_count,
            occupied_at = COALESCE(v_table.occupied_at, now())
        WHERE id = v_table.id;
        v_result := v_result || jsonb_build_object('table_released', false);
    END IF;

    -- Keep the existing reports and cashier payment history on the same ledger.
    IF v_method = 'split' THEN
        INSERT INTO public.payments (order_id, amount, method, status)
        SELECT v_order.id, tender.amount, tender.method, 'completed'
        FROM jsonb_to_recordset(v_splits) AS tender(amount numeric, method text);

        UPDATE public.register_shifts
        SET total_sales_cash = total_sales_cash + v_split_cash,
            total_sales_card = total_sales_card + v_split_card,
            total_sales_mobile = total_sales_mobile + v_split_mobile,
            updated_at = now()
        WHERE id = (
            SELECT id FROM public.register_shifts
            WHERE restaurant_id = v_order.restaurant_id AND staff_id = (p_payload->>'staff_id')::uuid
              AND status = 'open'
            ORDER BY opened_at DESC LIMIT 1
        );
    ELSE
        INSERT INTO public.payments (order_id, amount, method, status)
        VALUES (v_order.id, v_amount, v_method, 'completed');
    END IF;

    IF v_key IS NOT NULL THEN
        INSERT INTO public.payment_command_receipts (order_id, request_key, request_payload, result)
        VALUES (v_order.id, v_key, v_request, v_result);
    END IF;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_kitchen_order(
    p_restaurant_id uuid, p_order_id uuid, p_target text, p_staff_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_expected text;
    v_item_state text;
BEGIN
    SELECT * INTO v_order FROM public.orders
    WHERE id = p_order_id AND restaurant_id = p_restaurant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found', 'code', 'not_found');
    END IF;

    v_expected := CASE p_target WHEN 'preparing' THEN 'pending' WHEN 'ready' THEN 'preparing'
                                WHEN 'served' THEN 'ready' END;
    IF v_expected IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid kitchen status');
    END IF;
    IF v_order.status = p_target THEN
        RETURN jsonb_build_object('success', true, 'status', p_target);
    END IF;
    IF v_order.status IS DISTINCT FROM v_expected THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order has moved to another stage', 'code', 'conflict');
    END IF;

    v_item_state := CASE p_target WHEN 'preparing' THEN 'cooking' WHEN 'ready' THEN 'plated' ELSE 'served' END;
    UPDATE public.order_items
    SET status = p_target, kitchen_status = v_item_state
    WHERE order_id = p_order_id AND kitchen_status IS DISTINCT FROM 'voided'
      AND CASE p_target
          WHEN 'preparing' THEN status = 'pending'
          WHEN 'ready' THEN status IN ('pending', 'preparing')
          ELSE status IN ('pending', 'preparing', 'ready')
      END;

    UPDATE public.kitchen_order_queue
    SET status = p_target,
        assigned_to = CASE WHEN p_target = 'preparing' THEN COALESCE((
            SELECT id FROM public.staff WHERE id = p_staff_id AND restaurant_id = p_restaurant_id
        ), assigned_to) ELSE assigned_to END,
        started_at = CASE WHEN p_target = 'preparing' THEN COALESCE(started_at, now()) ELSE started_at END,
        ready_at = CASE WHEN p_target = 'ready' THEN now() ELSE ready_at END,
        served_at = CASE WHEN p_target = 'served' THEN now() ELSE served_at END,
        actual_prep_time_seconds = CASE WHEN p_target = 'ready' AND started_at IS NOT NULL
            THEN GREATEST(0, EXTRACT(EPOCH FROM now() - started_at)::integer) ELSE actual_prep_time_seconds END
    WHERE restaurant_id = p_restaurant_id AND order_id = p_order_id;

    UPDATE public.orders SET status = p_target, updated_at = now() WHERE id = p_order_id;

    INSERT INTO public.restaurant_events (restaurant_id, aggregate_type, aggregate_id, event_type, payload)
    VALUES (p_restaurant_id, 'ORDER', p_order_id, 'KITCHEN_ORDER_STATUS_UPDATED',
            jsonb_build_object('order_id', p_order_id, 'previous_status', v_expected,
                               'status', p_target, 'staff_id', p_staff_id));

    IF v_order.staff_id IS NOT NULL AND p_target IN ('preparing', 'ready') THEN
        INSERT INTO public.staff_alerts (restaurant_id, to_staff_id, alert_type, title, message, priority)
        VALUES (p_restaurant_id, v_order.staff_id,
                CASE WHEN p_target = 'ready' THEN 'order_ready' ELSE 'kitchen_update' END,
                CASE WHEN p_target = 'ready' THEN 'Order Ready!' ELSE 'Order Started' END,
                'Order #' || v_order.order_number || ' is ' || p_target,
                CASE WHEN p_target = 'ready' THEN 'high' ELSE 'low' END);
    END IF;

    RETURN jsonb_build_object('success', true, 'status', p_target);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transition_kitchen_order(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_kitchen_order(uuid, uuid, text, uuid) TO service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.payments FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_order_payment_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    IF current_user NOT IN ('anon', 'authenticated') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'paid' OR COALESCE(NEW.payment_status, 'unpaid') <> 'unpaid'
           OR COALESCE(NEW.amount_paid, 0) <> 0 OR NEW.paid_at IS NOT NULL THEN
            RAISE EXCEPTION 'Payment state must be recorded through settlement' USING ERRCODE = '42501';
        END IF;
    ELSIF (NEW.status IS DISTINCT FROM OLD.status AND (NEW.status = 'paid' OR OLD.status = 'paid'))
          OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
          OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
          OR NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
        RAISE EXCEPTION 'Payment state must be recorded through settlement' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_order_payment_state ON public.orders;
CREATE TRIGGER protect_order_payment_state
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.protect_order_payment_state();

CREATE OR REPLACE FUNCTION public.transition_delivery_assignment(
    p_restaurant_id uuid, p_assignment_id uuid, p_target text, p_staff_id uuid, p_can_manage boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_assignment public.delivery_assignments%ROWTYPE;
BEGIN
    SELECT * INTO v_assignment FROM public.delivery_assignments
    WHERE id = p_assignment_id AND restaurant_id = p_restaurant_id
    FOR UPDATE;

    IF NOT FOUND OR (NOT COALESCE(p_can_manage, false) AND v_assignment.rider_id IS DISTINCT FROM p_staff_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Delivery assignment not found', 'code', 'not_found');
    END IF;

    IF v_assignment.status = p_target THEN
        RETURN jsonb_build_object('success', true, 'status', p_target);
    END IF;

    IF NOT COALESCE(CASE p_target
        WHEN 'assigned' THEN p_can_manage AND v_assignment.status = 'pending_dispatch' AND v_assignment.rider_id IS NOT NULL
        WHEN 'picked_up' THEN v_assignment.status IN ('assigned', 'ready_pickup') AND v_assignment.rider_id IS NOT NULL
            AND EXISTS (SELECT 1 FROM public.orders
                        WHERE id = v_assignment.order_id AND restaurant_id = p_restaurant_id
                          AND status IN ('ready', 'served', 'paid'))
        WHEN 'en_route' THEN v_assignment.status = 'picked_up'
        WHEN 'arrived' THEN v_assignment.status IN ('picked_up', 'en_route')
        WHEN 'delivered' THEN v_assignment.status IN ('picked_up', 'en_route', 'arrived')
    END, false) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Delivery is at a different stage', 'code', 'conflict');
    END IF;

    UPDATE public.delivery_assignments
    SET status = p_target,
        actual_pickup_time = CASE WHEN p_target = 'picked_up' THEN COALESCE(actual_pickup_time, now()) ELSE actual_pickup_time END,
        actual_delivery_time = CASE WHEN p_target = 'delivered' THEN now() ELSE actual_delivery_time END,
        updated_at = now()
    WHERE id = p_assignment_id;

    IF p_target = 'delivered' THEN
        UPDATE public.orders SET status = 'served', updated_at = now()
        WHERE id = v_assignment.order_id AND restaurant_id = p_restaurant_id
          AND status IN ('pending', 'preparing', 'ready');
    END IF;

    INSERT INTO public.restaurant_events (restaurant_id, aggregate_type, aggregate_id, event_type, payload)
    VALUES (p_restaurant_id, 'DELIVERY', p_assignment_id, 'DELIVERY_STATUS_UPDATED',
            jsonb_build_object('delivery_id', p_assignment_id, 'order_id', v_assignment.order_id,
                               'status', p_target, 'staff_id', p_staff_id));

    RETURN jsonb_build_object('success', true, 'status', p_target);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transition_delivery_assignment(uuid, uuid, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_delivery_assignment(uuid, uuid, text, uuid, boolean) TO service_role;

COMMIT;
