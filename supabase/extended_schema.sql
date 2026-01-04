-- ============================================
-- OrderFlow Extended Schema
-- Additional features: Discounts, Inventory, Reservations
-- ============================================

-- ============================================
-- DISCOUNT CODES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS discount_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    max_discount DECIMAL(10,2),
    usage_limit INTEGER,
    times_used INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, code)
);

CREATE INDEX idx_discount_codes_restaurant ON discount_codes(restaurant_id, code);

-- ============================================
-- INVENTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    current_stock DECIMAL(10,3) DEFAULT 0,
    min_stock DECIMAL(10,3) DEFAULT 0,
    cost_per_unit DECIMAL(10,2) DEFAULT 0,
    supplier_name VARCHAR(255),
    supplier_contact VARCHAR(255),
    last_restocked TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_restaurant ON inventory(restaurant_id);
CREATE INDEX idx_inventory_low_stock ON inventory(restaurant_id, current_stock, min_stock);

-- ============================================
-- MENU ITEM INGREDIENTS (Link menu items to inventory)
-- ============================================
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    quantity_required DECIMAL(10,3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(menu_item_id, inventory_id)
);

-- ============================================
-- RESERVATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    party_size INTEGER NOT NULL DEFAULT 2,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 90,
    status VARCHAR(50) DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
    special_requests TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reservations_restaurant ON reservations(restaurant_id, reservation_date);
CREATE INDEX idx_reservations_table ON reservations(table_id, reservation_date);

-- ============================================
-- DAILY REPORTS TABLE (for caching)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    total_tax DECIMAL(12,2) DEFAULT 0,
    total_discounts DECIMAL(12,2) DEFAULT 0,
    avg_order_value DECIMAL(10,2) DEFAULT 0,
    top_selling_items JSONB DEFAULT '[]',
    payment_breakdown JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, report_date)
);

-- ============================================
-- RLS Policies for new tables
-- ============================================
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage discount codes" ON discount_codes
    FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Manage inventory" ON inventory
    FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Manage reservations" ON reservations
    FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Manage daily reports" ON daily_reports
    FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
