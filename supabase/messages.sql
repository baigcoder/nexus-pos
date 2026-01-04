-- ============================================
-- MESSAGES TABLE (Staff Communication)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES staff(id) ON DELETE CASCADE, -- NULL for broadcast messages
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'direct' CHECK (message_type IN ('direct', 'broadcast', 'system')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_messages_restaurant ON messages(restaurant_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_created ON messages(restaurant_id, created_at DESC);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view messages in their restaurant
CREATE POLICY "Staff can view own restaurant messages" ON messages
    FOR SELECT USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff WHERE id = sender_id OR id = receiver_id
        )
    );

-- Policy: Staff can send messages
CREATE POLICY "Staff can insert messages" ON messages
    FOR INSERT WITH CHECK (
        restaurant_id IN (
            SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
        )
    );

-- Enable realtime for messages
-- Run in Supabase Dashboard: Database > Replication > Enable for messages
