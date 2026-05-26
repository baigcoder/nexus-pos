-- ============================================
-- Add missing staff columns and role values
-- ============================================

-- Add columns that the staff invite API expects
ALTER TABLE staff ADD COLUMN IF NOT EXISTS temp_pin TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS needs_setup BOOLEAN DEFAULT true;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

-- Note: The schema already has 'owner', 'manager', 'waiter', 'kitchen', 'cashier' as valid roles
-- The API also sends 'delivery' and 'rider' roles, so we need to allow those:
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check
    CHECK (role IN ('owner', 'manager', 'waiter', 'kitchen', 'cashier', 'delivery', 'rider'));