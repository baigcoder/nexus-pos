-- ============================================================
-- FIX: screen_content RLS + missing display_screens columns
-- Run this in your Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Create screen_content table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS screen_content (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id    UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    screen_id        UUID NOT NULL REFERENCES display_screens(id) ON DELETE CASCADE,
    title            VARCHAR(255) NOT NULL DEFAULT '',
    media_url        TEXT,
    media_type       VARCHAR(20) DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'youtube', 'url')),
    display_order    INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 10,
    background_color VARCHAR(7) DEFAULT '#000000',
    text_color       VARCHAR(7) DEFAULT '#ffffff',
    transition_effect VARCHAR(10) DEFAULT 'fade' CHECK (transition_effect IN ('fade', 'slide', 'zoom')),
    is_active        BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screen_content_screen     ON screen_content(screen_id);
CREATE INDEX IF NOT EXISTS idx_screen_content_restaurant ON screen_content(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_screen_content_active     ON screen_content(screen_id, is_active, display_order);

-- 2. Add missing columns to display_screens (safe — IF NOT EXISTS)
ALTER TABLE display_screens
    ADD COLUMN IF NOT EXISTS last_seen       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_content UUID REFERENCES display_content(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS screen_type     VARCHAR(30) DEFAULT 'customer';

-- Update screen_type constraint to include all supported types
-- (the original only had customer/kitchen/menu)
ALTER TABLE display_screens DROP CONSTRAINT IF EXISTS display_screens_screen_type_check;
ALTER TABLE display_screens ADD CONSTRAINT display_screens_screen_type_check
    CHECK (screen_type IN ('customer','kitchen','order_status','advertisement','menu_board','counter'));

-- 3. Enable RLS on screen_content
ALTER TABLE screen_content ENABLE ROW LEVEL SECURITY;

-- 4. Drop any stale policies first (idempotent)
DROP POLICY IF EXISTS "screen_content_owner_all"   ON screen_content;
DROP POLICY IF EXISTS "screen_content_staff_read"  ON screen_content;
DROP POLICY IF EXISTS "screen_content_display_read" ON screen_content;

-- 5. Owners & managers can do everything
CREATE POLICY "screen_content_owner_all" ON screen_content
    FOR ALL
    USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

-- 6. Staff members of the same restaurant can read (for display clients)
CREATE POLICY "screen_content_staff_read" ON screen_content
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
        )
    );

-- 7. Unauthenticated display clients (TV browsers) can read active content
--    They identify by screen access code, not auth — so allow anon SELECT.
CREATE POLICY "screen_content_display_read" ON screen_content
    FOR SELECT
    TO anon
    USING (is_active = true);

-- 8. Also allow anon to UPDATE display_screens.last_seen (heartbeat)
DROP POLICY IF EXISTS "display_screens_anon_heartbeat" ON display_screens;
CREATE POLICY "display_screens_anon_heartbeat" ON display_screens
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

-- 9. Allow anon SELECT on display_screens (TV needs to load its config)
DROP POLICY IF EXISTS "display_screens_anon_read" ON display_screens;
CREATE POLICY "display_screens_anon_read" ON display_screens
    FOR SELECT
    TO anon
    USING (true);

-- 10. Verify
SELECT
    schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('screen_content', 'display_screens')
ORDER BY tablename, policyname;
