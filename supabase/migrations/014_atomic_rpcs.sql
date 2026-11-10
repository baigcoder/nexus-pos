-- ==============================================================================
-- Migration: 014_atomic_rpcs.sql
-- Description: ACID-compliant stored procedures for daily order numbering,
--              atomic table seating, transactional order creation, and
--              item fire/void protocol with automatic event outbox emission.
-- ==============================================================================

-- 1. DAILY ORDER NUMBER SEQUENCE GENERATOR (4-HOUR ROLLOVER)
CREATE TABLE IF NOT EXISTS restaurant_daily_sequences (
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    business_date DATE NOT NULL,
    current_number INTEGER NOT NULL DEFAULT 1000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (restaurant_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_seq_lookup 
    ON restaurant_daily_sequences(restaurant_id, business_date);

CREATE OR REPLACE FUNCTION generate_daily_order_number(
    p_restaurant_id UUID,
    p_tz TEXT DEFAULT 'Asia/Karachi'
) RETURNS INTEGER AS $$
DECLARE
    v_business_date DATE;
    v_next_num INTEGER;
BEGIN
    -- 4-hour offset ensures shifts spanning midnight keep continuous order numbering
    v_business_date := ((NOW() AT TIME ZONE COALESCE(p_tz, 'Asia/Karachi')) - INTERVAL '4 hours')::DATE;

    INSERT INTO restaurant_daily_sequences (restaurant_id, business_date, current_number)
    VALUES (p_restaurant_id, v_business_date, 1001)
    ON CONFLICT (restaurant_id, business_date)
    DO UPDATE SET 
        current_number = restaurant_daily_sequences.current_number + 1,
        updated_at = NOW()
    RETURNING current_number INTO v_next_num;

    RETURN v_next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. ATOMIC TABLE SEATING WITH OPTIMISTIC CONCURRENCY
CREATE OR REPLACE FUNCTION seat_table_atomic(
    p_table_id UUID,
    p_waiter_id UUID,
    p_customer_count INT
) RETURNS JSONB AS $$
DECLARE
    v_table RECORD;
    v_event_id BIGINT;
BEGIN
    SELECT * INTO v_table
    FROM tables
    WHERE id = p_table_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Table not found');
    END IF;

    IF v_table.status NOT IN ('available', 'reserved') THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Table ' || v_table.table_number || ' is currently ' || v_table.status
        );
    END IF;

    UPDATE tables
    SET status = 'occupied',
        current_waiter_id = p_waiter_id,
        customer_count = GREATEST(1, COALESCE(p_customer_count, 1)),
        occupied_at = NOW(),
        version = COALESCE(version, 1) + 1,
        updated_at = NOW()
    WHERE id = p_table_id;

    INSERT INTO restaurant_events (
        restaurant_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload
    ) VALUES (
        v_table.restaurant_id,
        'TABLE',
        p_table_id,
        'TABLE_SEATED',
        jsonb_build_object(
            'table_id', p_table_id,
            'table_number', v_table.table_number,
            'waiter_id', p_waiter_id,
            'customer_count', GREATEST(1, COALESCE(p_customer_count, 1)),
            'timestamp', NOW()
        )
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'table_id', p_table_id,
        'table_number', v_table.table_number,
        'status', 'occupied',
        'waiter_id', p_waiter_id,
        'customer_count', GREATEST(1, COALESCE(p_customer_count, 1)),
        'event_id', v_event_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. TRANSACTIONAL ORDER CREATION (SERVER-SIDE PRICE LOOKUP & SNAPSHOTS)
CREATE OR REPLACE FUNCTION create_order_atomic(
    p_payload JSONB
) RETURNS JSONB AS $$
DECLARE
    v_restaurant_id UUID;
    v_table_id UUID;
    v_staff_id UUID;
    v_order_type VARCHAR(32);
    v_client_order_id UUID;
    v_items JSONB;
    v_notes TEXT;
    v_is_priority BOOLEAN;
    v_customer_name VARCHAR(255);
    v_customer_phone VARCHAR(50);
    v_customer_email VARCHAR(255);
    v_delivery_address TEXT;
    v_delivery_fee DECIMAL(10,2);
    v_payment_method VARCHAR(50);
    v_source VARCHAR(50);

    v_restaurant RECORD;
    v_table RECORD;
    v_existing_order RECORD;
    v_order_id UUID;
    v_order_number INTEGER;
    v_subtotal DECIMAL(10,2) := 0.00;
    v_tax_rate DECIMAL(5,2) := 0.00;
    v_tax_amount DECIMAL(10,2) := 0.00;
    v_total DECIMAL(10,2) := 0.00;
    v_event_id BIGINT;

    v_item RECORD;
    v_menu_item RECORD;
    v_order_item_id UUID;
    v_item_qty INTEGER;
    v_item_unit_price DECIMAL(10,2);
    v_item_subtotal DECIMAL(10,2);
    v_item_tax DECIMAL(10,2);
    v_mod RECORD;
    v_mod_total DECIMAL(10,2);
    v_modifiers JSONB;
    v_max_prep_time INTEGER := 15;
BEGIN
    -- Extract and validate base payload
    v_restaurant_id := (p_payload->>'restaurant_id')::UUID;
    IF v_restaurant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'restaurant_id is required');
    END IF;

    IF p_payload->>'table_id' IS NOT NULL AND p_payload->>'table_id' != '' THEN
        v_table_id := (p_payload->>'table_id')::UUID;
    END IF;

    IF p_payload->>'staff_id' IS NOT NULL AND p_payload->>'staff_id' != '' THEN
        v_staff_id := (p_payload->>'staff_id')::UUID;
    END IF;

    v_order_type := COALESCE(p_payload->>'order_type', 'dine_in');
    v_notes := p_payload->>'notes';
    v_is_priority := COALESCE((p_payload->>'is_priority')::BOOLEAN, false);
    v_customer_name := p_payload->>'customer_name';
    v_customer_phone := p_payload->>'customer_phone';
    v_customer_email := p_payload->>'customer_email';
    v_delivery_address := p_payload->>'delivery_address';
    v_delivery_fee := GREATEST(0.00, COALESCE((p_payload->>'delivery_fee')::DECIMAL, 0.00));
    v_payment_method := COALESCE(p_payload->>'payment_method', 'cash');
    v_source := COALESCE(p_payload->>'source', 'pos');

    IF p_payload->>'client_order_id' IS NOT NULL AND p_payload->>'client_order_id' != '' THEN
        v_client_order_id := (p_payload->>'client_order_id')::UUID;
    END IF;

    -- 3a. Idempotency check via client_order_id
    IF v_client_order_id IS NOT NULL THEN
        SELECT id, order_number, subtotal, tax, total, status INTO v_existing_order
        FROM orders
        WHERE restaurant_id = v_restaurant_id AND client_order_id = v_client_order_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent_replay', true,
                'order_id', v_existing_order.id,
                'order_number', v_existing_order.order_number,
                'subtotal', v_existing_order.subtotal,
                'tax', v_existing_order.tax,
                'total', v_existing_order.total,
                'status', v_existing_order.status
            );
        END IF;
    END IF;

    -- 3b. Validate restaurant status
    SELECT id, tax_rate, is_active INTO v_restaurant
    FROM restaurants
    WHERE id = v_restaurant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Restaurant not found');
    END IF;

    IF NOT v_restaurant.is_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Restaurant is currently inactive');
    END IF;

    v_tax_rate := COALESCE(v_restaurant.tax_rate, 0.00);

    -- 3c. Handle Dine-in Table Locking
    IF v_order_type = 'dine_in' AND v_table_id IS NOT NULL THEN
        SELECT * INTO v_table
        FROM tables
        WHERE id = v_table_id AND restaurant_id = v_restaurant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Table not found');
        END IF;

        IF v_table.status = 'billing' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Table is currently settling bill. Cannot ring up additional items.');
        END IF;

        IF v_table.status = 'available' THEN
            UPDATE tables
            SET status = 'occupied',
                occupied_at = NOW(),
                updated_at = NOW()
            WHERE id = v_table_id;
        END IF;
    END IF;

    -- 3d. Validate Items Array
    v_items := p_payload->'items';
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order must contain at least one item');
    END IF;

    -- 3e. First Pass: Authoritative Price Calculation from menu_items table
    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_items) AS x(
        menu_item_id UUID,
        quantity INTEGER,
        special_instructions TEXT,
        modifiers JSONB
    ) LOOP
        SELECT id, name, price, cost_price, is_available, preparation_time INTO v_menu_item
        FROM menu_items
        WHERE id = v_item.menu_item_id AND restaurant_id = v_restaurant_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Menu item not found: ' || v_item.menu_item_id);
        END IF;

        IF NOT v_menu_item.is_available THEN
            RETURN jsonb_build_object('success', false, 'error', 'Item is 86''ed (out of stock): ' || v_menu_item.name);
        END IF;

        IF v_menu_item.preparation_time IS NOT NULL AND v_menu_item.preparation_time > v_max_prep_time THEN
            v_max_prep_time := v_menu_item.preparation_time;
        END IF;

        v_item_qty := GREATEST(1, COALESCE(v_item.quantity, 1));
        v_mod_total := 0.00;

        IF v_item.modifiers IS NOT NULL AND jsonb_array_length(v_item.modifiers) > 0 THEN
            FOR v_mod IN SELECT * FROM jsonb_to_recordset(v_item.modifiers) AS m(
                price_modifier DECIMAL(10,2)
            ) LOOP
                v_mod_total := v_mod_total + GREATEST(0.00, COALESCE(v_mod.price_modifier, 0.00));
            END LOOP;
        END IF;

        v_item_unit_price := v_menu_item.price + v_mod_total;
        v_subtotal := v_subtotal + (v_item_unit_price * v_item_qty);
    END LOOP;

    v_tax_amount := ROUND((v_subtotal * v_tax_rate / 100), 2);
    v_total := v_subtotal + v_tax_amount + v_delivery_fee;

    -- 3f. Generate Daily Order Number
    v_order_number := generate_daily_order_number(v_restaurant_id);

    -- 3g. Insert Order Header
    INSERT INTO orders (
        restaurant_id,
        table_id,
        staff_id,
        order_number,
        status,
        order_type,
        subtotal,
        tax,
        delivery_fee,
        total,
        notes,
        is_priority,
        customer_name,
        customer_phone,
        customer_email,
        delivery_address,
        payment_method,
        payment_status,
        source,
        client_order_id,
        created_at,
        updated_at
    ) VALUES (
        v_restaurant_id,
        v_table_id,
        v_staff_id,
        v_order_number,
        'pending',
        v_order_type,
        v_subtotal,
        v_tax_amount,
        v_delivery_fee,
        v_total,
        v_notes,
        v_is_priority,
        v_customer_name,
        v_customer_phone,
        v_customer_email,
        v_delivery_address,
        v_payment_method,
        'unpaid',
        v_source,
        v_client_order_id,
        NOW(),
        NOW()
    ) RETURNING id INTO v_order_id;

    -- 3h. Second Pass: Insert Order Items with Snapshots & Modifiers
    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_items) AS x(
        menu_item_id UUID,
        quantity INTEGER,
        special_instructions TEXT,
        modifiers JSONB
    ) LOOP
        SELECT id, name, price, cost_price INTO v_menu_item
        FROM menu_items
        WHERE id = v_item.menu_item_id;

        v_item_qty := GREATEST(1, COALESCE(v_item.quantity, 1));
        v_mod_total := 0.00;

        IF v_item.modifiers IS NOT NULL AND jsonb_array_length(v_item.modifiers) > 0 THEN
            FOR v_mod IN SELECT * FROM jsonb_to_recordset(v_item.modifiers) AS m(
                price_modifier DECIMAL(10,2)
            ) LOOP
                v_mod_total := v_mod_total + GREATEST(0.00, COALESCE(v_mod.price_modifier, 0.00));
            END LOOP;
        END IF;

        v_item_unit_price := v_menu_item.price + v_mod_total;
        v_item_subtotal := v_item_unit_price * v_item_qty;
        v_item_tax := ROUND((v_item_subtotal * v_tax_rate / 100), 2);

        INSERT INTO order_items (
            order_id,
            menu_item_id,
            quantity,
            unit_price,
            subtotal,
            special_instructions,
            customizations,
            status,
            kitchen_status,
            item_name_snapshot,
            variant_name_snapshot,
            unit_cost_snapshot,
            tax_rate_snapshot,
            tax_amount_snapshot,
            created_at
        ) VALUES (
            v_order_id,
            v_menu_item.id,
            v_item_qty,
            v_item_unit_price,
            v_item_subtotal,
            v_item.special_instructions,
            COALESCE(v_item.modifiers, '[]'::jsonb),
            'pending',
            'fired',
            v_menu_item.name,
            NULL,
            COALESCE(v_menu_item.cost_price, 0.00),
            v_tax_rate,
            v_item_tax,
            NOW()
        ) RETURNING id INTO v_order_item_id;

        -- Insert Modifiers
        IF v_item.modifiers IS NOT NULL AND jsonb_array_length(v_item.modifiers) > 0 THEN
            FOR v_mod IN SELECT * FROM jsonb_to_recordset(v_item.modifiers) AS m(
                modifier_option_id UUID,
                name VARCHAR(255),
                price_modifier DECIMAL(10,2)
            ) LOOP
                INSERT INTO order_item_modifiers (
                    order_item_id,
                    modifier_option_id,
                    modifier_name_snapshot,
                    price_modifier_snapshot,
                    created_at
                ) VALUES (
                    v_order_item_id,
                    v_mod.modifier_option_id,
                    COALESCE(v_mod.name, 'Modifier'),
                    GREATEST(0.00, COALESCE(v_mod.price_modifier, 0.00)),
                    NOW()
                );
            END LOOP;
        END IF;

        -- Lightweight Recipe Inventory Deduction (if configured)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_item_ingredients') THEN
            UPDATE inventory inv
            SET current_stock = inv.current_stock - (mii.quantity_required * v_item_qty),
                updated_at = NOW()
            FROM menu_item_ingredients mii
            WHERE mii.inventory_id = inv.id
              AND mii.menu_item_id = v_menu_item.id;
        END IF;
    END LOOP;

    -- 3i. Delivery Assignment Record
    IF v_order_type = 'delivery' THEN
        INSERT INTO delivery_assignments (
            restaurant_id,
            order_id,
            customer_name,
            customer_phone,
            delivery_address,
            status,
            estimated_minutes,
            created_at
        ) VALUES (
            v_restaurant_id,
            v_order_id,
            COALESCE(v_customer_name, 'Delivery Customer'),
            v_customer_phone,
            COALESCE(v_delivery_address, 'Address not provided'),
            'pending_dispatch',
            v_max_prep_time + 20,
            NOW()
        );
    END IF;

    -- 3j. Kitchen Queue Integration
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kitchen_order_queue') THEN
        INSERT INTO kitchen_order_queue (
            order_id,
            restaurant_id,
            priority,
            status,
            prep_time_seconds,
            received_at,
            created_at
        ) VALUES (
            v_order_id,
            v_restaurant_id,
            CASE WHEN v_is_priority THEN 'high' ELSE 'normal' END,
            'pending',
            v_max_prep_time * 60,
            NOW(),
            NOW()
        );
    END IF;

    -- 3k. Transactional Event Outbox Emission
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
        'ORDER_CREATED',
        jsonb_build_object(
            'order_id', v_order_id,
            'order_number', v_order_number,
            'order_type', v_order_type,
            'table_id', v_table_id,
            'subtotal', v_subtotal,
            'tax', v_tax_amount,
            'delivery_fee', v_delivery_fee,
            'total', v_total,
            'created_at', NOW()
        )
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'subtotal', v_subtotal,
        'tax', v_tax_amount,
        'delivery_fee', v_delivery_fee,
        'total', v_total,
        'status', 'pending',
        'event_id', v_event_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ITEM-LEVEL FIRE & VOID PROTOCOL WITH WASTE AUDITING
CREATE OR REPLACE FUNCTION request_or_execute_item_void(
    p_order_item_id UUID,
    p_reason TEXT,
    p_staff_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_order RECORD;
    v_new_subtotal DECIMAL(10,2);
    v_new_tax DECIMAL(10,2);
    v_new_total DECIMAL(10,2);
    v_event_id BIGINT;
    v_waste_logged BOOLEAN := false;
BEGIN
    SELECT * INTO v_item
    FROM order_items
    WHERE id = p_order_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order item not found');
    END IF;

    IF v_item.kitchen_status = 'voided' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item is already voided');
    END IF;

    IF v_item.kitchen_status = 'served' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot void an item that has already been served. Issue a refund instead.');
    END IF;

    SELECT * INTO v_order
    FROM orders
    WHERE id = v_item.order_id
    FOR UPDATE;

    -- If cooking or plated, food was prepared -> log to waste_records!
    IF v_item.kitchen_status IN ('cooking', 'plated') THEN
        INSERT INTO waste_records (
            restaurant_id,
            order_id,
            order_item_id,
            menu_item_id,
            item_name,
            quantity,
            cost_price,
            total_cost_wasted,
            reason,
            staff_id
        ) VALUES (
            v_order.restaurant_id,
            v_order.id,
            v_item.id,
            v_item.menu_item_id,
            v_item.item_name_snapshot,
            v_item.quantity,
            v_item.unit_cost_snapshot,
            (v_item.unit_cost_snapshot * v_item.quantity),
            COALESCE(p_reason, 'Voided during or after cooking'),
            p_staff_id
        );
        v_waste_logged := true;
    END IF;

    -- Update item status to voided
    UPDATE order_items
    SET kitchen_status = 'voided',
        status = 'served' -- keeps legacy compatibility
    WHERE id = p_order_item_id;

    -- Recalculate order totals excluding voided items
    SELECT 
        COALESCE(SUM(subtotal), 0.00),
        COALESCE(SUM(tax_amount_snapshot), 0.00)
    INTO v_new_subtotal, v_new_tax
    FROM order_items
    WHERE order_id = v_order.id
      AND kitchen_status != 'voided';

    v_new_total := v_new_subtotal + v_new_tax + COALESCE(v_order.delivery_fee, 0.00) - COALESCE(v_order.discount, 0.00);

    UPDATE orders
    SET subtotal = v_new_subtotal,
        tax = v_new_tax,
        total = v_new_total,
        updated_at = NOW()
    WHERE id = v_order.id;

    -- Emit event
    INSERT INTO restaurant_events (
        restaurant_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload
    ) VALUES (
        v_order.restaurant_id,
        'ORDER',
        v_order.id,
        'ITEM_VOIDED',
        jsonb_build_object(
            'order_id', v_order.id,
            'order_item_id', p_order_item_id,
            'item_name', v_item.item_name_snapshot,
            'quantity', v_item.quantity,
            'reason', p_reason,
            'staff_id', p_staff_id,
            'waste_logged', v_waste_logged,
            'new_order_total', v_new_total
        )
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order.id,
        'order_item_id', p_order_item_id,
        'voided', true,
        'waste_logged', v_waste_logged,
        'new_subtotal', v_new_subtotal,
        'new_total', v_new_total,
        'event_id', v_event_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

