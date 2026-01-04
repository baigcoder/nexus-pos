-- ============================================
-- OrderFlow Complete Database Migration
-- Run this in your Supabase SQL Editor
-- ============================================
-- Version: 1.0
-- Last Updated: 2026-01-03
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SECTION 1: CORE TABLES
-- ============================================

-- ============================================
-- 1.1 RESTAURANTS TABLE
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

CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);

-- ============================================
-- 1.2 STAFF TABLE
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

CREATE INDEX IF NOT EXISTS idx_staff_restaurant ON staff(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_pin ON staff(restaurant_id, pin);

-- ============================================
-- 1.3 CATEGORIES TABLE
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

CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories(restaurant_id);

-- ============================================
-- 1.4 MENU ITEMS TABLE
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

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(restaurant_id, is_available);

-- ============================================
-- 1.5 TABLES TABLE
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

CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON tables(restaurant_id);

-- ============================================
-- 1.6 ORDERS TABLE
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

CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(restaurant_id, created_at DESC);

-- ============================================
-- 1.7 ORDER ITEMS TABLE
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

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ============================================
-- 1.8 PAYMENTS TABLE
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

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- ============================================
-- 1.9 SPLIT PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS split_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    split_number INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    items JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_split_payments_order ON split_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_split_payments_status ON split_payments(order_id, payment_status);

-- ============================================
-- 1.10 MESSAGES TABLE (Staff Communication)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'direct' CHECK (message_type IN ('direct', 'broadcast', 'system')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_restaurant ON messages(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(restaurant_id, created_at DESC);

-- ============================================
-- 1.11 OTP CODES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);


-- ============================================
-- SECTION 2: ROW LEVEL SECURITY (RLS)
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
ALTER TABLE split_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2.1 RESTAURANTS POLICIES
-- ============================================
CREATE POLICY "Users can view own restaurants" ON restaurants
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own restaurants" ON restaurants
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own restaurants" ON restaurants
    FOR UPDATE USING (auth.uid() = owner_id);

-- ============================================
-- 2.2 STAFF POLICIES
-- ============================================
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

-- ============================================
-- 2.3 CATEGORIES POLICIES
-- ============================================
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

-- ============================================
-- 2.4 MENU ITEMS POLICIES
-- ============================================
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

-- ============================================
-- 2.5 TABLES POLICIES
-- ============================================
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

-- ============================================
-- 2.6 ORDERS POLICIES
-- ============================================
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

-- ============================================
-- 2.7 ORDER ITEMS POLICIES
-- ============================================
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

-- ============================================
-- 2.8 PAYMENTS POLICIES
-- ============================================
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
-- 2.9 SPLIT PAYMENTS POLICIES
-- ============================================
CREATE POLICY "Staff can view split payments" ON split_payments
    FOR SELECT USING (
        order_id IN (
            SELECT id FROM orders WHERE restaurant_id IN (
                SELECT id FROM restaurants WHERE owner_id = auth.uid()
            )
        )
    );

CREATE POLICY "Staff can manage split payments" ON split_payments
    FOR ALL USING (
        order_id IN (
            SELECT id FROM orders WHERE restaurant_id IN (
                SELECT id FROM restaurants WHERE owner_id = auth.uid()
            )
        )
    );

-- ============================================
-- 2.10 MESSAGES POLICIES
-- ============================================
CREATE POLICY "Staff can view own restaurant messages" ON messages
    FOR SELECT USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff WHERE id = sender_id OR id = receiver_id
        )
    );

CREATE POLICY "Staff can insert messages" ON messages
    FOR INSERT WITH CHECK (
        restaurant_id IN (
            SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- 2.11 OTP CODES POLICIES
-- ============================================
CREATE POLICY "Service role full access" ON otp_codes
    FOR ALL
    USING (true)
    WITH CHECK (true);


-- ============================================
-- SECTION 3: TRIGGERS
-- ============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
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

CREATE TRIGGER update_split_payments_updated_at BEFORE UPDATE ON split_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- SECTION 4: HELPER FUNCTIONS
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
    SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
    FROM order_items WHERE order_id = order_uuid;
    
    SELECT r.tax_rate, o.discount INTO v_tax_rate, v_discount
    FROM orders o
    JOIN restaurants r ON o.restaurant_id = r.id
    WHERE o.id = order_uuid;
    
    v_tax := (v_subtotal - COALESCE(v_discount, 0)) * (v_tax_rate / 100);
    
    UPDATE orders SET
        subtotal = v_subtotal,
        tax = v_tax,
        total = v_subtotal + v_tax - COALESCE(v_discount, 0),
        updated_at = NOW()
    WHERE id = order_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to verify staff PIN (for staff login)
CREATE OR REPLACE FUNCTION verify_staff_pin(
    p_restaurant_slug TEXT,
    p_pin TEXT
) RETURNS TABLE (
    staff_id UUID,
    restaurant_id UUID,
    staff_name TEXT,
    staff_role TEXT,
    restaurant_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.restaurant_id,
        s.name,
        s.role::TEXT,
        r.name
    FROM staff s
    JOIN restaurants r ON r.id = s.restaurant_id
    WHERE r.slug = p_restaurant_slug
    AND s.pin = p_pin
    AND s.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- SECTION 5: REALTIME CONFIGURATION
-- ============================================

-- NOTE: Enable realtime in Supabase Dashboard:
-- Go to Database > Replication > Enable for:
--   - orders
--   - order_items
--   - tables
--   - messages


-- ============================================
-- SECTION 6: SAMPLE DATA (Optional)
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

-- Sample staff
INSERT INTO staff (restaurant_id, name, email, pin, role) VALUES
    ('YOUR_RESTAURANT_ID', 'John Waiter', 'john@example.com', '1234', 'waiter'),
    ('YOUR_RESTAURANT_ID', 'Chef Ali', 'ali@example.com', '5678', 'kitchen'),
    ('YOUR_RESTAURANT_ID', 'Sara Manager', 'sara@example.com', '9999', 'manager');
*/


-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created: 11
-- RLS Policies: 22
-- Triggers: 7
-- Functions: 3
-- ============================================
