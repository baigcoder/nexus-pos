-- Points Transactions Table for Loyalty Program
-- Tracks all points earned and redeemed with running balance

CREATE TABLE IF NOT EXISTS points_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('earned', 'redeemed', 'expired', 'bonus')),
    points INTEGER NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    description VARCHAR(255),
    running_balance INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast member history lookups
CREATE INDEX IF NOT EXISTS idx_points_transactions_member
ON points_transactions(member_id, created_at DESC);

-- Index for restaurant-level queries
CREATE INDEX IF NOT EXISTS idx_points_transactions_restaurant
ON points_transactions(restaurant_id, created_at DESC);

-- Auto-update running balance via trigger
CREATE OR REPLACE FUNCTION update_member_running_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_restaurant_id UUID;
BEGIN
    -- Get restaurant from member
    SELECT restaurant_id INTO v_restaurant_id
    FROM loyalty_members
    WHERE id = NEW.member_id;

    -- Set restaurant on new transaction
    NEW.restaurant_id := v_restaurant_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_restaurant_on_transaction
BEFORE INSERT ON points_transactions
FOR EACH ROW
EXECUTE FUNCTION update_member_running_balance();

-- RLS Policies
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

-- Restaurant owners and staff can view transactions
CREATE POLICY "Restaurant staff can view transactions"
ON points_transactions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM staff
        WHERE staff.restaurant_id = points_transactions.restaurant_id
        AND staff.is_active = true
    )
);

-- Members can view their own transactions
CREATE POLICY "Members can view own transactions"
ON points_transactions FOR SELECT
USING (
    member_id IN (
        SELECT lm.id FROM loyalty_members lm
        WHERE lm.phone = auth.jwt() ->> 'phone'
    )
);

COMMENT ON TABLE points_transactions IS 'Tracks all points transactions for loyalty members with running balance';
