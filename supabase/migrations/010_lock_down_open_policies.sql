-- 010: Remove RLS policies that were written as "service role only" but used USING (true)
-- without a TO clause, which opened these tables to the public anon key.
-- The service role bypasses RLS, so the API routes (createAdminClient) keep working.
-- Safe to re-run.

DO $$
BEGIN
    -- OTP codes: anyone with the anon key could read every live OTP (account takeover).
    IF to_regclass('public.otp_codes') IS NOT NULL THEN
        DROP POLICY IF EXISTS "OTP full access" ON public.otp_codes;
        DROP POLICY IF EXISTS "Service role full access" ON public.otp_codes;
    END IF;

    -- Rate-limit bookkeeping: anyone could reset their own lockouts.
    IF to_regclass('public.otp_rate_limits') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Service role full access" ON public.otp_rate_limits;
    END IF;
    IF to_regclass('public.api_key_rate_limits') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Service role access" ON public.api_key_rate_limits;
    END IF;

    -- Rider GPS history: server-only (written by /api/delivery/location).
    IF to_regclass('public.rider_location_history') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Service role full access" ON public.rider_location_history;
    END IF;

    -- Delivery assignments hold customer names/addresses/phones; customers track via /api/track.
    IF to_regclass('public.delivery_assignments') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Public can view delivery status" ON public.delivery_assignments;
    END IF;

    -- display_screens: anon could read every access_code and rewrite any screen. Not used by the app.
    IF to_regclass('public.display_screens') IS NOT NULL THEN
        DROP POLICY IF EXISTS "display_screens_anon_heartbeat" ON public.display_screens;
        DROP POLICY IF EXISTS "display_screens_anon_read" ON public.display_screens;
    END IF;

    -- Rider live location: was world read/write. Now:
    --  * restaurant owner and that restaurant's staff can read their riders (delivery monitor)
    --  * anyone can read a rider only while that rider is on an active delivery
    --    (the public /track page subscribes to this via Realtime)
    --  * no client writes; riders post through /api/delivery/location
    IF to_regclass('public.rider_locations') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Service role full access" ON public.rider_locations;
        DROP POLICY IF EXISTS "rider_locations_restaurant_read" ON public.rider_locations;
        DROP POLICY IF EXISTS "rider_locations_active_delivery_read" ON public.rider_locations;

        CREATE POLICY "rider_locations_restaurant_read" ON public.rider_locations
            FOR SELECT TO authenticated
            USING (
                restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
                OR restaurant_id IN (SELECT restaurant_id FROM public.staff WHERE user_id = auth.uid() AND is_active = true)
            );

        CREATE POLICY "rider_locations_active_delivery_read" ON public.rider_locations
            FOR SELECT TO anon, authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.delivery_assignments da
                    WHERE da.rider_id = rider_locations.rider_id
                      AND da.status IN ('assigned', 'ready_pickup', 'picked_up', 'en_route', 'arrived')
                )
            );
    END IF;
END $$;
