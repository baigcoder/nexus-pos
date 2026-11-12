-- 029: Second pass from the live security advisors (2026-11-12).

-- 1) delivery_assignments: "Public can view delivery status" is USING (true) for every role, so any signed-in
--    user (sign-up is open) could read every restaurant's customer names, phones and addresses.
--    Dispatch staff keep access through "Dispatch and assigned rider can read deliveries"; customers track
--    through /api/track (service role).
DROP POLICY IF EXISTS "Public can view delivery status" ON public.delivery_assignments;

-- 2) SECURITY DEFINER functions callable straight from the public REST API (/rest/v1/rpc/...).
--    The app only calls check_otp_rate_limit / check_api_key_rate_limit through the service role; the rest are unused.
--    verify_staff_pin in particular allowed unthrottled PIN guessing for plain-text PINs.
--    is_restaurant_member / get_current_staff_role stay executable: RLS policies call them as the querying role.
DO $$
DECLARE
    fn regprocedure;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('verify_staff_pin', 'check_otp_rate_limit', 'check_api_key_rate_limit',
                            'validate_api_key', 'increment_otp_attempts', 'rls_auto_enable')
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END LOOP;
END $$;

-- 3) Pin search_path on SECURITY DEFINER functions that lacked it (search-path hijacking).
DO $$
DECLARE
    fn regprocedure;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef
          AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn);
    END LOOP;
END $$;
