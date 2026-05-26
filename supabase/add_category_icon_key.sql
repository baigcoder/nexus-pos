-- Add icon_key column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon_key VARCHAR(100) DEFAULT 'tag';