-- ============================================
-- OrderFlow Complete Extended Schema
-- All tables with RLS policies
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- LOYALTY MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS loyalty_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    points INTEGER DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    total_spent DECIMAL(12,2) DEFAULT 0,
    visits INTEGER DEFAULT 0,
    last_visit TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, phone)
);

CREATE INDEX idx_loyalty_restaurant ON loyalty_members(restaurant_id);
CREATE INDEX idx_loyalty_phone ON loyalty_members(phone);

-- ============================================
-- CUSTOMER FEEDBACK TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    food_rating INTEGER CHECK (food_rating BETWEEN 1 AND 5),
    service_rating INTEGER CHECK (service_rating BETWEEN 1 AND 5),
    ambiance_rating INTEGER CHECK (ambiance_rating BETWEEN 1 AND 5),
    comment TEXT,
    waiter_name VARCHAR(255),
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_restaurant ON feedback(restaurant_id);
CREATE INDEX idx_feedback_rating ON feedback(restaurant_id, overall_rating);

-- ============================================
-- SHIFTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    break_minutes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'absent')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shifts_restaurant ON shifts(restaurant_id, shift_date);
CREATE INDEX idx_shifts_staff ON shifts(staff_id, shift_date);

-- ============================================
-- EXPENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('ingredients', 'utilities', 'salary', 'supplies', 'maintenance', 'other')),
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    vendor VARCHAR(255),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer')),
    receipt_url TEXT,
    created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_restaurant ON expenses(restaurant_id, expense_date);
CREATE INDEX idx_expenses_category ON expenses(restaurant_id, category);

-- ============================================
-- TABLE QR CODES (extends tables table)
-- ============================================
ALTER TABLE tables ADD COLUMN IF NOT EXISTS qr_scans_today INTEGER DEFAULT 0;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS qr_orders_today INTEGER DEFAULT 0;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS is_qr_active BOOLEAN DEFAULT true;

-- ============================================
-- STAFF PERFORMANCE STATS (calculated/cached)
-- ============================================
CREATE TABLE IF NOT EXISTS staff_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    orders_handled INTEGER DEFAULT 0,
    revenue_generated DECIMAL(12,2) DEFAULT 0,
    avg_order_time INTEGER DEFAULT 0, -- in minutes
    rating_avg DECIMAL(3,2) DEFAULT 0,
    tips_earned DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, report_date)
);

CREATE INDEX idx_performance_restaurant ON staff_performance(restaurant_id, report_date);

-- ============================================
-- DAILY SPECIALS (links to menu_items)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_specials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    discount_percentage INTEGER NOT NULL DEFAULT 10 CHECK (discount_percentage BETWEEN 1 AND 100),
    special_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(menu_item_id, special_date)
);

CREATE INDEX idx_specials_restaurant ON daily_specials(restaurant_id, special_date);

-- ============================================
-- Enable RLS on all new tables
-- ============================================
ALTER TABLE loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_specials ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================
CREATE POLICY "Manage loyalty members" ON loyalty_members
    FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Manage feedback" ON feedback
    FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Manage shifts" ON shifts
    FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Manage expenses" ON expenses
    FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Manage staff performance" ON staff_performance
    FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Manage daily specials" ON daily_specials
    FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- ============================================
-- Functions for auto-updating timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_loyalty_updated_at BEFORE UPDATE ON loyalty_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Function to update loyalty tier based on points
-- ============================================
CREATE OR REPLACE FUNCTION update_loyalty_tier()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.points >= 5000 THEN
        NEW.tier = 'platinum';
    ELSIF NEW.points >= 2000 THEN
        NEW.tier = 'gold';
    ELSIF NEW.points >= 500 THEN
        NEW.tier = 'silver';
    ELSE
        NEW.tier = 'bronze';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_tier BEFORE INSERT OR UPDATE ON loyalty_members
    FOR EACH ROW EXECUTE FUNCTION update_loyalty_tier();
