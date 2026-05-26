-- ============================================
-- Delivery System - Only create what's missing
-- Run this AFTER rider_locations.sql
-- ============================================

-- Create delivery_assignments table if not exists
CREATE TABLE IF NOT EXISTS delivery_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES staff(id) ON DELETE SET NULL,

    -- Customer Info
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    delivery_address TEXT NOT NULL,
    delivery_lat DECIMAL(10, 8),
    delivery_lng DECIMAL(11, 8),

    -- Restaurant Location (for pickup)
    pickup_lat DECIMAL(10, 8),
    pickup_lng DECIMAL(11, 8),

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending'
        CHECK (status IN ('pending', 'assigned', 'ready_pickup', 'picked_up', 'en_route', 'arrived', 'delivered', 'cancelled')),

    -- Timestamps
    assigned_at TIMESTAMPTZ,
    actual_pickup_time TIMESTAMPTZ,
    estimated_delivery_time TIMESTAMPTZ,
    actual_delivery_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Notes
    notes TEXT,
    cancel_reason TEXT
);

-- Create rider_location_history if not exists
CREATE TABLE IF NOT EXISTS rider_location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2),
    heading DECIMAL(5, 2),
    speed DECIMAL(6, 2),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create delivery_zones if not exists
CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_delivery_fee DECIMAL(10, 2) DEFAULT 0,
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    estimated_delivery_minutes INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES (will skip if exists)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_restaurant ON delivery_assignments(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order ON delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_rider ON delivery_assignments(rider_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON delivery_assignments(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_rider_location_history_rider ON rider_location_history(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_location_history_order ON rider_location_history(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_restaurant ON delivery_zones(restaurant_id);

-- ============================================
-- RLS POLICIES (will skip if exists)
-- ============================================
ALTER TABLE delivery_assignments ENABLE ROW LEVEL SECURITY;

-- Use DO block to safely create policies if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'delivery_assignments' AND policyname = 'Restaurant staff can view delivery assignments') THEN
        CREATE POLICY "Restaurant staff can view delivery assignments" ON delivery_assignments
            FOR SELECT USING (
                restaurant_id IN (
                    SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
                    UNION
                    SELECT id FROM restaurants WHERE owner_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'delivery_assignments' AND policyname = 'Restaurant owners can manage delivery assignments') THEN
        CREATE POLICY "Restaurant owners can manage delivery assignments" ON delivery_assignments
            FOR ALL USING (
                restaurant_id IN (
                    SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
                    UNION
                    SELECT id FROM restaurants WHERE owner_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'delivery_assignments' AND policyname = 'Riders can update own delivery assignments') THEN
        CREATE POLICY "Riders can update own delivery assignments" ON delivery_assignments
            FOR UPDATE USING (rider_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'delivery_assignments' AND policyname = 'Public can view delivery status') THEN
        CREATE POLICY "Public can view delivery status" ON delivery_assignments
            FOR SELECT USING (true);
    END IF;
END $$;

-- Enable and set up policies for rider_location_history
ALTER TABLE rider_location_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rider_location_history' AND policyname = 'Riders can insert own location history') THEN
        CREATE POLICY "Riders can insert own location history" ON rider_location_history
            FOR INSERT WITH CHECK (rider_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rider_location_history' AND policyname = 'Restaurant staff can view location history') THEN
        CREATE POLICY "Restaurant staff can view location history" ON rider_location_history
            FOR SELECT USING (
                rider_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
            );
    END IF;
END $$;

-- Enable and set up policies for delivery_zones
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'delivery_zones' AND policyname = 'Restaurant staff can view delivery zones') THEN
        CREATE POLICY "Restaurant staff can view delivery zones" ON delivery_zones
            FOR SELECT USING (
                restaurant_id IN (
                    SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
                    UNION
                    SELECT id FROM restaurants WHERE owner_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'delivery_zones' AND policyname = 'Restaurant owners can manage delivery zones') THEN
        CREATE POLICY "Restaurant owners can manage delivery zones" ON delivery_zones
            FOR ALL USING (
                restaurant_id IN (
                    SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
                    UNION
                    SELECT id FROM restaurants WHERE owner_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ============================================
-- ENABLE REALTIME (manual step - run in Supabase dashboard)
-- ============================================
-- In Supabase Dashboard > Database > Replication
-- Enable realtime for: delivery_assignments

-- ============================================
-- HELPER FUNCTION: Calculate ETA
-- ============================================
CREATE OR REPLACE FUNCTION calculate_eta(
    p_rider_lat DECIMAL,
    p_rider_lng DECIMAL,
    p_dest_lat DECIMAL,
    p_dest_lng DECIMAL
) RETURNS INTEGER AS $$
DECLARE
    earth_radius DECIMAL := 6371;
    d_lat DECIMAL;
    d_lng DECIMAL;
    a DECIMAL;
    c DECIMAL;
    distance DECIMAL;
    avg_speed DECIMAL := 30;
BEGIN
    d_lat := radians(p_dest_lat - p_rider_lat);
    d_lng := radians(p_dest_lng - p_rider_lng);
    a := sin(d_lat/2) * sin(d_lat/2) +
         cos(radians(p_rider_lat)) * cos(radians(p_dest_lat)) *
         sin(d_lng/2) * sin(d_lng/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    distance := earth_radius * c;
    RETURN ROUND((distance / avg_speed) * 60);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger tg
        JOIN pg_class cl ON tg.tgrelid = cl.oid
        WHERE tg.tgname = 'update_delivery_assignments_updated_at'
        AND cl.relname = 'delivery_assignments'
    ) THEN
        CREATE TRIGGER update_delivery_assignments_updated_at
            BEFORE UPDATE ON delivery_assignments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

COMMENT ON TRIGGER update_delivery_assignments_updated_at ON delivery_assignments IS 'Auto-update updated_at column';