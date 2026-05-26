-- ============================================
-- Rider Locations Table
-- For live GPS tracking of delivery riders
-- ============================================

CREATE TABLE IF NOT EXISTS rider_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    is_online BOOLEAN DEFAULT true,
    battery_level INTEGER,
    accuracy DECIMAL(6, 2),
    heading DECIMAL(5, 2),
    speed DECIMAL(6, 2),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(rider_id, restaurant_id)
);

-- Indexes
CREATE INDEX idx_rider_locations_rider ON rider_locations(rider_id);
CREATE INDEX idx_rider_locations_restaurant ON rider_locations(restaurant_id);
CREATE INDEX idx_rider_locations_online ON rider_locations(restaurant_id, is_online);

-- RLS
ALTER TABLE rider_locations ENABLE ROW LEVEL SECURITY;

-- Allow staff to update their own location
CREATE POLICY "Riders can update own location" ON rider_locations
    FOR UPDATE USING (auth.uid() = rider_id);

-- Allow restaurant owners/managers to read all rider locations
CREATE POLICY "Restaurant staff can view rider locations" ON rider_locations
    FOR SELECT USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
            UNION
            SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
        )
    );

-- Enable realtime
DO $$
BEGIN
    -- Note: Enable realtime manually in Supabase Dashboard > Database > Replication
    -- for tables: rider_locations
END $$;