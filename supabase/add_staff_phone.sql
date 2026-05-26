-- ============================================
-- Add phone column to staff table
-- Fixes: column staff.phone does not exist
-- ============================================

ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone VARCHAR(50);