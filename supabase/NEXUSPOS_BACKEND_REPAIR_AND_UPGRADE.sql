-- NexusPOS upgrade for the existing database shown in the diagnostic results.
-- Restores the two missing prerequisites, then applies migrations 017 and 018.
-- Run on staging first. All changes are in one transaction.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = public, extensions, pg_temp;

DO $repair_preflight$
DECLARE
    missing text;
BEGIN
    SELECT string_agg(required.relation || '.' || col, ', ' ORDER BY required.relation, col)
    INTO missing
    FROM (VALUES
        ('orders', 'id restaurant_id staff_id order_number status table_id total amount_paid discount payment_status payment_method paid_at tax updated_at'),
        ('staff', 'id restaurant_id user_id role is_active'),
        ('restaurants', 'id owner_id'),
        ('tables', 'id restaurant_id status current_waiter_id customer_count occupied_at version updated_at'),
        ('cashier_transactions', 'restaurant_id staff_id order_id transaction_type amount payment_method created_at'),
        ('register_shifts', 'id restaurant_id staff_id status opened_at total_sales_cash total_sales_card total_sales_mobile total_tax_collected updated_at'),
        ('split_payments', 'order_id split_number amount payment_method payment_status items created_at updated_at'),
        ('restaurant_events', 'id restaurant_id aggregate_type aggregate_id event_type payload'),
        ('payments', 'order_id amount method status'),
        ('order_items', 'order_id status kitchen_status'),
        ('kitchen_order_queue', 'order_id restaurant_id status assigned_to started_at ready_at served_at actual_prep_time_seconds'),
        ('staff_alerts', 'restaurant_id to_staff_id alert_type title message priority'),
        ('delivery_assignments', 'id restaurant_id rider_id status order_id actual_pickup_time actual_delivery_time updated_at')
    ) AS required(relation, columns)
    CROSS JOIN LATERAL unnest(string_to_array(required.columns, ' ')) AS cols(col)
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = to_regclass(format('public.%I', required.relation))
          AND a.attname = cols.col AND a.attnum > 0 AND NOT a.attisdropped
    );

    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'NexusPOS upgrade needs these schema columns: %', missing;
    END IF;

    IF to_regprocedure('public.is_restaurant_member(uuid)') IS NULL
       OR to_regprocedure('public.create_order_atomic(jsonb)') IS NULL THEN
        RAISE EXCEPTION 'Expected is_restaurant_member(uuid) and create_order_atomic(jsonb) to be installed';
    END IF;
END;
$repair_preflight$;

DO $repair_functions$
BEGIN
    IF to_regprocedure('public.get_current_staff_role(uuid)') IS NULL THEN
        EXECUTE $role_definition$
CREATE FUNCTION public.get_current_staff_role(p_restaurant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_role VARCHAR;
BEGIN
    -- Check if current user is restaurant owner
    IF EXISTS (
        SELECT 1 FROM restaurants 
        WHERE id = p_restaurant_id AND owner_id = auth.uid()
    ) THEN
        RETURN 'owner';
    END IF;

    -- Look up staff record for current auth user
    SELECT role INTO v_role
    FROM staff
    WHERE restaurant_id = p_restaurant_id
      AND user_id = auth.uid()
      AND is_active = true
    LIMIT 1;

    RETURN COALESCE(v_role, 'anonymous');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
$role_definition$;
    END IF;

    IF to_regprocedure('public.settle_order_payment_atomic(jsonb)') IS NULL THEN
        EXECUTE $settlement_definition$
CREATE FUNCTION public.settle_order_payment_atomic(
    p_payload JSONB
) RETURNS JSONB AS $$
DECLARE
    v_order_id UUID;
    v_restaurant_id UUID;
    v_staff_id UUID;
    v_payment_method VARCHAR(50);
    v_amount DECIMAL(12,2);
    v_tip DECIMAL(10,2) := 0.00;
    v_discount DECIMAL(10,2) := 0.00;
    v_cash_received DECIMAL(12,2) := 0.00;
    v_is_split BOOLEAN := false;
    v_splits JSONB;

    v_order RECORD;
    v_table RECORD;
    v_shift RECORD;
    v_total_paid DECIMAL(12,2);
    v_change DECIMAL(12,2) := 0.00;
    v_remaining DECIMAL(12,2);
    v_new_status VARCHAR(32);
    v_event_id BIGINT;
    v_split_item RECORD;
BEGIN
    v_order_id := (p_payload->>'order_id')::UUID;
    IF v_order_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'order_id is required');
    END IF;

    IF p_payload->>'staff_id' IS NOT NULL AND p_payload->>'staff_id' != '' THEN
        v_staff_id := (p_payload->>'staff_id')::UUID;
    END IF;

    v_payment_method := COALESCE(p_payload->>'payment_method', 'cash');
    v_tip := GREATEST(0.00, COALESCE((p_payload->>'tip')::DECIMAL, 0.00));
    v_discount := GREATEST(0.00, COALESCE((p_payload->>'discount')::DECIMAL, 0.00));
    v_cash_received := GREATEST(0.00, COALESCE((p_payload->>'cash_received')::DECIMAL, 0.00));
    v_is_split := COALESCE((p_payload->>'is_split')::BOOLEAN, false);
    v_splits := p_payload->'split_payments';

    -- 1a. Lock order row
    SELECT * INTO v_order
    FROM orders
    WHERE id = v_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    v_restaurant_id := v_order.restaurant_id;

    IF v_order.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order is already fully paid');
    END IF;

    IF v_order.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot pay a cancelled order');
    END IF;

    v_amount := COALESCE((p_payload->>'amount')::DECIMAL, v_order.total - COALESCE(v_order.amount_paid, 0.00));
    IF v_discount > 0.00 THEN
        v_order.total := GREATEST(0.00, v_order.total - v_discount);
    END IF;

    -- Validate cash received
    IF v_payment_method = 'cash' AND v_cash_received > 0.00 AND v_cash_received < v_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cash received is less than payment amount');
    END IF;

    IF v_payment_method = 'cash' AND v_cash_received >= v_amount THEN
        v_change := v_cash_received - v_amount;
    END IF;

    v_total_paid := COALESCE(v_order.amount_paid, 0.00) + v_amount;
    v_remaining := GREATEST(0.00, v_order.total - v_total_paid);

    IF v_remaining <= 0.01 THEN
        v_new_status := 'paid';
    ELSE
        v_new_status := 'partial_paid';
    END IF;

    -- 1b. Update Order
    UPDATE orders
    SET status = CASE WHEN v_new_status = 'paid' THEN 'paid' ELSE status END,
        payment_status = CASE WHEN v_new_status = 'paid' THEN 'paid' ELSE 'partial' END,
        payment_method = v_payment_method,
        amount_paid = v_total_paid,
        discount = COALESCE(v_order.discount, 0.00) + v_discount,
        paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE paid_at END,
        updated_at = NOW()
    WHERE id = v_order_id;

    -- 1c. Record Cashier Transaction
    INSERT INTO cashier_transactions (
        restaurant_id,
        staff_id,
        order_id,
        transaction_type,
        amount,
        payment_method,
        created_at
    ) VALUES (
        v_restaurant_id,
        COALESCE(v_staff_id, v_order.staff_id),
        v_order_id,
        'sale',
        v_amount,
        v_payment_method,
        NOW()
    );

    -- 1d. Update Active Register Shift Ledger (Z-Report Integrity)
    IF v_staff_id IS NOT NULL THEN
        SELECT * INTO v_shift
        FROM register_shifts
        WHERE restaurant_id = v_restaurant_id
          AND staff_id = v_staff_id
          AND status = 'open'
        ORDER BY opened_at DESC
        LIMIT 1
        FOR UPDATE;

        IF FOUND THEN
            UPDATE register_shifts
            SET total_sales_cash = total_sales_cash + (CASE WHEN v_payment_method = 'cash' THEN v_amount ELSE 0.00 END),
                total_sales_card = total_sales_card + (CASE WHEN v_payment_method = 'card' THEN v_amount ELSE 0.00 END),
                total_sales_mobile = total_sales_mobile + (CASE WHEN v_payment_method = 'mobile' THEN v_amount ELSE 0.00 END),
                total_tax_collected = total_tax_collected + ROUND((v_amount * COALESCE(v_order.tax, 0.00) / GREATEST(1.0, v_order.total)), 2),
                updated_at = NOW()
            WHERE id = v_shift.id;
        END IF;
    END IF;

    -- 1e. Handle Split Payments Recording
    IF v_is_split AND v_splits IS NOT NULL AND jsonb_array_length(v_splits) > 0 THEN
        FOR v_split_item IN SELECT * FROM jsonb_to_recordset(v_splits) AS s(
            split_number INTEGER,
            amount DECIMAL(12,2),
            method VARCHAR(50),
            items JSONB
        ) LOOP
            INSERT INTO split_payments (
                order_id,
                split_number,
                amount,
                payment_method,
                payment_status,
                items,
                created_at,
                updated_at
            ) VALUES (
                v_order_id,
                COALESCE(v_split_item.split_number, 1),
                v_split_item.amount,
                COALESCE(v_split_item.method, v_payment_method),
                'completed',
                COALESCE(v_split_item.items, '[]'::jsonb),
                NOW(),
                NOW()
            );
        END LOOP;
    END IF;

    -- 1f. Release Table if Fully Settled
    IF v_new_status = 'paid' AND v_order.table_id IS NOT NULL THEN
        UPDATE tables
        SET status = 'available',
            current_waiter_id = NULL,
            customer_count = 1,
            occupied_at = NULL,
            version = COALESCE(version, 1) + 1,
            updated_at = NOW()
        WHERE id = v_order.table_id;
    ELSIF v_new_status = 'partial_paid' AND v_order.table_id IS NOT NULL THEN
        -- Keep table locked in billing state until final balance cleared
        UPDATE tables
        SET status = 'billing',
            version = COALESCE(version, 1) + 1,
            updated_at = NOW()
        WHERE id = v_order.table_id;
    END IF;

    -- 1g. Record Event Outbox
    INSERT INTO restaurant_events (
        restaurant_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload
    ) VALUES (
        v_restaurant_id,
        'ORDER',
        v_order_id,
        CASE WHEN v_new_status = 'paid' THEN 'ORDER_PAID' ELSE 'ORDER_PARTIAL_PAID' END,
        jsonb_build_object(
            'order_id', v_order_id,
            'order_number', v_order.order_number,
            'amount_paid', v_amount,
            'total_paid', v_total_paid,
            'remaining_balance', v_remaining,
            'change', v_change,
            'payment_method', v_payment_method,
            'is_fully_paid', (v_new_status = 'paid'),
            'table_id', v_order.table_id
        )
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order.order_number,
        'amount_paid', v_amount,
        'total_paid', v_total_paid,
        'remaining_balance', v_remaining,
        'change', v_change,
        'status', v_new_status,
        'table_released', (v_new_status = 'paid' AND v_order.table_id IS NOT NULL),
        'event_id', v_event_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;
$settlement_definition$;
    END IF;
END;
$repair_functions$;

REVOKE EXECUTE ON FUNCTION public.get_current_staff_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_staff_role(uuid) TO authenticated, service_role;

-- 017_restrict_internal_order_rpcs.sql
-- These commands are called by OrderService with the server's service role.
DO $$
DECLARE
    command record;
BEGIN
    FOR command IN
        SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prokind = 'f'
          AND p.proname IN (
              'generate_daily_order_number', 'seat_table_atomic', 'create_order_atomic',
              'request_or_execute_item_void', 'settle_order_payment_atomic',
              'transfer_table_atomic', 'merge_tables_atomic', 'advance_kds_item_atomic',
              'update_delivery_status_atomic', 'update_rider_location', 'record_delivery_location'
          )
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
            command.proname, command.arguments
        );
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
            command.proname, command.arguments
        );
        EXECUTE format(
            'ALTER FUNCTION public.%I(%s) SET search_path = public, extensions, pg_temp',
            command.proname, command.arguments
        );
    END LOOP;
END;
$$;

-- Hold the tenant-scoped order lock through the existing settlement transaction.
CREATE OR REPLACE FUNCTION public.settle_restaurant_order_payment(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM id FROM public.orders
    WHERE id = (p_payload->>'order_id')::uuid
      AND restaurant_id = (p_payload->>'restaurant_id')::uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    RETURN public.settle_order_payment_atomic(p_payload);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_restaurant_order_payment(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_restaurant_order_payment(jsonb) TO service_role;

DO $$
BEGIN
    IF to_regclass('public.order_item_modifiers') IS NOT NULL THEN
        ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Staff member access modifiers" ON public.order_item_modifiers;
        DROP POLICY IF EXISTS "Restaurant staff can read order modifiers" ON public.order_item_modifiers;
        REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_item_modifiers FROM PUBLIC, anon, authenticated;
        CREATE POLICY "Restaurant staff can read order modifiers" ON public.order_item_modifiers
            FOR SELECT TO authenticated
            USING (EXISTS (
                SELECT 1
                FROM public.order_items item
                JOIN public.orders ord ON ord.id = item.order_id
                WHERE item.id = order_item_modifiers.order_item_id
                  AND public.is_restaurant_member(ord.restaurant_id)
            ));
    END IF;

    IF to_regclass('public.rider_locations') IS NOT NULL THEN
        ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Service role full access" ON public.rider_locations;
        DROP POLICY IF EXISTS "Fleet managers can view rider locations" ON public.rider_locations;
        CREATE POLICY "Fleet managers can view rider locations" ON public.rider_locations
            FOR SELECT TO authenticated
            USING (public.get_current_staff_role(restaurant_id) IN ('owner', 'manager'));
    END IF;

    IF to_regclass('public.rider_location_history') IS NOT NULL THEN
        ALTER TABLE public.rider_location_history ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.rider_location_history FROM PUBLIC, anon, authenticated;
        DROP POLICY IF EXISTS "Service role full access" ON public.rider_location_history;
        CREATE INDEX IF NOT EXISTS rider_location_history_order_rider_time_idx
            ON public.rider_location_history(order_id, rider_id, recorded_at DESC);
    END IF;
END;
$$;

-- 018_atomic_checkout_and_kitchen.sql
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
NOTIFY pgrst, 'reload schema';

COMMIT;
