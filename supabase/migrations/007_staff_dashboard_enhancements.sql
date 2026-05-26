-- ============================================
-- Staff Dashboard Enhancement Migration
-- ============================================

-- Add soft delete (archive) support
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Add last login tracking
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add shift assignment
ALTER TABLE staff ADD COLUMN IF NOT EXISTS shift VARCHAR(20) CHECK (shift IN ('morning', 'evening', 'night', 'full_time', 'part_time'));

-- Add emergency contact
ALTER TABLE staff ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

-- Add hire date (separate from created_at)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS hire_date DATE;

-- Add admin-only notes
ALTER TABLE staff ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_staff_archived ON staff(is_archived);
CREATE INDEX IF NOT EXISTS idx_staff_shift ON staff(shift);
CREATE INDEX IF NOT EXISTS idx_staff_hire_date ON staff(hire_date);

-- Update existing rows: set hire_date to created_at date if null
UPDATE staff SET hire_date = created_at::DATE WHERE hire_date IS NULL;

-- Update existing rows: set shift to full_time if null
UPDATE staff SET shift = 'full_time' WHERE shift IS NULL;

COMMENT ON COLUMN staff.is_archived IS 'Soft delete flag — true means archived/hidden from active list';
COMMENT ON COLUMN staff.last_login_at IS 'Timestamp of most recent successful login';
COMMENT ON COLUMN staff.shift IS 'Work shift: morning, evening, night, full_time, part_time';
COMMENT ON COLUMN staff.emergency_contact IS 'Emergency contact info (name + phone)';
COMMENT ON COLUMN staff.hire_date IS 'Official hire date, used for tenure calculation';
COMMENT ON COLUMN staff.admin_notes IS 'Private manager notes, not visible to staff';
