-- ==============================================================================
-- MIGRATION 015: STRICT ZERO-TRUST RBAC & RLS POLICIES + AI PROPOSALS
-- Enforces fine-grained role authorization across financial, operational,
-- kitchen, delivery, and AI human-in-the-loop proposals.
-- ==============================================================================

-- 1. Create table for Human-In-The-Loop AI Action Proposals
CREATE TABLE IF NOT EXISTS ai_action_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    skill_name VARCHAR(64) NOT NULL,
    proposal_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
    confidence_score DECIMAL(4,3) NOT NULL,
    reasoning TEXT NOT NULL,
    proposed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    reviewed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_proposals_status 
    ON ai_action_proposals(restaurant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_proposals_skill 
    ON ai_action_proposals(restaurant_id, skill_name);

ALTER TABLE ai_action_proposals ENABLE ROW LEVEL SECURITY;

-- 2. Helper functions to retrieve staff role in current session
CREATE OR REPLACE FUNCTION get_current_staff_role(p_restaurant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_role VARCHAR;
BEGIN
    -- Check if current user is restaurant owner
    IF EXISTS (
        SELECT 1 FROM restaurants 
        WHERE id = p_restaurant_id AND owner_id = auth.uid()
    ) THEN
        RETURN 'owner';
    END IF;

    -- Look up staff record for current auth user
    SELECT role INTO v_role
    FROM staff
    WHERE restaurant_id = p_restaurant_id
      AND user_id = auth.uid()
      AND is_active = true
    LIMIT 1;

    RETURN COALESCE(v_role, 'anonymous');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Strict RLS on Expenses (Owner & Manager ONLY)
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Owner and Manager can view expenses" ON expenses;
    DROP POLICY IF EXISTS "Owner and Manager can insert expenses" ON expenses;
    DROP POLICY IF EXISTS "Owner and Manager can update expenses" ON expenses;
    DROP POLICY IF EXISTS "Owner and Manager can delete expenses" ON expenses;
    DROP POLICY IF EXISTS "Staff can view expenses" ON expenses;
    DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Owner and Manager can view expenses" ON expenses
    FOR SELECT USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager')
    );

CREATE POLICY "Owner and Manager can insert expenses" ON expenses
    FOR INSERT WITH CHECK (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager')
    );

CREATE POLICY "Owner and Manager can update expenses" ON expenses
    FOR UPDATE USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager')
    );

CREATE POLICY "Owner and Manager can delete expenses" ON expenses
    FOR DELETE USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager')
    );

-- 4. Strict RLS on Daily Reports (Owner & Manager ONLY)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_reports') THEN
        EXECUTE 'ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "Owner and Manager view daily_reports" ON daily_reports';
        EXECUTE 'CREATE POLICY "Owner and Manager view daily_reports" ON daily_reports
            FOR SELECT USING (get_current_staff_role(restaurant_id) IN (''owner'', ''manager''))';
    END IF;
END $$;

-- 5. Strict RLS on Cash Registers, Register Shifts & Drawer Movements (Owner, Manager, Cashier)
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE register_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_drawer_movements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Cashier and above view registers" ON cash_registers;
    DROP POLICY IF EXISTS "Cashier and above view shifts" ON register_shifts;
    DROP POLICY IF EXISTS "Cashier and above operate shifts" ON register_shifts;
    DROP POLICY IF EXISTS "Cashier and above record drawer movements" ON cash_drawer_movements;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Cashier and above view registers" ON cash_registers
    FOR SELECT USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier')
    );

CREATE POLICY "Cashier and above view shifts" ON register_shifts
    FOR SELECT USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier')
    );

CREATE POLICY "Cashier and above operate shifts" ON register_shifts
    FOR ALL USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier')
    );

CREATE POLICY "Cashier and above record drawer movements" ON cash_drawer_movements
    FOR ALL USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier')
    );

-- 6. Strict RLS on Waste Records (Owner, Manager, Kitchen)
ALTER TABLE waste_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Kitchen and management view waste" ON waste_records;
    DROP POLICY IF EXISTS "Kitchen and management record waste" ON waste_records;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Kitchen and management view waste" ON waste_records
    FOR SELECT USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'kitchen')
    );

CREATE POLICY "Kitchen and management record waste" ON waste_records
    FOR INSERT WITH CHECK (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'kitchen')
    );

-- 7. Strict RLS on Delivery Assignments (Rider isolation, Dispatch management)
ALTER TABLE delivery_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Staff and riders view deliveries" ON delivery_assignments;
    DROP POLICY IF EXISTS "Staff and riders update deliveries" ON delivery_assignments;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Staff and riders view deliveries" ON delivery_assignments
    FOR SELECT USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier')
        OR (
            get_current_staff_role(restaurant_id) IN ('rider', 'delivery')
            AND (
                rider_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
                OR status = 'pending_dispatch'
            )
        )
    );

CREATE POLICY "Staff and riders update deliveries" ON delivery_assignments
    FOR UPDATE USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier')
        OR (
            get_current_staff_role(restaurant_id) IN ('rider', 'delivery')
            AND rider_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
        )
    );

-- 8. Strict RLS on AI Action Proposals (Owner and Manager ONLY)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Owner and Manager manage AI proposals" ON ai_action_proposals;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Owner and Manager manage AI proposals" ON ai_action_proposals
    FOR ALL USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager')
    );

-- 9. Strict RLS on Transactional Outbox restaurant_events
ALTER TABLE restaurant_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Restaurant staff read outbox events" ON restaurant_events;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Restaurant staff read outbox events" ON restaurant_events
    FOR SELECT USING (
        get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier', 'waiter', 'kitchen', 'rider', 'delivery')
    );

