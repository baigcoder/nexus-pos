-- Display Manager Database Schema
-- Run this in Supabase SQL Editor to create the displays table

-- Create displays table
CREATE TABLE IF NOT EXISTS displays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'kitchen' CHECK (type IN ('kitchen', 'bar', 'counter', 'waiting', 'qr')),
    template VARCHAR(50) NOT NULL DEFAULT 'list' CHECK (template IN ('list', 'kanban', 'grid', 'compact')),
    settings JSONB NOT NULL DEFAULT '{"refresh_interval": 5, "sound_enabled": true, "theme": "dark", "show_timer": true, "priority_enabled": true}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(restaurant_id, slug)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_displays_restaurant ON displays(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_displays_slug ON displays(slug);
CREATE INDEX IF NOT EXISTS idx_displays_type ON displays(type);
CREATE INDEX IF NOT EXISTS idx_displays_active ON displays(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE displays ENABLE ROW LEVEL SECURITY;

-- RLS Policies for displays table
CREATE POLICY "Users can view their restaurant displays"
    ON displays FOR SELECT
    USING (
        auth.uid() IN (
            SELECT owner_id FROM restaurants WHERE id = displays.restaurant_id
        )
        OR auth.uid() IN (
            SELECT user_id FROM staff WHERE restaurant_id = displays.restaurant_id AND role IN ('owner', 'manager')
        )
    );

CREATE POLICY "Owners can insert displays"
    ON displays FOR INSERT
    WITH CHECK (
        auth.uid() = (
            SELECT owner_id FROM restaurants WHERE id = displays.restaurant_id
        )
    );

CREATE POLICY "Owners can update displays"
    ON displays FOR UPDATE
    USING (
        auth.uid() = (
            SELECT owner_id FROM restaurants WHERE id = displays.restaurant_id
        )
    );

CREATE POLICY "Owners can delete displays"
    ON displays FOR DELETE
    USING (
        auth.uid() = (
            SELECT owner_id FROM restaurants WHERE id = displays.restaurant_id
        )
    );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_displays_updated_at ON displays;
CREATE TRIGGER update_displays_updated_at
    BEFORE UPDATE ON displays
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for displays table
ALTER PUBLICATION supabase_realtime ADD TABLE displays;

-- Comments
COMMENT ON TABLE displays IS 'Digital signage and kitchen display configurations';
COMMENT ON COLUMN displays.type IS 'Display type: kitchen, bar, counter, waiting, qr';
COMMENT ON COLUMN displays.template IS 'Layout template: list, kanban, grid, compact';
COMMENT ON COLUMN displays.settings IS 'JSON settings: refresh_interval, sound_enabled, theme, show_timer, priority_enabled';