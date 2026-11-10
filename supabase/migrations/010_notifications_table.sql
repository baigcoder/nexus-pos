-- ============================================
-- In-App Notifications Table
-- Powers the dashboard notifications dropdown + unread badge
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE, -- NULL = visible to all staff of the restaurant
    type VARCHAR(30) NOT NULL DEFAULT 'info', -- info | order | alert | success | warning
    title VARCHAR(200) NOT NULL,
    message TEXT,
    link TEXT, -- optional dashboard route to navigate to
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_restaurant ON notifications(restaurant_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_staff ON notifications(staff_id, read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Owners can view/manage all restaurant notifications
CREATE POLICY "Owners manage notifications" ON notifications
    FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- Staff can view their own + restaurant-wide notifications
CREATE POLICY "Staff view notifications" ON notifications
    FOR SELECT USING (
        restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid())
        AND (staff_id IS NULL OR staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()))
    );

-- Staff can mark their notifications as read
CREATE POLICY "Staff update notifications" ON notifications
    FOR UPDATE USING (
        restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid())
        AND (staff_id IS NULL OR staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()))
    );

-- Enable realtime for live notification updates
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
