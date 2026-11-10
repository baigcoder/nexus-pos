BEGIN;

CREATE OR REPLACE FUNCTION public.find_signup_user_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT u.id
    FROM auth.users u
    WHERE u.email = p_email AND u.deleted_at IS NULL
      AND COALESCE(u.is_sso_user, false) = false
    ORDER BY u.created_at
    LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.find_signup_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_signup_user_by_email(text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
