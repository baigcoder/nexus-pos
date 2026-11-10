-- ==============================================================================
-- CONSOLIDATED RESTAURANT OS BACKEND FOUNDATION (PHASE 1)
-- Fully Idempotent, Safe Against Missing Legacy Columns, Single Execution
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- PART 0: ENSURE PREREQUISITE COLUMNS ON CORE CATALOG & TABLES
-- ==============================================================================

-- Ensure menu_items has preparation_time and availability
ALTER TABLE menu_items 
    ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS preparation_time INTEGER DEFAULT 15,
    ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

-- Ensure restaurants has tax_rate and active status
ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 16.00,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'PKR';

-- Ensure tables has waiter assignment, customer count, occupied timestamp, and version
ALTER TABLE tables
    ADD COLUMN IF NOT EXISTS current_waiter_id UUID,
    ADD COLUMN IF NOT EXISTS customer_count INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS occupied_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_qr_active BOOLEAN DEFAULT true;

-- Ensure orders allows NULL table_id (required for delivery & takeaway orders)
ALTER TABLE orders ALTER COLUMN table_id DROP NOT NULL;

ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS order_type VARCHAR(32) DEFAULT 'dine_in',
    ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS delivery_address TEXT,
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid',
    ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'pos',
    ADD COLUMN IF NOT EXISTS client_order_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_client_order_id 
    ON orders(restaurant_id, client_order_id) 
    WHERE client_order_id IS NOT NULL;

-- Ensure staff role constraint supports delivery and rider roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff') THEN
        ALTER TABLE staff ALTER COLUMN pin TYPE TEXT;
        ALTER TABLE staff ALTER COLUMN temp_pin TYPE TEXT;
        ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
        ALTER TABLE staff ADD CONSTRAINT staff_role_check
            CHECK (role IN ('owner', 'manager', 'waiter', 'kitchen', 'cashier', 'delivery', 'rider'));
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- ==============================================================================
-- PART 1: IMMUTABLE ORDER SNAPSHOTS & DATA INTEGRITY
-- ==============================================================================

-- 1a. Safely drop existing foreign key on order_items.menu_item_id and re-add as ON DELETE SET NULL
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'order_items'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'menu_item_id'
    ) LOOP
        EXECUTE 'ALTER TABLE order_items DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Make menu_item_id nullable so deleting a menu item preserves historical sales records
ALTER TABLE order_items ALTER COLUMN menu_item_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'order_items' AND constraint_name = 'order_items_menu_item_id_fkey'
    ) THEN
        ALTER TABLE order_items
            ADD CONSTRAINT order_items_menu_item_id_fkey
            FOREIGN KEY (menu_item_id)
            REFERENCES menu_items(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- 1b. Add snapshot columns and kitchen lifecycle to order_items
ALTER TABLE order_items 
    ADD COLUMN IF NOT EXISTS item_name_snapshot VARCHAR(255),
    ADD COLUMN IF NOT EXISTS variant_name_snapshot VARCHAR(255),
    ADD COLUMN IF NOT EXISTS unit_cost_snapshot DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS tax_rate_snapshot DECIMAL(5,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS tax_amount_snapshot DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS kitchen_status VARCHAR(32) DEFAULT 'queued',
    ADD COLUMN IF NOT EXISTS special_instructions TEXT,
    ADD COLUMN IF NOT EXISTS customizations JSONB DEFAULT '[]';

DO $$
BEGIN
    ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_kitchen_status_check;
    ALTER TABLE order_items
        ADD CONSTRAINT order_items_kitchen_status_check
        CHECK (kitchen_status IN ('hold', 'fired', 'cooking', 'plated', 'served', 'void_pending', 'voided'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 1c. Backfill existing order_items rows using safe CTE (No direct column reference to unmigrated cost_price)
WITH item_data AS (
    SELECT 
        oi.id AS order_item_id,
        COALESCE(mi.name, 'Custom Item') AS item_name,
        COALESCE(r.tax_rate, 0.00) AS tax_rate,
        ROUND((oi.subtotal * COALESCE(r.tax_rate, 0.00) / 100), 2) AS tax_amount
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN restaurants r ON r.id = o.restaurant_id
    LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
)
UPDATE order_items oi
SET 
    item_name_snapshot = COALESCE(oi.item_name_snapshot, idata.item_name, 'Custom Item'),
    tax_rate_snapshot = COALESCE(oi.tax_rate_snapshot, idata.tax_rate, 0.00),
    tax_amount_snapshot = COALESCE(oi.tax_amount_snapshot, idata.tax_amount, 0.00),
    unit_cost_snapshot = COALESCE(oi.unit_cost_snapshot, 0.00),
    kitchen_status = CASE 
        WHEN oi.kitchen_status IS NOT NULL AND oi.kitchen_status IN ('hold', 'fired', 'cooking', 'plated', 'served', 'void_pending', 'voided') 
            THEN oi.kitchen_status
        WHEN oi.status = 'pending' THEN 'fired'
        WHEN oi.status = 'preparing' THEN 'cooking'
        WHEN oi.status = 'ready' THEN 'plated'
        WHEN oi.status = 'served' THEN 'served'
        ELSE 'queued'
    END
FROM item_data idata
WHERE oi.id = idata.order_item_id
  AND (oi.item_name_snapshot IS NULL OR oi.kitchen_status IS NULL);

UPDATE order_items
SET item_name_snapshot = COALESCE(item_name_snapshot, 'Custom Item')
WHERE item_name_snapshot IS NULL;

ALTER TABLE order_items ALTER COLUMN item_name_snapshot SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_kitchen ON order_items(order_id, kitchen_status);

-- 1d. Create order_item_modifiers table for immutable modifier selections
CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_option_id UUID,
    modifier_name_snapshot VARCHAR(255) NOT NULL,
    price_modifier_snapshot DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_item ON order_item_modifiers(order_item_id);
ALTER TABLE order_item_modifiers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Staff member access modifiers" ON order_item_modifiers;
    CREATE POLICY "Staff member access modifiers" ON order_item_modifiers FOR ALL
        USING (true) WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- PART 2: UNIFIED DELIVERY, REGISTER SHIFTS & TRANSACTIONAL EVENT OUTBOX
-- ==============================================================================

-- 2a. Unified delivery_assignments table
CREATE TABLE IF NOT EXISTS delivery_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    delivery_address TEXT NOT NULL,
    delivery_lat DECIMAL(10, 8),
    delivery_lng DECIMAL(11, 8),
    pickup_lat DECIMAL(10, 8),
    pickup_lng DECIMAL(11, 8),
    status VARCHAR(50) DEFAULT 'pending_dispatch',
    assigned_at TIMESTAMPTZ,
    actual_pickup_time TIMESTAMPTZ,
    estimated_delivery_time TIMESTAMPTZ,
    actual_delivery_time TIMESTAMPTZ,
    notes TEXT,
    cancel_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE delivery_assignments 
    ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS actual_minutes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS distance_km DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS customer_feedback TEXT,
    ADD COLUMN IF NOT EXISTS rating INTEGER,
    ADD COLUMN IF NOT EXISTS cod_amount_collected DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS cod_settled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS cod_settled_at TIMESTAMPTZ;

UPDATE delivery_assignments
SET status = CASE 
    WHEN status IN ('pending', 'ready_pickup', 'ready') THEN 'pending_dispatch'
    WHEN status = 'in_transit' THEN 'en_route'
    WHEN status = 'failed' THEN 'dispatch_exception'
    WHEN status IN ('assigned', 'picked_up', 'en_route', 'arrived', 'delivered', 'dispatch_exception', 'cancelled') THEN status
    ELSE 'pending_dispatch'
END;

DO $$
BEGIN
    ALTER TABLE delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_status_check;
    ALTER TABLE delivery_assignments
        ADD CONSTRAINT delivery_assignments_status_check
        CHECK (status IN (
            'pending_dispatch',
            'assigned',
            'picked_up',
            'en_route',
            'arrived',
            'delivered',
            'dispatch_exception',
            'cancelled'
        ));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_assignments_cod 
    ON delivery_assignments(rider_id, cod_settled, status);

-- 2b. Register shifts & cash drawer management (Z-Reports)
CREATE TABLE IF NOT EXISTS cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_restaurant ON cash_registers(restaurant_id);

CREATE TABLE IF NOT EXISTS register_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE RESTRICT,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    status VARCHAR(32) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'reconciled')),
    opening_float DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    closing_counted_cash DECIMAL(12,2),
    expected_cash DECIMAL(12,2),
    cash_difference DECIMAL(12,2),
    total_sales_cash DECIMAL(12,2) DEFAULT 0.00,
    total_sales_card DECIMAL(12,2) DEFAULT 0.00,
    total_sales_mobile DECIMAL(12,2) DEFAULT 0.00,
    total_tax_collected DECIMAL(12,2) DEFAULT 0.00,
    total_refunds DECIMAL(12,2) DEFAULT 0.00,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_register_shifts_restaurant_status 
    ON register_shifts(restaurant_id, status, opened_at DESC);

CREATE TABLE IF NOT EXISTS cash_drawer_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES register_shifts(id) ON DELETE CASCADE,
    movement_type VARCHAR(32) NOT NULL CHECK (movement_type IN ('pay_in', 'pay_out', 'drop', 'petty_cash')),
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    authorized_by UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON cash_drawer_movements(shift_id);

-- 2c. Operational support tables (Waste, Idempotency, Outbox, Logs, Alerts)
CREATE TABLE IF NOT EXISTS waste_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    cost_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_cost_wasted DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    reason VARCHAR(255) NOT NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waste_records_restaurant ON waste_records(restaurant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    key_hash VARCHAR(64) NOT NULL,
    request_path VARCHAR(255) NOT NULL,
    response_status INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    UNIQUE(restaurant_id, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_keys(restaurant_id, key_hash, expires_at);

CREATE TABLE IF NOT EXISTS restaurant_events (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_sync ON restaurant_events(restaurant_id, id ASC);

CREATE TABLE IF NOT EXISTS kitchen_order_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'cancelled')),
    received_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    served_at TIMESTAMPTZ,
    prep_time_seconds INTEGER DEFAULT 0,
    actual_prep_time_seconds INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_queue_restaurant_status 
    ON kitchen_order_queue(restaurant_id, status);

CREATE TABLE IF NOT EXISTS cashier_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) DEFAULT 'sale' CHECK (transaction_type IN ('sale', 'refund', 'discount', 'void')),
    amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    action_details JSONB DEFAULT '{}',
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    from_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    to_staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    alert_type VARCHAR(30) NOT NULL,
    title VARCHAR(100) NOT NULL,
    message TEXT,
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    is_read BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    related_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- PART 3: ATOMIC STORED PROCEDURES (ACID TRANSACTIONS)
-- ==============================================================================

-- 3a. Daily sequential order numbering with 4-hour midnight rollover
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

-- 3b. Atomic table seating with optimistic concurrency
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

-- 3c. Atomic order creation with server price verification, snapshots & outbox
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

    -- Idempotency check via client_order_id
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

    -- Validate restaurant status
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

    -- Handle Dine-in Table Locking
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

    -- Validate Items Array
    v_items := p_payload->'items';
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order must contain at least one item');
    END IF;

    -- First Pass: Authoritative Price Calculation from menu_items table
    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_items) AS x(
        menu_item_id UUID,
        quantity INTEGER,
        special_instructions TEXT,
        modifiers JSONB
    ) LOOP
        SELECT id, name, price, is_available, preparation_time INTO v_menu_item
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

    -- Generate Daily Order Number
    v_order_number := generate_daily_order_number(v_restaurant_id);

    -- Insert Order Header
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

    -- Second Pass: Insert Order Items with Snapshots & Modifiers
    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_items) AS x(
        menu_item_id UUID,
        quantity INTEGER,
        special_instructions TEXT,
        modifiers JSONB
    ) LOOP
        SELECT id, name, price INTO v_menu_item
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
            0.00,
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

        -- Lightweight Recipe Inventory Deduction
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_item_ingredients') THEN
            UPDATE inventory inv
            SET current_stock = inv.current_stock - (mii.quantity_required * v_item_qty),
                updated_at = NOW()
            FROM menu_item_ingredients mii
            WHERE mii.inventory_id = inv.id
              AND mii.menu_item_id = v_menu_item.id;
        END IF;
    END LOOP;

    -- Delivery Assignment Record
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

    -- Kitchen Queue Integration
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

    -- Transactional Event Outbox Emission
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

-- 3d. Item fire and void protocol with kitchen waste auditing
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

    UPDATE order_items
    SET kitchen_status = 'voided',
        status = 'served'
    WHERE id = p_order_item_id;

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

-- ==============================================================================
-- PART 4: ZERO-TRUST RBAC / RLS & AI ACTION PROPOSALS
-- ==============================================================================

-- 4a. Create table for Human-In-The-Loop AI Action Proposals
CREATE TABLE IF NOT EXISTS ai_action_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    skill_name VARCHAR(64) NOT NULL,
    proposal_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
    confidence_score DECIMAL(4,3) NOT NULL,
    reasoning TEXT NOT NULL,
    proposed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    reviewed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_proposals_status 
    ON ai_action_proposals(restaurant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_proposals_skill 
    ON ai_action_proposals(restaurant_id, skill_name);

ALTER TABLE ai_action_proposals ENABLE ROW LEVEL SECURITY;

-- 4b. Helper functions to retrieve staff role in current session
CREATE OR REPLACE FUNCTION get_current_staff_role(p_restaurant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_role VARCHAR;
BEGIN
    IF EXISTS (
        SELECT 1 FROM restaurants 
        WHERE id = p_restaurant_id AND owner_id = auth.uid()
    ) THEN
        RETURN 'owner';
    END IF;

    SELECT role INTO v_role
    FROM staff
    WHERE restaurant_id = p_restaurant_id
      AND user_id = auth.uid()
      AND is_active = true
    LIMIT 1;

    RETURN COALESCE(v_role, 'anonymous');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4c. Strict RLS on Expenses (Owner & Manager ONLY)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Owner and Manager can view expenses" ON expenses;
        DROP POLICY IF EXISTS "Owner and Manager can insert expenses" ON expenses;
        DROP POLICY IF EXISTS "Owner and Manager can update expenses" ON expenses;
        DROP POLICY IF EXISTS "Owner and Manager can delete expenses" ON expenses;

        CREATE POLICY "Owner and Manager can view expenses" ON expenses
            FOR SELECT USING (get_current_staff_role(restaurant_id) IN ('owner', 'manager'));

        CREATE POLICY "Owner and Manager can insert expenses" ON expenses
            FOR INSERT WITH CHECK (get_current_staff_role(restaurant_id) IN ('owner', 'manager'));

        CREATE POLICY "Owner and Manager can update expenses" ON expenses
            FOR UPDATE USING (get_current_staff_role(restaurant_id) IN ('owner', 'manager'));

        CREATE POLICY "Owner and Manager can delete expenses" ON expenses
            FOR DELETE USING (get_current_staff_role(restaurant_id) IN ('owner', 'manager'));
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 4d. Strict RLS on Cash Registers, Register Shifts & Drawer Movements (Owner, Manager, Cashier)
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE register_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_drawer_movements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Cashier and above view registers" ON cash_registers;
    DROP POLICY IF EXISTS "Cashier and above view shifts" ON register_shifts;
    DROP POLICY IF EXISTS "Cashier and above operate shifts" ON register_shifts;
    DROP POLICY IF EXISTS "Cashier and above record drawer movements" ON cash_drawer_movements;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Cashier and above view registers" ON cash_registers
    FOR SELECT USING (get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier'));

CREATE POLICY "Cashier and above view shifts" ON register_shifts
    FOR SELECT USING (get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier'));

CREATE POLICY "Cashier and above operate shifts" ON register_shifts
    FOR ALL USING (get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier'));

CREATE POLICY "Cashier and above record drawer movements" ON cash_drawer_movements
    FOR ALL USING (get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier'));

-- 4e. Strict RLS on Waste Records (Owner, Manager, Kitchen)
ALTER TABLE waste_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Kitchen and management view waste" ON waste_records;
    DROP POLICY IF EXISTS "Kitchen and management record waste" ON waste_records;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Kitchen and management view waste" ON waste_records
    FOR SELECT USING (get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'kitchen'));

CREATE POLICY "Kitchen and management record waste" ON waste_records
    FOR INSERT WITH CHECK (get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'kitchen'));

-- 4f. Strict RLS on Delivery Assignments (Rider isolation, Dispatch management)
ALTER TABLE delivery_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Staff and riders view deliveries" ON delivery_assignments;
    DROP POLICY IF EXISTS "Staff and riders update deliveries" ON delivery_assignments;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Staff and riders view deliveries" ON delivery_assignments
    FOR SELECT USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier')
        OR (
            get_current_staff_role(restaurant_id) IN ('rider', 'delivery')
            AND (
                rider_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
                OR status = 'pending_dispatch'
            )
        )
    );

CREATE POLICY "Staff and riders update deliveries" ON delivery_assignments
    FOR UPDATE USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier')
        OR (
            get_current_staff_role(restaurant_id) IN ('rider', 'delivery')
            AND rider_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
        )
    );

-- 4g. Strict RLS on AI Action Proposals (Owner and Manager ONLY)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Owner and Manager manage AI proposals" ON ai_action_proposals;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Owner and Manager manage AI proposals" ON ai_action_proposals
    FOR ALL USING (get_current_staff_role(restaurant_id) IN ('owner', 'manager'));

-- 4h. Strict RLS on Transactional Outbox restaurant_events
ALTER TABLE restaurant_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Restaurant staff read outbox events" ON restaurant_events;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Restaurant staff read outbox events" ON restaurant_events
    FOR SELECT USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier', 'waiter', 'kitchen', 'rider', 'delivery')
    );

-- ==============================================================================
-- PART 5: SCALABLE HIGH-THROUGHPUT ENGINE RPCS
-- ==============================================================================

-- 5a. Atomic payment settlement with shift reconciliation & table release
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

    -- Lock order row
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

    -- Update Order
    UPDATE orders
    SET status = CASE WHEN v_new_status = 'paid' THEN 'paid' ELSE status END,
        payment_status = CASE WHEN v_new_status = 'paid' THEN 'paid' ELSE 'partial' END,
        payment_method = v_payment_method,
        amount_paid = v_total_paid,
        discount = COALESCE(v_order.discount, 0.00) + v_discount,
        paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE paid_at END,
        updated_at = NOW()
    WHERE id = v_order_id;

    -- Record Cashier Transaction
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

    -- Update Active Register Shift Ledger
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

    -- Release Table if Fully Settled
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
        UPDATE tables
        SET status = 'billing',
            version = COALESCE(version, 1) + 1,
            updated_at = NOW()
        WHERE id = v_order.table_id;
    END IF;

    -- Record Outbox Event
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

-- 5b. Atomic table transfer
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

    SELECT * INTO v_order
    FROM orders
    WHERE table_id = p_from_table_id
      AND status NOT IN ('paid', 'cancelled')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_order IS NOT NULL THEN
        UPDATE orders
        SET table_id = p_to_table_id,
            updated_at = NOW()
        WHERE id = v_order.id;
    END IF;

    UPDATE tables
    SET status = 'occupied',
        current_waiter_id = COALESCE(v_from_table.current_waiter_id, p_staff_id),
        customer_count = v_from_table.customer_count,
        occupied_at = COALESCE(v_from_table.occupied_at, NOW()),
        version = COALESCE(version, 1) + 1,
        updated_at = NOW()
    WHERE id = p_to_table_id;

    UPDATE tables
    SET status = 'available',
        current_waiter_id = NULL,
        customer_count = 1,
        occupied_at = NULL,
        version = COALESCE(version, 1) + 1,
        updated_at = NOW()
    WHERE id = p_from_table_id;

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

-- 5c. Atomic KDS item status advancement with order auto-ready
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

    UPDATE order_items
    SET kitchen_status = p_new_status,
        status = CASE 
            WHEN p_new_status = 'cooking' THEN 'preparing'
            WHEN p_new_status IN ('plated', 'ready') THEN 'ready'
            WHEN p_new_status = 'served' THEN 'served'
            ELSE status
        END
    WHERE id = p_order_item_id;

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

-- 5d. Atomic table merge
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

    IF p_source_table_id < p_target_table_id THEN
        SELECT * INTO v_source_table FROM tables WHERE id = p_source_table_id FOR UPDATE;
        SELECT * INTO v_target_table FROM tables WHERE id = p_target_table_id FOR UPDATE;
    ELSE
        SELECT * INTO v_target_table FROM tables WHERE id = p_target_table_id FOR UPDATE;
        SELECT * INTO v_source_table FROM tables WHERE id = p_source_table_id FOR UPDATE;
    END IF;

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
        UPDATE order_items
        SET order_id = v_target_order.id
        WHERE order_id = v_source_order.id;

        UPDATE orders
        SET subtotal = v_target_order.subtotal + v_source_order.subtotal,
            tax = v_target_order.tax + v_source_order.tax,
            total = v_target_order.total + v_source_order.total,
            updated_at = NOW()
        WHERE id = v_target_order.id;

        UPDATE orders
        SET status = 'cancelled',
            notes = COALESCE(notes, '') || ' [Merged into Order #' || v_target_order.order_number || ']',
            updated_at = NOW()
        WHERE id = v_source_order.id;
    ELSIF v_source_order IS NOT NULL AND v_target_order IS NULL THEN
        UPDATE orders
        SET table_id = p_target_table_id,
            updated_at = NOW()
        WHERE id = v_source_order.id;
    END IF;

    UPDATE tables
    SET customer_count = COALESCE(customer_count, 1) + COALESCE(v_source_table.customer_count, 1),
        version = COALESCE(version, 1) + 1,
        updated_at = NOW()
    WHERE id = p_target_table_id;

    UPDATE tables
    SET status = 'available',
        current_waiter_id = NULL,
        customer_count = 1,
        occupied_at = NULL,
        version = COALESCE(version, 1) + 1,
        updated_at = NOW()
    WHERE id = p_source_table_id;

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

-- 5e. Atomic delivery status & COD wallet update
CREATE OR REPLACE FUNCTION update_delivery_status_atomic(
    p_delivery_id UUID,
    p_new_status VARCHAR(50),
    p_rider_id UUID,
    p_cod_collected DECIMAL(10,2) DEFAULT 0.00,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_delivery RECORD;
    v_event_id BIGINT;
BEGIN
    SELECT * INTO v_delivery
    FROM delivery_assignments
    WHERE id = p_delivery_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Delivery assignment not found');
    END IF;

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


