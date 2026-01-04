-- ============================================
-- OrderFlow Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- RESTAURANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    operating_hours JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    currency VARCHAR(10) DEFAULT 'PKR',
    tax_rate DECIMAL(5,2) DEFAULT 16.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for owner lookup
CREATE INDEX idx_restaurants_owner ON restaurants(owner_id);

-- ============================================
-- STAFF TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    pin VARCHAR(10),
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'manager', 'waiter', 'kitchen', 'cashier')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_staff_restaurant ON staff(restaurant_id);
CREATE INDEX idx_staff_pin ON staff(restaurant_id, pin);

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_categories_restaurant ON categories(restaurant_id);

-- ============================================
-- MENU ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    dietary_tags TEXT[] DEFAULT '{}',
    customizations JSONB DEFAULT '[]',
    is_available BOOLEAN DEFAULT true,
    is_special BOOLEAN DEFAULT false,
    special_until TIMESTAMPTZ,
    preparation_time INTEGER, -- in minutes
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_available ON menu_items(restaurant_id, is_available);

-- ============================================
-- TABLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_number VARCHAR(50) NOT NULL,
    capacity INTEGER DEFAULT 4,
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'billing')),
    qr_code TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, table_number)
);

-- Index
CREATE INDEX idx_tables_restaurant ON tables(restaurant_id);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    order_number SERIAL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'paid', 'cancelled')),
    subtotal DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    is_priority BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(restaurant_id, status);
CREATE INDEX idx_orders_created ON orders(restaurant_id, created_at DESC);

-- ============================================
-- ORDER ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    special_instructions TEXT,
    customizations JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    method VARCHAR(50) NOT NULL CHECK (method IN ('cash', 'card', 'mobile', 'other')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    transaction_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_payments_order ON payments(order_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Restaurants: Owner can manage their own restaurant
CREATE POLICY "Users can view own restaurants" ON restaurants
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own restaurants" ON restaurants
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own restaurants" ON restaurants
    FOR UPDATE USING (auth.uid() = owner_id);

-- Staff: Restaurant owner/managers can manage staff
CREATE POLICY "Staff can view own restaurant staff" ON staff
    FOR SELECT USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Owners can manage staff" ON staff
    FOR ALL USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

-- Categories: Restaurant staff can view, owners can manage
CREATE POLICY "Staff can view categories" ON categories
    FOR SELECT USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Owners can manage categories" ON categories
    FOR ALL USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

-- Menu Items: Same as categories
CREATE POLICY "Staff can view menu items" ON menu_items
    FOR SELECT USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Owners can manage menu items" ON menu_items
    FOR ALL USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

-- Tables: Same pattern
CREATE POLICY "Staff can view tables" ON tables
    FOR SELECT USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Owners can manage tables" ON tables
    FOR ALL USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

-- Orders: Staff can view and manage orders for their restaurant
CREATE POLICY "Staff can view orders" ON orders
    FOR SELECT USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Staff can manage orders" ON orders
    FOR ALL USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

-- Order Items: Linked to orders
CREATE POLICY "Staff can view order items" ON order_items
    FOR SELECT USING (
        order_id IN (
            SELECT id FROM orders WHERE restaurant_id IN (
                SELECT id FROM restaurants WHERE owner_id = auth.uid()
            )
        )
    );

CREATE POLICY "Staff can manage order items" ON order_items
    FOR ALL USING (
        order_id IN (
            SELECT id FROM orders WHERE restaurant_id IN (
                SELECT id FROM restaurants WHERE owner_id = auth.uid()
            )
        )
    );

-- Payments: Linked to orders
CREATE POLICY "Staff can view payments" ON payments
    FOR SELECT USING (
        order_id IN (
            SELECT id FROM orders WHERE restaurant_id IN (
                SELECT id FROM restaurants WHERE owner_id = auth.uid()
            )
        )
    );

CREATE POLICY "Staff can manage payments" ON payments
    FOR ALL USING (
        order_id IN (
            SELECT id FROM orders WHERE restaurant_id IN (
                SELECT id FROM restaurants WHERE owner_id = auth.uid()
            )
        )
    );

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- Enable realtime for orders and order_items
-- ============================================

-- Note: Enable realtime in Supabase Dashboard:
-- Go to Database > Replication > Enable for: orders, order_items, tables

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate order totals
CREATE OR REPLACE FUNCTION calculate_order_total(order_uuid UUID)
RETURNS VOID AS $$
DECLARE
    v_subtotal DECIMAL(10,2);
    v_tax_rate DECIMAL(5,2);
    v_tax DECIMAL(10,2);
    v_discount DECIMAL(10,2);
BEGIN
    -- Get subtotal from order items
    SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
    FROM order_items WHERE order_id = order_uuid;
    
    -- Get tax rate and discount from order
    SELECT r.tax_rate, o.discount INTO v_tax_rate, v_discount
    FROM orders o
    JOIN restaurants r ON o.restaurant_id = r.id
    WHERE o.id = order_uuid;
    
    -- Calculate tax
    v_tax := (v_subtotal - COALESCE(v_discount, 0)) * (v_tax_rate / 100);
    
    -- Update order
    UPDATE orders SET
        subtotal = v_subtotal,
        tax = v_tax,
        total = v_subtotal + v_tax - COALESCE(v_discount, 0),
        updated_at = NOW()
    WHERE id = order_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Uncomment to add sample data for testing
/*
-- Sample categories
INSERT INTO categories (restaurant_id, name, description, display_order) VALUES
    ('YOUR_RESTAURANT_ID', 'Starters', 'Appetizers and small bites', 1),
    ('YOUR_RESTAURANT_ID', 'Main Course', 'Signature dishes', 2),
    ('YOUR_RESTAURANT_ID', 'Drinks', 'Beverages and refreshments', 3),
    ('YOUR_RESTAURANT_ID', 'Desserts', 'Sweet endings', 4);

-- Sample tables
INSERT INTO tables (restaurant_id, table_number, capacity) VALUES
    ('YOUR_RESTAURANT_ID', '1', 4),
    ('YOUR_RESTAURANT_ID', '2', 2),
    ('YOUR_RESTAURANT_ID', '3', 6),
    ('YOUR_RESTAURANT_ID', '4', 4),
    ('YOUR_RESTAURANT_ID', '5', 8);
*/
