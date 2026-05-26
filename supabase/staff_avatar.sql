-- ============================================
-- Add avatar_url to staff table for profile photos
-- ============================================

ALTER TABLE staff ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;