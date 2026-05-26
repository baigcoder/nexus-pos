-- ============================================
-- OrderFlow: Staff Bonuses & Shift Notifications
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Staff Bonuses Table
CREATE TABLE IF NOT EXISTS staff_bonuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    given_by UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_bonuses_restaurant ON staff_bonuses(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_bonuses_staff ON staff_bonuses(staff_id);

-- 2. Shift Notifications Table
CREATE TABLE IF NOT EXISTS shift_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('scheduled', 'reminder', 'started', 'completed', 'cancelled')),
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shift_notifications_staff ON shift_notifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_shift_notifications_unread ON shift_notifications(staff_id, is_read) WHERE is_read = false;

-- 3. Enable RLS
ALTER TABLE staff_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_notifications ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
DROP POLICY IF EXISTS "Restaurant staff_bonuses access" ON staff_bonuses;
CREATE POLICY "Restaurant staff_bonuses access" ON staff_bonuses FOR ALL USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Restaurant shift_notifications access" ON shift_notifications;
CREATE POLICY "Restaurant shift_notifications access" ON shift_notifications FOR ALL USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
);

-- 5. Trigger to auto-create notification when shift is added
CREATE OR REPLACE FUNCTION notify_new_shift()
RETURNS TRIGGER AS $$
DECLARE
    staff_name TEXT;
BEGIN
    SELECT name INTO staff_name FROM staff WHERE id = NEW.staff_id;
    INSERT INTO shift_notifications (restaurant_id, staff_id, shift_id, type, title, message)
    VALUES (
        NEW.restaurant_id,
        NEW.staff_id,
        NEW.id,
        'scheduled',
        'New Shift Scheduled',
        CONCAT('You have been scheduled for ', COALESCE(staff_name, 'a shift'), ' on ', NEW.shift_date::TEXT, ' from ', COALESCE(NEW.start_time::TEXT, ''), ' to ', COALESCE(NEW.end_time::TEXT, ''))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notify_on_new_shift ON shifts;
CREATE TRIGGER notify_on_new_shift
AFTER INSERT ON shifts
FOR EACH ROW EXECUTE FUNCTION notify_new_shift();

-- ============================================
-- Migration Complete
-- Run the above SQL in Supabase SQL Editor
-- ============================================