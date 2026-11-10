-- ==============================================================================
-- MIGRATION 016: SCALABLE HIGH-THROUGHPUT ENGINE RPCS
-- 1. settle_order_payment_atomic (ACID payment, shift ledger, table release, outbox)
-- 2. transfer_table_atomic (Move dining party & order atomically)
-- 3. merge_tables_atomic (Join tables & combine bill tickets)
-- 4. advance_kds_item_atomic (Station-level status & auto order readiness)
-- 5. update_delivery_status_atomic (Delivery state machine & COD wallet ledger)
-- ==============================================================================

-- 1. ATOMIC PAYMENT SETTLEMENT WITH SHIFT RECONCILIATION & TABLE RELEASE
CREATE OR REPLACE FUNCTION settle_order_payment_atomic(
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. ATOMIC TABLE TRANSFER (Guest moves from Table A to Table B)
CREATE OR REPLACE FUNCTION transfer_table_atomic(
    p_from_table_id UUID,
    p_to_table_id UUID,
    p_staff_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_from_table RECORD;
    v_to_table RECORD;
    v_order RECORD;
    v_event_id BIGINT;
BEGIN
    IF p_from_table_id = p_to_table_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Source and destination tables must be different');
    END IF;

    -- Lock both tables in stable order to prevent deadlocks
    IF p_from_table_id < p_to_table_id THEN
        SELECT * INTO v_from_table FROM tables WHERE id = p_from_table_id FOR UPDATE;
        SELECT * INTO v_to_table FROM tables WHERE id = p_to_table_id FOR UPDATE;
    ELSE
        SELECT * INTO v_to_table FROM tables WHERE id = p_to_table_id FOR UPDATE;
        SELECT * INTO v_from_table FROM tables WHERE id = p_from_table_id FOR UPDATE;
    END IF;

    IF v_from_table IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Source table not found');
    END IF;

    IF v_to_table IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Destination table not found');
    END IF;

    IF v_to_table.status NOT IN ('available', 'reserved') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Destination table ' || v_to_table.table_number || ' is currently ' || v_to_table.status);
    END IF;

    -- Find active order at source table
    SELECT * INTO v_order
    FROM orders
    WHERE table_id = p_from_table_id
      AND status NOT IN ('paid', 'cancelled')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    -- Transfer active order to destination table
    IF v_order IS NOT NULL THEN
        UPDATE orders
        SET table_id = p_to_table_id,
            updated_at = NOW()
        WHERE id = v_order.id;
    END IF;

    -- Destination table becomes occupied with source party details
    UPDATE tables
    SET status = 'occupied',
        current_waiter_id = COALESCE(v_from_table.current_waiter_id, p_staff_id),
        customer_count = v_from_table.customer_count,
        occupied_at = COALESCE(v_from_table.occupied_at, NOW()),
        version = COALESCE(version, 1) + 1,
        updated_at = NOW()
    WHERE id = p_to_table_id;

    -- Source table is released
    UPDATE tables
    SET status = 'available',
        current_waiter_id = NULL,
        customer_count = 1,
        occupied_at = NULL,
        version = COALESCE(version, 1) + 1,
        updated_at = NOW()
    WHERE id = p_from_table_id;

    -- Outbox Event
    INSERT INTO restaurant_events (
        restaurant_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload
    ) VALUES (
        v_from_table.restaurant_id,
        'TABLE',
        p_to_table_id,
        'TABLE_TRANSFERRED',
        jsonb_build_object(
            'from_table_id', p_from_table_id,
            'from_table_number', v_from_table.table_number,
            'to_table_id', p_to_table_id,
            'to_table_number', v_to_table.table_number,
            'order_id', CASE WHEN v_order IS NOT NULL THEN v_order.id ELSE NULL END,
            'staff_id', p_staff_id
        )
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'from_table_number', v_from_table.table_number,
        'to_table_number', v_to_table.table_number,
        'order_transferred', (v_order IS NOT NULL),
        'event_id', v_event_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. ATOMIC TABLE MERGE (Join two tables into a single bill)
CREATE OR REPLACE FUNCTION merge_tables_atomic(
    p_source_table_id UUID,
    p_target_table_id UUID,
    p_staff_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_source_table RECORD;
    v_target_table RECORD;
    v_source_order RECORD;
    v_target_order RECORD;
    v_event_id BIGINT;
BEGIN
    IF p_source_table_id = p_target_table_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot merge a table into itself');
    END IF;

    -- Lock both tables in stable order
    IF p_source_table_id < p_target_table_id THEN
        SELECT * INTO v_source_table FROM tables WHERE id = p_source_table_id FOR UPDATE;
        SELECT * INTO v_target_table FROM tables WHERE id = p_target_table_id FOR UPDATE;
    ELSE
        SELECT * INTO v_target_table FROM tables WHERE id = p_target_table_id FOR UPDATE;
        SELECT * INTO v_source_table FROM tables WHERE id = p_source_table_id FOR UPDATE;
    END IF;

    -- Find active orders for both
    SELECT * INTO v_source_order
    FROM orders
    WHERE table_id = p_source_table_id
      AND status NOT IN ('paid', 'cancelled')
    LIMIT 1
    FOR UPDATE;

    SELECT * INTO v_target_order
    FROM orders
    WHERE table_id = p_target_table_id
      AND status NOT IN ('paid', 'cancelled')
    LIMIT 1
    FOR UPDATE;

    IF v_source_order IS NOT NULL AND v_target_order IS NOT NULL THEN
        -- Move all order items from source order into target order
        UPDATE order_items
        SET order_id = v_target_order.id
        WHERE order_id = v_source_order.id;

        -- Recalculate target order totals
        UPDATE orders
        SET subtotal = v_target_order.subtotal + v_source_order.subtotal,
            tax = v_target_order.tax + v_source_order.tax,
            total = v_target_order.total + v_source_order.total,
            updated_at = NOW()
        WHERE id = v_target_order.id;

        -- Cancel empty source order
        UPDATE orders
        SET status = 'cancelled',
            notes = COALESCE(notes, '') || ' [Merged into Order #' || v_target_order.order_number || ']',
            updated_at = NOW()
        WHERE id = v_source_order.id;
    ELSIF v_source_order IS NOT NULL AND v_target_order IS NULL THEN
        -- Simply move source order to target table
        UPDATE orders
        SET table_id = p_target_table_id,
            updated_at = NOW()
        WHERE id = v_source_order.id;
    END IF;

    -- Update target table customer count
    UPDATE tables
    SET customer_count = COALESCE(customer_count, 1) + COALESCE(v_source_table.customer_count, 1),
        version = COALESCE(version, 1) + 1,
        updated_at = NOW()
    WHERE id = p_target_table_id;

    -- Free source table
    UPDATE tables
    SET status = 'available',
        current_waiter_id = NULL,
        customer_count = 1,
        occupied_at = NULL,
        version = COALESCE(version, 1) + 1,
        updated_at = NOW()
    WHERE id = p_source_table_id;

    -- Outbox Event
    INSERT INTO restaurant_events (
        restaurant_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload
    ) VALUES (
        v_target_table.restaurant_id,
        'TABLE',
        p_target_table_id,
        'TABLES_MERGED',
        jsonb_build_object(
            'source_table_id', p_source_table_id,
            'target_table_id', p_target_table_id,
            'source_order_id', CASE WHEN v_source_order IS NOT NULL THEN v_source_order.id ELSE NULL END,
            'target_order_id', CASE WHEN v_target_order IS NOT NULL THEN v_target_order.id ELSE NULL END,
            'staff_id', p_staff_id
        )
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Tables successfully merged',
        'target_table_id', p_target_table_id,
        'event_id', v_event_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. ATOMIC KDS ITEM STATUS ADVANCEMENT WITH ORDER AUTO-READY
CREATE OR REPLACE FUNCTION advance_kds_item_atomic(
    p_order_item_id UUID,
    p_new_status VARCHAR(32),
    p_staff_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_order RECORD;
    v_unready_count INTEGER;
    v_all_plated BOOLEAN := false;
    v_event_id BIGINT;
BEGIN
    SELECT * INTO v_item
    FROM order_items
    WHERE id = p_order_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order item not found');
    END IF;

    IF v_item.kitchen_status = 'voided' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot advance a voided item');
    END IF;

    -- Update item status
    UPDATE order_items
    SET kitchen_status = p_new_status,
        status = CASE 
            WHEN p_new_status = 'cooking' THEN 'preparing'
            WHEN p_new_status IN ('plated', 'ready') THEN 'ready'
            WHEN p_new_status = 'served' THEN 'served'
            ELSE status
        END
    WHERE id = p_order_item_id;

    -- Check if all items in this order are now plated
    SELECT COUNT(*) INTO v_unready_count
    FROM order_items
    WHERE order_id = v_item.order_id
      AND kitchen_status NOT IN ('plated', 'served', 'voided');

    IF v_unready_count = 0 THEN
        v_all_plated := true;
        UPDATE orders
        SET status = 'ready',
            updated_at = NOW()
        WHERE id = v_item.order_id
          AND status IN ('pending', 'preparing');
    END IF;

    -- Outbox Event
    INSERT INTO restaurant_events (
        restaurant_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload
    ) VALUES (
        (SELECT restaurant_id FROM orders WHERE id = v_item.order_id),
        'KITCHEN',
        p_order_item_id,
        'KDS_ITEM_STATUS_UPDATED',
        jsonb_build_object(
            'order_item_id', p_order_item_id,
            'order_id', v_item.order_id,
            'new_status', p_new_status,
            'order_all_plated', v_all_plated,
            'staff_id', p_staff_id
        )
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_item_id', p_order_item_id,
        'kitchen_status', p_new_status,
        'order_all_plated', v_all_plated,
        'event_id', v_event_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. ATOMIC DELIVERY DISPATCH & COD WALLET RECONCILIATION
CREATE OR REPLACE FUNCTION update_delivery_status_atomic(
    p_delivery_id UUID,
    p_new_status VARCHAR(50),
    p_rider_id UUID,
    p_cod_collected DECIMAL(10,2) DEFAULT 0.00,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_delivery RECORD;
    v_order RECORD;
    v_event_id BIGINT;
BEGIN
    SELECT * INTO v_delivery
    FROM delivery_assignments
    WHERE id = p_delivery_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Delivery assignment not found');
    END IF;

    -- Update delivery assignment state
    UPDATE delivery_assignments
    SET status = p_new_status,
        rider_id = COALESCE(p_rider_id, rider_id),
        cod_amount_collected = CASE 
            WHEN p_cod_collected > 0.00 THEN p_cod_collected 
            ELSE cod_amount_collected 
        END,
        actual_pickup_time = CASE WHEN p_new_status = 'picked_up' AND actual_pickup_time IS NULL THEN NOW() ELSE actual_pickup_time END,
        actual_delivery_time = CASE WHEN p_new_status = 'delivered' THEN NOW() ELSE actual_delivery_time END,
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE id = p_delivery_id;

    -- If delivered with COD, automatically settle the order
    IF p_new_status = 'delivered' AND p_cod_collected > 0.00 THEN
        UPDATE orders
        SET status = 'paid',
            payment_status = 'paid',
            payment_method = 'cash',
            amount_paid = p_cod_collected,
            paid_at = NOW(),
            updated_at = NOW()
        WHERE id = v_delivery.order_id;
    END IF;

    -- Outbox Event
    INSERT INTO restaurant_events (
        restaurant_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload
    ) VALUES (
        v_delivery.restaurant_id,
        'DELIVERY',
        p_delivery_id,
        'DELIVERY_STATUS_UPDATED',
        jsonb_build_object(
            'delivery_id', p_delivery_id,
            'order_id', v_delivery.order_id,
            'status', p_new_status,
            'rider_id', COALESCE(p_rider_id, v_delivery.rider_id),
            'cod_collected', p_cod_collected
        )
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'delivery_id', p_delivery_id,
        'status', p_new_status,
        'cod_collected', p_cod_collected,
        'event_id', v_event_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

