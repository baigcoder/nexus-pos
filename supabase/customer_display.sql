-- Customer Facing Display Content Management
-- Tables for managing banners, videos, promotions displayed on customer screens

-- Display content (banners, videos, promos)
CREATE TABLE IF NOT EXISTS display_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    content_type TEXT CHECK (content_type IN ('banner', 'video', 'menu_highlight', 'promo')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    media_url TEXT,
    display_order INT DEFAULT 0,
    duration_seconds INT DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    schedule_start TIMESTAMPTZ,
    schedule_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Display settings per restaurant
CREATE TABLE IF NOT EXISTS display_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE,
    theme TEXT DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
    primary_color TEXT DEFAULT '#ea580c',
    animation_speed TEXT DEFAULT 'normal' CHECK (animation_speed IN ('slow', 'normal', 'fast')),
    show_prices BOOLEAN DEFAULT true,
    show_order_ticker BOOLEAN DEFAULT true,
    auto_rotate BOOLEAN DEFAULT true,
    rotate_interval INT DEFAULT 8,
    font_size TEXT DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_display_content_restaurant ON display_content(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_display_content_active ON display_content(is_active);
CREATE INDEX IF NOT EXISTS idx_display_settings_restaurant ON display_settings(restaurant_id);

-- RLS Policies
ALTER TABLE display_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE display_settings ENABLE ROW LEVEL SECURITY;

-- Staff can view display content for their restaurant
CREATE POLICY "Staff can view display content" ON display_content
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
        )
    );

-- Owners/Managers can manage display content
CREATE POLICY "Owners/Managers can manage display content" ON display_content
    FOR ALL
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'manager')
        )
    );

-- Staff can view display settings
CREATE POLICY "Staff can view display settings" ON display_settings
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
        )
    );

-- Owners/Managers can manage display settings
CREATE POLICY "Owners/Managers can manage display settings" ON display_settings
    FOR ALL
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'manager')
        )
    );

-- Public read access for display pages (no auth required)
CREATE POLICY "Public can view active display content" ON display_content
    FOR SELECT
    USING (is_active = true);

CREATE POLICY "Public can view display settings" ON display_settings
    FOR SELECT
    USING (true);

-- Display screens (each screen has its own access code set by owner)
CREATE TABLE IF NOT EXISTS display_screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    access_code TEXT NOT NULL,
    screen_type TEXT DEFAULT 'customer' CHECK (screen_type IN ('customer', 'kitchen', 'order_status')),
    is_active BOOLEAN DEFAULT true,
    last_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for screen authentication
CREATE INDEX IF NOT EXISTS idx_display_screens_restaurant ON display_screens(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_display_screens_code ON display_screens(access_code);

-- RLS for display screens
ALTER TABLE display_screens ENABLE ROW LEVEL SECURITY;

-- Owners/Managers can manage display screens
CREATE POLICY "Owners/Managers can manage display screens" ON display_screens
    FOR ALL
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'manager')
        )
    );

-- Public can verify access code (for login)
CREATE POLICY "Public can verify screen access" ON display_screens
    FOR SELECT
    USING (is_active = true);

