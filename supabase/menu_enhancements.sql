-- ============================================
-- MENU ENHANCEMENTS MIGRATION
-- ============================================

-- Add icon_key to categories (if not exists)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon_key VARCHAR(100) DEFAULT 'tag';

-- Add cost_price to menu_items for food cost tracking
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT 0;

-- Add calories to menu_items for nutrition info
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS calories INTEGER;

-- Add allergens JSONB column for detailed allergen tracking
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS allergens JSONB DEFAULT '[]';

-- Add is_active to menu_items for soft-delete / hide
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ============================================
-- MENU VERSIONS TABLE (Menu snapshots)
-- ============================================
CREATE TABLE IF NOT EXISTS menu_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    snapshot JSONB NOT NULL,
    is_current BOOLEAN DEFAULT false,
    created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_versions_restaurant ON menu_versions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_versions_created ON menu_versions(restaurant_id, created_at DESC);

ALTER TABLE menu_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view menu versions" ON menu_versions
    FOR SELECT USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Owners can manage menu versions" ON menu_versions
    FOR ALL USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

-- ============================================
-- MENU ITEM INGREDIENTS TABLE (Recipe/Cost linkage)
-- ============================================
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'piece',
    cost_per_unit DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_item ON menu_item_ingredients(menu_item_id);

ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view menu ingredients" ON menu_item_ingredients
    FOR SELECT USING (
        menu_item_id IN (
            SELECT id FROM menu_items WHERE restaurant_id IN (
                SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Owners can manage menu ingredients" ON menu_item_ingredients
    FOR ALL USING (
        menu_item_id IN (
            SELECT id FROM menu_items WHERE restaurant_id IN (
                SELECT restaurant_id FROM restaurants WHERE owner_id = auth.uid()
            )
        )
    );

-- ============================================
-- MENU SCHEDULES TABLE (Time-based menu availability)
-- ============================================
CREATE TABLE IF NOT EXISTS menu_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    day_of_week SMALLINT CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME DEFAULT '00:00',
    end_time TIME DEFAULT '23:59',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_schedules_restaurant ON menu_schedules(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_schedules_category ON menu_schedules(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_schedules_item ON menu_schedules(menu_item_id);

ALTER TABLE menu_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view menu schedules" ON menu_schedules
    FOR SELECT USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Owners can manage menu schedules" ON menu_schedules
    FOR ALL USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurants WHERE owner_id = auth.uid()
        )
    );