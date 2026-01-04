-- OTP Codes Table for Email Verification
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- Enable RLS
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (API routes use service role)
CREATE POLICY "Service role full access" ON otp_codes
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Clean up expired OTPs (run this periodically or via cron)
-- DELETE FROM otp_codes WHERE expires_at < NOW();
