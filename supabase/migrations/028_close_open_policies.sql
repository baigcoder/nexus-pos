-- 028: Close the remaining world-open tables found on the live database (2026-11-12).
--
-- These "service role" policies were created as FOR ALL USING (true) WITH CHECK (true) with no TO clause,
-- so they apply to anon and authenticated too. 011 added a USING (false) policy on otp_codes, but
-- permissive policies are OR-ed, so the old one kept the table open:
--   * otp_codes            anyone could read live OTPs or insert their own code for any email
--   * otp_rate_limits      anyone could read/delete lockout rows (rate-limit bypass)
--   * api_key_rate_limits  anyone could reset API-key throttling
-- Only server routes touch these tables, via the service role, which bypasses RLS and grants.

DROP POLICY IF EXISTS "Service role full access otp_codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Service role full access" ON public.otp_codes;
DROP POLICY IF EXISTS "OTP full access" ON public.otp_codes;

DROP POLICY IF EXISTS "Service role full access" ON public.otp_rate_limits;
DROP POLICY IF EXISTS "Service role full access otp_rate_limits" ON public.otp_rate_limits;

DROP POLICY IF EXISTS "Service role access" ON public.api_key_rate_limits;

-- Belt and braces: no client role needs table privileges here.
REVOKE ALL ON public.otp_codes, public.otp_rate_limits, public.api_key_rate_limits FROM anon, authenticated;
