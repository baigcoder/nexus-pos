-- ============================================
-- Live GPS Tracking System
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;

-- Rider locations table (current position)
CREATE TABLE IF NOT EXISTS rider_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rider_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2), -- GPS accuracy in meters
    heading DECIMAL(5, 2), -- Direction in degrees (0-360)
    speed DECIMAL(10, 2), -- Speed in km/h
    is_online BOOLEAN DEFAULT true,
    battery_level INTEGER, -- 0-100
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(rider_id)
);

-- Location history for tracking routes
CREATE TABLE IF NOT EXISTS rider_location_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rider_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2),
    heading DECIMAL(5, 2),
    speed DECIMAL(10, 2),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery assignments table
CREATE TABLE IF NOT EXISTS delivery_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'picked_up', 'en_route', 'arrived', 'delivered', 'cancelled')),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    delivery_address TEXT NOT NULL,
    delivery_lat DECIMAL(10, 8),
    delivery_lng DECIMAL(11, 8),
    pickup_lat DECIMAL(10, 8),
    pickup_lng DECIMAL(11, 8),
    estimated_pickup_time TIMESTAMPTZ,
    actual_pickup_time TIMESTAMPTZ,
    estimated_delivery_time TIMESTAMPTZ,
    actual_delivery_time TIMESTAMPTZ,
    distance_km DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rider_locations_rider ON rider_locations(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_locations_restaurant ON rider_locations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_rider_locations_updated ON rider_locations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_history_rider ON rider_location_history(rider_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_history_order ON rider_location_history(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order ON delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_rider ON delivery_assignments(rider_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON delivery_assignments(status);

-- Enable RLS
ALTER TABLE rider_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rider_locations
CREATE POLICY "Service role full access" ON rider_locations FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for location_history  
CREATE POLICY "Service role full access" ON rider_location_history FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for delivery_assignments
CREATE POLICY "Restaurant owner access" ON delivery_assignments
FOR ALL USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
);

-- Enable realtime for live tracking
ALTER PUBLICATION supabase_realtime ADD TABLE rider_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_assignments;

-- Function to update rider location
CREATE OR REPLACE FUNCTION update_rider_location(
    p_rider_id UUID,
    p_lat DECIMAL,
    p_lng DECIMAL,
    p_accuracy DECIMAL DEFAULT NULL,
    p_heading DECIMAL DEFAULT NULL,
    p_speed DECIMAL DEFAULT NULL,
    p_battery INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_restaurant_id UUID;
BEGIN
    -- Get restaurant ID for the rider
    SELECT restaurant_id INTO v_restaurant_id FROM staff WHERE id = p_rider_id;
    
    -- Upsert current location
    INSERT INTO rider_locations (rider_id, restaurant_id, latitude, longitude, accuracy, heading, speed, battery_level, updated_at)
    VALUES (p_rider_id, v_restaurant_id, p_lat, p_lng, p_accuracy, p_heading, p_speed, p_battery, NOW())
    ON CONFLICT (rider_id) 
    DO UPDATE SET 
        latitude = p_lat,
        longitude = p_lng,
        accuracy = COALESCE(p_accuracy, rider_locations.accuracy),
        heading = COALESCE(p_heading, rider_locations.heading),
        speed = COALESCE(p_speed, rider_locations.speed),
        battery_level = COALESCE(p_battery, rider_locations.battery_level),
        updated_at = NOW(),
        is_online = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record location history for an active delivery
CREATE OR REPLACE FUNCTION record_delivery_location(
    p_rider_id UUID,
    p_order_id UUID,
    p_lat DECIMAL,
    p_lng DECIMAL,
    p_accuracy DECIMAL DEFAULT NULL,
    p_heading DECIMAL DEFAULT NULL,
    p_speed DECIMAL DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO rider_location_history (rider_id, order_id, latitude, longitude, accuracy, heading, speed)
    VALUES (p_rider_id, p_order_id, p_lat, p_lng, p_accuracy, p_heading, p_speed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate ETA using simple distance/speed formula
CREATE OR REPLACE FUNCTION calculate_eta(
    p_rider_lat DECIMAL,
    p_rider_lng DECIMAL,
    p_dest_lat DECIMAL,
    p_dest_lng DECIMAL,
    p_avg_speed_kmh DECIMAL DEFAULT 25 -- Average delivery speed
)
RETURNS INTEGER AS $$ -- Returns minutes
DECLARE
    v_distance_km DECIMAL;
BEGIN
    -- Haversine formula for distance
    v_distance_km := 6371 * 2 * ASIN(
        SQRT(
            POWER(SIN(RADIANS(p_dest_lat - p_rider_lat) / 2), 2) +
            COS(RADIANS(p_rider_lat)) * COS(RADIANS(p_dest_lat)) *
            POWER(SIN(RADIANS(p_dest_lng - p_rider_lng) / 2), 2)
        )
    );
    
    -- Return ETA in minutes
    RETURN CEIL((v_distance_km / p_avg_speed_kmh) * 60);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Updated timestamp trigger
CREATE TRIGGER update_delivery_assignments_updated_at 
BEFORE UPDATE ON delivery_assignments 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
