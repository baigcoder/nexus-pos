-- ============================================
-- Split Payments Table for Bill Splitting
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SPLIT PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS split_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    split_number INTEGER NOT NULL,  -- 1, 2, 3, etc. for each split
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),  -- 'cash', 'card', 'mobile', etc.
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    items JSONB DEFAULT '[]',  -- Array of order_item_ids included in this split (for split-by-items)
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_split_payments_order ON split_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_split_payments_status ON split_payments(order_id, payment_status);

-- Enable RLS
ALTER TABLE split_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view split payments" ON split_payments
    FOR SELECT USING (
        order_id IN (
            SELECT id FROM orders WHERE restaurant_id IN (
                SELECT id FROM restaurants WHERE owner_id = auth.uid()
            )
        )
    );

CREATE POLICY "Staff can manage split payments" ON split_payments
    FOR ALL USING (
        order_id IN (
            SELECT id FROM orders WHERE restaurant_id IN (
                SELECT id FROM restaurants WHERE owner_id = auth.uid()
            )
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_split_payments_updated_at BEFORE UPDATE ON split_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFY STAFF PIN RPC FUNCTION
-- For staff login without full auth
-- ============================================
CREATE OR REPLACE FUNCTION verify_staff_pin(
    p_restaurant_slug TEXT,
    p_pin TEXT
) RETURNS TABLE (
    staff_id UUID,
    restaurant_id UUID,
    staff_name TEXT,
    staff_role TEXT,
    restaurant_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.restaurant_id,
        s.name,
        s.role::TEXT,
        r.name
    FROM staff s
    JOIN restaurants r ON r.id = s.restaurant_id
    WHERE r.slug = p_restaurant_slug
    AND s.pin = p_pin
    AND s.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anonymous users (for staff login)
-- GRANT EXECUTE ON FUNCTION verify_staff_pin TO anon;
