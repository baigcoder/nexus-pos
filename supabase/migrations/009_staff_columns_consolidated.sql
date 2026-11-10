-- ============================================
-- Consolidated Staff Columns Migration (Idempotent)
-- Fixes 500s on /api/staff/invite and /api/auth/staff-email-login
-- caused by missing columns / undersized pin columns on existing DBs.
-- Safe to run multiple times.
-- ============================================

-- PIN columns must fit bcrypt hashes (60 chars) — widen any legacy VARCHAR(6/10)
ALTER TABLE staff ALTER COLUMN pin TYPE TEXT;
ALTER TABLE staff ALTER COLUMN temp_pin TYPE TEXT;

-- Columns used by invite / login / setup / staff management flows
ALTER TABLE staff ADD COLUMN IF NOT EXISTS temp_pin TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS needs_setup BOOLEAN DEFAULT true;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS shift VARCHAR(20);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Roles must include delivery/rider (legacy CHECK only allowed 5 roles)
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check
    CHECK (role IN ('owner', 'manager', 'waiter', 'kitchen', 'cashier', 'delivery', 'rider'));

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_restaurant_active ON staff(restaurant_id, is_active);
