-- ============================================
-- Staff RLS Policies
-- Allow staff members to view and update staff records
-- ============================================

-- Drop existing staff policies to recreate them properly
DROP POLICY IF EXISTS "Staff can view staff records" ON staff;
DROP POLICY IF EXISTS "Staff can update staff records" ON staff;
DROP POLICY IF EXISTS "Staff can insert staff records" ON staff;

-- View: Anyone linked to restaurant can see staff
CREATE POLICY "Staff can view staff records" ON staff
    FOR SELECT USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        ) OR
        -- Staff can see other staff in same restaurant (based on user_id link)
        user_id = auth.uid()
    );

-- Update: Restaurant owner or managers can update staff
CREATE POLICY "Staff can update staff records" ON staff
    FOR UPDATE USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

-- Insert: Staff can be created (used by invite API)
CREATE POLICY "Staff can insert staff records" ON staff
    FOR INSERT WITH CHECK (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );