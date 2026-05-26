-- ============================================
-- Fix: Increase pin column size to support bcrypt hashes
-- ============================================
-- The staff login API hashes permanent PINs with bcrypt (60 chars).
-- The original schema used VARCHAR(10) which caused insert failures.
-- This migration alters the column to TEXT to accommodate hashed values.

ALTER TABLE staff ALTER COLUMN pin TYPE TEXT;

-- Also ensure setup_completed_at exists
ALTER TABLE staff ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;

-- Add a comment to document the column purpose
COMMENT ON COLUMN staff.pin IS 'Staff PIN - stored as bcrypt hash (60 chars) or plain text (4 digits) during migration period';
