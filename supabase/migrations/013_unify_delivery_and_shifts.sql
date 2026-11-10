-- ==============================================================================
-- Migration: 013_unify_delivery_and_shifts.sql
-- Description: Unify delivery state machine and COD reconciliation, introduce
--              cash register shifts (Z-reports), create waste tracking, and
--              build the restaurant_events transactional outbox.
-- ==============================================================================

-- 1. Ensure required schema extensions and table versioning
ALTER TABLE tables ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS order_type VARCHAR(32) DEFAULT 'dine_in',
    ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS delivery_address TEXT,
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid',
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'pos',
    ADD COLUMN IF NOT EXISTS client_order_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_client_order_id 
    ON orders(restaurant_id, client_order_id) 
    WHERE client_order_id IS NOT NULL;

-- 2. UNIFY DELIVERY: Enhance delivery_assignments as the single source of truth
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

-- Add unified columns to delivery_assignments
ALTER TABLE delivery_assignments 
    ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS actual_minutes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS distance_km DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS customer_feedback TEXT,
    ADD COLUMN IF NOT EXISTS rating INTEGER,
    ADD COLUMN IF NOT EXISTS cod_amount_collected DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS cod_settled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS cod_settled_at TIMESTAMPTZ;

-- Migrate legacy statuses to new state machine
UPDATE delivery_assignments
SET status = CASE 
    WHEN status IN ('pending', 'ready_pickup') THEN 'pending_dispatch'
    WHEN status = 'ready' THEN 'pending_dispatch'
    WHEN status = 'in_transit' THEN 'en_route'
    WHEN status = 'failed' THEN 'dispatch_exception'
    WHEN status IN ('assigned', 'picked_up', 'en_route', 'arrived', 'delivered', 'dispatch_exception', 'cancelled') THEN status
    ELSE 'pending_dispatch'
END;

-- Enforce unified delivery state machine check constraint
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

-- Migrate any missing records from legacy delivery_tracking into delivery_assignments
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_tracking') THEN
        INSERT INTO delivery_assignments (
            order_id,
            restaurant_id,
            rider_id,
            customer_name,
            customer_phone,
            delivery_address,
            delivery_lat,
            delivery_lng,
            status,
            actual_pickup_time,
            actual_delivery_time,
            estimated_minutes,
            actual_minutes,
            distance_km,
            customer_feedback,
            rating,
            created_at
        )
        SELECT 
            dt.order_id,
            dt.restaurant_id,
            dt.rider_id,
            COALESCE(o.customer_name, 'Customer'),
            o.customer_phone,
            COALESCE(dt.delivery_address, o.delivery_address, 'N/A'),
            dt.customer_lat,
            dt.customer_lng,
            CASE 
                WHEN dt.status = 'preparing' THEN 'pending_dispatch'
                WHEN dt.status = 'ready' THEN 'pending_dispatch'
                WHEN dt.status = 'picked_up' THEN 'picked_up'
                WHEN dt.status = 'in_transit' THEN 'en_route'
                WHEN dt.status = 'delivered' THEN 'delivered'
                WHEN dt.status = 'failed' THEN 'dispatch_exception'
                ELSE 'pending_dispatch'
            END,
            dt.pickup_time,
            dt.delivery_time,
            COALESCE(dt.estimated_minutes, 30),
            COALESCE(dt.actual_minutes, 0),
            dt.distance_km,
            dt.customer_feedback,
            dt.rating,
            dt.created_at
        FROM delivery_tracking dt
        JOIN orders o ON o.id = dt.order_id
        WHERE NOT EXISTS (
            SELECT 1 FROM delivery_assignments da WHERE da.order_id = dt.order_id
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_assignments_cod 
    ON delivery_assignments(rider_id, cod_settled, status);

-- 3. SHIFTS & CASH DRAWER MANAGEMENT (Z-REPORT SYSTEM)
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

-- 4. KITCHEN WASTE RECORDS
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

-- 5. IDEMPOTENCY KEYS
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

-- 6. TRANSACTIONAL RESTAURANT EVENTS OUTBOX
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

