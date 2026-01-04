-- Menu Item Ingredients Mapping Table
-- Links menu items to inventory ingredients with usage quantities

CREATE TABLE IF NOT EXISTS menu_item_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity_per_item DECIMAL(10, 2) NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(menu_item_id, ingredient_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_menu ON menu_item_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_ingredient ON menu_item_ingredients(ingredient_id);

-- RLS Policies
ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view menu item ingredients for their restaurants" ON menu_item_ingredients
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM menu_items mi
            JOIN restaurants r ON mi.restaurant_id = r.id
            JOIN staff s ON r.id = s.restaurant_id
            WHERE mi.id = menu_item_ingredients.menu_item_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Owners and managers can manage menu item ingredients" ON menu_item_ingredients
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM menu_items mi
            JOIN restaurants r ON mi.restaurant_id = r.id
            JOIN staff s ON r.id = s.restaurant_id
            WHERE mi.id = menu_item_ingredients.menu_item_id
            AND s.user_id = auth.uid()
            AND s.role IN ('owner', 'manager')
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_menu_item_ingredients_updated_at
    BEFORE UPDATE ON menu_item_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add columns to inventory_items if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'last_restocked') THEN
        ALTER TABLE inventory_items ADD COLUMN last_restocked TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'supplier_name') THEN
        ALTER TABLE inventory_items ADD COLUMN supplier_name VARCHAR(255);
    END IF;
END $$;
