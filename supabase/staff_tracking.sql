-- ============================================
-- STAFF TRACKING & MONITORING TABLES
-- For AI-powered staff monitoring system
-- ============================================

-- Staff Activity Logs - Track all staff actions
CREATE TABLE IF NOT EXISTS staff_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    action_details JSONB DEFAULT '{}',
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_staff_activity_staff ON staff_activity_logs(staff_id, created_at DESC);
CREATE INDEX idx_staff_activity_restaurant ON staff_activity_logs(restaurant_id, created_at DESC);
CREATE INDEX idx_staff_activity_type ON staff_activity_logs(action_type, created_at DESC);

-- Staff Performance Metrics (real-time)
CREATE TABLE IF NOT EXISTS staff_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    orders_taken INTEGER DEFAULT 0,
    orders_completed INTEGER DEFAULT 0,
    revenue_generated DECIMAL(12,2) DEFAULT 0,
    avg_order_time_seconds INTEGER DEFAULT 0,
    tables_served INTEGER DEFAULT 0,
    customer_rating DECIMAL(3,2) DEFAULT 0,
    late_orders INTEGER DEFAULT 0,
    priority_orders INTEGER DEFAULT 0,
    feedback_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, date)
);

CREATE INDEX idx_staff_metrics_staff ON staff_metrics(staff_id, date DESC);
CREATE INDEX idx_staff_metrics_restaurant ON staff_metrics(restaurant_id, date DESC);

-- Kitchen Order Tracking
CREATE TABLE IF NOT EXISTS kitchen_order_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served')),
    received_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    served_at TIMESTAMPTZ,
    prep_time_seconds INTEGER DEFAULT 0,
    actual_prep_time_seconds INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kitchen_queue_restaurant ON kitchen_order_queue(restaurant_id, status, priority DESC);
CREATE INDEX idx_kitchen_queue_assigned ON kitchen_order_queue(assigned_to, status);

-- Cashier Transaction Log
CREATE TABLE IF NOT EXISTS cashier_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) DEFAULT 'sale' CHECK (transaction_type IN ('sale', 'refund', 'discount', 'void')),
    amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(20),
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cashier_transactions_staff ON cashier_transactions(staff_id, created_at DESC);
CREATE INDEX idx_cashier_transactions_restaurant ON cashier_transactions(restaurant_id, created_at DESC);

-- Delivery Tracking
CREATE TABLE IF NOT EXISTS delivery_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'preparing' CHECK (status IN ('preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'failed')),
    pickup_time TIMESTAMPTZ,
    delivery_time TIMESTAMPTZ,
    estimated_minutes INTEGER DEFAULT 30,
    actual_minutes INTEGER DEFAULT 0,
    distance_km DECIMAL(6,2),
    customer_lat DECIMAL(10,8),
    customer_lng DECIMAL(11,8),
    delivery_address TEXT,
    customer_feedback TEXT,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_tracking_rider ON delivery_tracking(rider_id, status);
CREATE INDEX idx_delivery_tracking_restaurant ON delivery_tracking(restaurant_id, status);

-- Staff Alerts & Notifications
CREATE TABLE IF NOT EXISTS staff_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    from_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    to_staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    alert_type VARCHAR(30) NOT NULL,
    title VARCHAR(100) NOT NULL,
    message TEXT,
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    is_read BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    related_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_staff_alerts_recipient ON staff_alerts(to_staff_id, is_read, created_at DESC);
CREATE INDEX idx_staff_alerts_restaurant ON staff_alerts(restaurant_id, priority DESC);

-- AI Performance Analysis Cache
CREATE TABLE IF NOT EXISTS ai_staff_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    analysis_date DATE NOT NULL,
    performance_score DECIMAL(5,2) DEFAULT 0,
    efficiency_rating VARCHAR(10),
    strengths TEXT[],
    areas_for_improvement TEXT[],
    recommendations TEXT[],
    ai_summary TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, analysis_date)
);

CREATE INDEX idx_ai_analysis_staff ON ai_staff_analysis(staff_id, analysis_date DESC);
CREATE INDEX idx_ai_analysis_restaurant ON ai_staff_analysis(restaurant_id, analysis_date DESC);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE staff_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_order_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashier_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_staff_analysis ENABLE ROW LEVEL SECURITY;

-- Staff can view their own activity
CREATE POLICY "Staff view own activity" ON staff_activity_logs
    FOR SELECT USING (staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));

CREATE POLICY "Staff create activity" ON staff_activity_logs
    FOR INSERT WITH CHECK (staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));

-- Staff can view their own metrics
CREATE POLICY "Staff view own metrics" ON staff_metrics
    FOR SELECT USING (staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));

-- Kitchen queue visible to kitchen staff and managers
CREATE POLICY "Kitchen view queue" ON kitchen_order_queue
    FOR SELECT USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND role IN ('kitchen', 'manager', 'owner')
        )
    );

-- Cashier transactions visible to cashier and managers
CREATE POLICY "Cashier view transactions" ON cashier_transactions
    FOR SELECT USING (staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));

-- Delivery tracking visible to delivery staff
CREATE POLICY "Delivery view tracking" ON delivery_tracking
    FOR SELECT USING (rider_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));

-- Staff alerts
CREATE POLICY "Staff alerts view" ON staff_alerts
    FOR SELECT USING (
        to_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()) OR
        from_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
    );

CREATE POLICY "Manager create alerts" ON staff_alerts
    FOR INSERT WITH CHECK (
        restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND role IN ('manager', 'owner'))
    );

-- AI Analysis visible to owner/manager and staff for their own
CREATE POLICY "AI analysis view" ON ai_staff_analysis
    FOR SELECT USING (
        restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid()) OR
        staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
    );