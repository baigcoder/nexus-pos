-- 011: Let check_otp_rate_limit store generic keys (e.g. per-restaurant / per-email PIN login limits)
-- so login brute-force limits survive serverless cold starts.
ALTER TABLE public.otp_rate_limits DROP CONSTRAINT IF EXISTS otp_rate_limits_identifier_type_check;
ALTER TABLE public.otp_rate_limits
    ADD CONSTRAINT otp_rate_limits_identifier_type_check CHECK (identifier_type IN ('email', 'ip', 'key'));
