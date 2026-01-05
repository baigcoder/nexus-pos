-- Staff Onboarding Fields Migration
-- Adds fields needed for the staff invitation and onboarding flow

-- Add new columns to staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS needs_setup BOOLEAN DEFAULT TRUE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS temp_pin VARCHAR(6);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;

-- Update existing staff to not need setup (they already have PINs)
UPDATE staff SET needs_setup = FALSE WHERE pin IS NOT NULL AND pin != '';

-- Create index for email lookups during login
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_temp_pin ON staff(temp_pin);
