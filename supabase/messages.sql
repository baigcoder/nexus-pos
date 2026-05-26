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
CREATE INDEX IF NOT EXISTS idx_messages_restaurant ON messages(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(restaurant_id, sender_id, receiver_id, created_at DESC);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent)
DROP POLICY IF EXISTS "Staff can view own restaurant messages" ON messages;
DROP POLICY IF EXISTS "Staff can insert messages" ON messages;
DROP POLICY IF EXISTS "Staff can update received messages" ON messages;

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

-- Policy: Staff can update (mark as read) their own received messages
CREATE POLICY "Staff can update received messages" ON messages
    FOR UPDATE USING (
        receiver_id IN (
            SELECT id FROM staff WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- CALL LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    caller_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    call_type VARCHAR(10) DEFAULT 'audio' CHECK (call_type IN ('audio', 'video')),
    status VARCHAR(20) DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'connected', 'ended', 'missed', 'rejected')),
    duration_seconds INTEGER,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_restaurant ON call_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_receiver ON call_logs(receiver_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created ON call_logs(restaurant_id, created_at DESC);

-- Enable RLS for call_logs
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent)
DROP POLICY IF EXISTS "Staff can view own restaurant call logs" ON call_logs;
DROP POLICY IF EXISTS "Staff can insert call logs" ON call_logs;
DROP POLICY IF EXISTS "Staff can update own call logs" ON call_logs;

CREATE POLICY "Staff can view own restaurant call logs" ON call_logs
    FOR SELECT USING (
        restaurant_id IN (
            SELECT restaurant_id FROM staff WHERE id = caller_id OR id = receiver_id
        )
    );

CREATE POLICY "Staff can insert call logs" ON call_logs
    FOR INSERT WITH CHECK (
        restaurant_id IN (
            SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Staff can update own call logs" ON call_logs
    FOR UPDATE USING (
        caller_id IN (
            SELECT id FROM staff WHERE user_id = auth.uid()
        )
    );

-- Enable realtime for messages and call_logs
-- Run in Supabase Dashboard: Database > Replication > Enable for messages and call_logs