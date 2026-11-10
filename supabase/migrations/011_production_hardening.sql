-- Production hardening: trial/plan, delivery coords, rate limits, staff RLS, otp lockdown
-- Safe to run multiple times.

-- Restaurant SaaS fields
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS plan VARCHAR(32) DEFAULT 'starter';

UPDATE restaurants
SET trial_ends_at = COALESCE(trial_ends_at, created_at + INTERVAL '14 days'),
    plan = COALESCE(plan, 'starter')
WHERE trial_ends_at IS NULL OR plan IS NULL;

-- Delivery destination coordinates
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION;

-- Serverless-friendly rate limits
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Rate limits are server only" ON rate_limits;
CREATE POLICY "Rate limits are server only" ON rate_limits FOR ALL USING (false);

-- Staff membership helper (owner or linked staff user)
CREATE OR REPLACE FUNCTION public.is_restaurant_member(rid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = rid AND r.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.restaurant_id = rid
        AND s.user_id = auth.uid()
        AND COALESCE(s.is_active, true) = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_restaurant_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_restaurant_member(uuid) TO authenticated, anon;

-- Additive staff policies (keep existing owner policies)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'restaurants','staff','categories','menu_items','tables','orders',
    'inventory','reservations','discount_codes','loyalty_members','feedback',
    'shifts','expenses','daily_specials','daily_reports','messages'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Staff member access" ON %I', tbl);
      IF tbl = 'restaurants' THEN
        EXECUTE 'CREATE POLICY "Staff member access" ON restaurants FOR SELECT USING (public.is_restaurant_member(id))';
      ELSE
        EXECUTE format(
          'CREATE POLICY "Staff member access" ON %I FOR ALL USING (public.is_restaurant_member(restaurant_id)) WITH CHECK (public.is_restaurant_member(restaurant_id))',
          tbl
        );
      END IF;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items') THEN
    DROP POLICY IF EXISTS "Staff member access" ON order_items;
    CREATE POLICY "Staff member access" ON order_items FOR ALL
      USING (order_id IN (SELECT id FROM orders WHERE public.is_restaurant_member(restaurant_id)))
      WITH CHECK (order_id IN (SELECT id FROM orders WHERE public.is_restaurant_member(restaurant_id)));
  END IF;
END $$;

-- OTP codes must not be readable by the anon/authenticated clients
DROP POLICY IF EXISTS "OTP full access" ON otp_codes;
DROP POLICY IF EXISTS "Service role full access" ON otp_codes;
DROP POLICY IF EXISTS "No client access to otp codes" ON otp_codes;
CREATE POLICY "No client access to otp codes" ON otp_codes FOR ALL USING (false) WITH CHECK (false);
