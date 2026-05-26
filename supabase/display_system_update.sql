-- Enhanced Display System Tables
-- Updates display_screens and display_content for the complete display manager feature

-- Update display_screens table with new screen types and fields
ALTER TABLE display_screens ADD COLUMN IF NOT EXISTS screen_type TEXT DEFAULT 'customer';
ALTER TABLE display_screens ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE display_screens ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
ALTER TABLE display_screens ADD COLUMN IF NOT EXISTS current_content TEXT;
ALTER TABLE display_screens ADD COLUMN IF NOT EXISTS position_x INT DEFAULT 0;
ALTER TABLE display_screens ADD COLUMN IF NOT EXISTS position_y INT DEFAULT 0;

-- Update constraint for screen_type
DO $$
BEGIN
    -- Drop existing constraint if exists
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'display_screens_screen_type_check') THEN
        ALTER TABLE display_screens DROP CONSTRAINT display_screens_screen_type_check;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if constraint doesn't exist
END $$;

ALTER TABLE display_screens ADD CONSTRAINT display_screens_screen_type_check
    CHECK (screen_type IN ('customer', 'kitchen', 'order_status', 'advertisement', 'menu_board', 'counter'));

-- Update display_content with new columns
ALTER TABLE display_content ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image';
ALTER TABLE display_content ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#1a1a1a';
ALTER TABLE display_content ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT '#ffffff';
ALTER TABLE display_content ADD COLUMN IF NOT EXISTS cta_text TEXT;
ALTER TABLE display_content ADD COLUMN IF NOT EXISTS cta_url TEXT;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'display_content_content_type_check') THEN
        ALTER TABLE display_content DROP CONSTRAINT display_content_content_type_check;
    END IF;
EXCEPTION WHEN OTHERS THEN
END $$;

ALTER TABLE display_content ADD CONSTRAINT display_content_content_type_check
    CHECK (content_type IN ('banner', 'video', 'promo', 'advertisement', 'menu_item'));

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'display_content_media_type_check') THEN
        ALTER TABLE display_content DROP CONSTRAINT display_content_media_type_check;
    END IF;
EXCEPTION WHEN OTHERS THEN
END $$;

ALTER TABLE display_content ADD CONSTRAINT display_content_media_type_check
    CHECK (media_type IN ('image', 'video', 'url'));

-- Add transition_effect to display_settings
ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS transition_effect TEXT DEFAULT 'fade';
ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT true;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'display_settings_transition_effect_check') THEN
        ALTER TABLE display_settings DROP CONSTRAINT display_settings_transition_effect_check;
    END IF;
EXCEPTION WHEN OTHERS THEN
END $$;

ALTER TABLE display_settings ADD CONSTRAINT display_settings_transition_effect_check
    CHECK (transition_effect IN ('fade', 'slide', 'zoom'));
