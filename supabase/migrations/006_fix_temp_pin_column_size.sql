-- ============================================
-- Fix: Increase temp_pin column size to support bcrypt hashes
-- ============================================
-- The staff invite API hashes temporary PINs with bcrypt (60 chars).
-- The original schema used VARCHAR(6) which caused insert failures.
-- This migration alters the column to TEXT to accommodate hashed values.

ALTER TABLE staff ALTER COLUMN temp_pin TYPE TEXT;

-- Add a comment to document the column purpose
COMMENT ON COLUMN staff.temp_pin IS 'Temporary staff PIN - stored as bcrypt hash (60 chars) or plain text during setup';
