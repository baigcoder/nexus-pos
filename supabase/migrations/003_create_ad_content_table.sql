-- Advertisement Content Management
-- Table for storing advertisement slides, banners, and promotional content

CREATE TABLE IF NOT EXISTS ad_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    display_id UUID REFERENCES displays(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    media_url TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'video', 'youtube', 'url')) DEFAULT 'image',
    duration_seconds INT DEFAULT 8 CHECK (duration_seconds > 0 AND duration_seconds <= 300),
    display_order INT DEFAULT 0,
    background_color TEXT DEFAULT '#000000',
    text_color TEXT DEFAULT '#ffffff',
    cta_text TEXT,
    cta_url TEXT,
    is_active BOOLEAN DEFAULT true,
    schedule_start TIMESTAMPTZ,
    schedule_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ad_content_restaurant ON ad_content(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_ad_content_display ON ad_content(display_id);
CREATE INDEX IF NOT EXISTS idx_ad_content_active ON ad_content(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ad_content_order ON ad_content(display_order);

-- Enable Row Level Security
ALTER TABLE ad_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view ad content"
    ON ad_content FOR SELECT
    USING (
        restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
        OR restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND role IN ('owner', 'manager'))
    );

CREATE POLICY "Users can insert ad content"
    ON ad_content FOR INSERT
    WITH CHECK (
        restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    );

CREATE POLICY "Users can update ad content"
    ON ad_content FOR UPDATE
    USING (
        restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    );

CREATE POLICY "Users can delete ad content"
    ON ad_content FOR DELETE
    USING (
        restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE ad_content;

-- Comments
COMMENT ON TABLE ad_content IS 'Advertisement content for digital signage slideshows';
COMMENT ON COLUMN ad_content.media_type IS 'Content type: image, video, youtube, url';
COMMENT ON COLUMN ad_content.duration_seconds IS 'How long to display each slide (1-300 seconds)';
COMMENT ON COLUMN ad_content.display_order IS 'Order in slideshow (lower = first)';
