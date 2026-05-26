-- ============================================
-- Update shifts table to use start_time/end_time
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add start_time and end_time columns if they don't exist
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS start_time TIME;

ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS end_time TIME;

-- Copy data from scheduled_start/scheduled_end if they exist and new columns are null
UPDATE shifts
SET start_time = scheduled_start::time
WHERE start_time IS NULL AND scheduled_start IS NOT NULL;

UPDATE shifts
SET end_time = scheduled_end::time
WHERE end_time IS NULL AND scheduled_end IS NOT NULL;

-- Make columns required for new entries (they are nullable for existing data)
-- Note: You may need to add NOT NULL constraint separately after ensuring all data is migrated

-- ============================================
-- Create indexes for better performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shifts(start_time);
CREATE INDEX IF NOT EXISTS idx_shifts_end_time ON shifts(end_time);