BEGIN;

SET LOCAL lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.issue_display_pairing(
    p_restaurant_id uuid, p_display_id uuid, p_staff_id uuid, p_code_hash text
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.staff WHERE id = p_staff_id AND restaurant_id = p_restaurant_id
          AND is_active AND role IN ('owner', 'manager')
    ) THEN
        RETURN false;
    END IF;

    PERFORM d.id FROM public.displays d
    JOIN public.restaurants r ON r.id = d.restaurant_id
    WHERE d.id = p_display_id AND d.restaurant_id = p_restaurant_id AND d.is_active AND r.is_active
    FOR SHARE OF d, r;
    IF NOT FOUND THEN RETURN false; END IF;

    INSERT INTO public.display_device_sessions (display_id, code_hash, issued_by, pair_expires_at)
    VALUES (p_display_id, p_code_hash, p_staff_id, now() + interval '10 minutes');
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.active_display_device(p_session_hash text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
    SELECT display_id FROM public.display_device_sessions
    WHERE session_hash = p_session_hash AND revoked_at IS NULL AND session_expires_at > now()
$$;

REVOKE EXECUTE ON FUNCTION public.issue_display_pairing(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_display_pairing(uuid, uuid, uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.active_display_device(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.active_display_device(text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
