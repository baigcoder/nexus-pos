-- Screen-Specific Content (Slideshow) Table
-- Each display screen can have its own playlist of images, videos, and YouTube content

CREATE TABLE IF NOT EXISTS screen_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    screen_id UUID REFERENCES display_screens(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    media_url TEXT,
    media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'youtube', 'url')),
    display_order INT DEFAULT 0,
    duration_seconds INT DEFAULT 10,
    background_color TEXT DEFAULT '#000000',
    text_color TEXT DEFAULT '#ffffff',
    transition_effect TEXT DEFAULT 'fade' CHECK (transition_effect IN ('fade', 'slide', 'zoom')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_screen_content_restaurant ON screen_content(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_screen_content_screen ON screen_content(screen_id);
CREATE INDEX IF NOT EXISTS idx_screen_content_active ON screen_content(is_active);
CREATE INDEX IF NOT EXISTS idx_screen_content_order ON screen_content(display_order);

-- RLS Policies
ALTER TABLE screen_content ENABLE ROW LEVEL SECURITY;

-- Owners/Managers can manage screen content
CREATE POLICY "Owners/Managers can manage screen content" ON screen_content
    FOR ALL
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'manager')
        )
    );

-- Staff can view screen content
CREATE POLICY "Staff can view screen content" ON screen_content
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
        )
    );

-- Public can view active screen content (for display pages)
CREATE POLICY "Public can view active screen content" ON screen_content
    FOR SELECT
    USING (is_active = true);
