-- ============================================
-- OTP System Improvements
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add columns for rate limiting and attempt tracking
ALTER TABLE otp_codes 
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS request_ip TEXT,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_created ON otp_codes(email, created_at DESC);

-- Create rate limiting table for OTP requests
CREATE TABLE IF NOT EXISTS otp_rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier TEXT NOT NULL, -- email or IP
    identifier_type TEXT NOT NULL CHECK (identifier_type IN ('email', 'ip')),
    request_count INTEGER DEFAULT 1,
    first_request TIMESTAMPTZ DEFAULT NOW(),
    last_request TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_otp_rate_limits_identifier 
ON otp_rate_limits(identifier, identifier_type);

-- Enable RLS
ALTER TABLE otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow service role full access for rate limiting operations
CREATE POLICY "Service role full access" ON otp_rate_limits
FOR ALL USING (true) WITH CHECK (true);

-- Function to check and update OTP rate limit
CREATE OR REPLACE FUNCTION check_otp_rate_limit(
    p_identifier TEXT,
    p_identifier_type TEXT,
    p_max_requests INTEGER DEFAULT 3,
    p_window_minutes INTEGER DEFAULT 15
)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining_requests INTEGER,
    retry_after_seconds INTEGER
) AS $$
DECLARE
    v_record otp_rate_limits%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_window_start TIMESTAMPTZ := v_now - (p_window_minutes || ' minutes')::INTERVAL;
BEGIN
    -- Get existing record
    SELECT * INTO v_record
    FROM otp_rate_limits
    WHERE identifier = p_identifier 
    AND identifier_type = p_identifier_type;
    
    -- Check if blocked
    IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            0::INTEGER,
            EXTRACT(EPOCH FROM (v_record.blocked_until - v_now))::INTEGER;
        RETURN;
    END IF;
    
    -- If no record or window expired, reset
    IF v_record.id IS NULL OR v_record.first_request < v_window_start THEN
        INSERT INTO otp_rate_limits (identifier, identifier_type, request_count, first_request, last_request)
        VALUES (p_identifier, p_identifier_type, 1, v_now, v_now)
        ON CONFLICT (identifier, identifier_type) 
        DO UPDATE SET 
            request_count = 1,
            first_request = v_now,
            last_request = v_now,
            blocked_until = NULL;
            
        RETURN QUERY SELECT 
            TRUE::BOOLEAN,
            (p_max_requests - 1)::INTEGER,
            0::INTEGER;
        RETURN;
    END IF;
    
    -- Check if limit exceeded
    IF v_record.request_count >= p_max_requests THEN
        -- Block for remaining window time
        UPDATE otp_rate_limits 
        SET blocked_until = v_record.first_request + (p_window_minutes || ' minutes')::INTERVAL
        WHERE id = v_record.id;
        
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            0::INTEGER,
            EXTRACT(EPOCH FROM ((v_record.first_request + (p_window_minutes || ' minutes')::INTERVAL) - v_now))::INTEGER;
        RETURN;
    END IF;
    
    -- Increment count
    UPDATE otp_rate_limits 
    SET request_count = request_count + 1, last_request = v_now
    WHERE id = v_record.id;
    
    RETURN QUERY SELECT 
        TRUE::BOOLEAN,
        (p_max_requests - v_record.request_count - 1)::INTEGER,
        0::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment OTP verification attempts
CREATE OR REPLACE FUNCTION increment_otp_attempts(p_otp_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_new_attempts INTEGER;
BEGIN
    UPDATE otp_codes 
    SET attempts = attempts + 1
    WHERE id = p_otp_id
    RETURNING attempts INTO v_new_attempts;
    
    RETURN v_new_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up expired OTPs and rate limits (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS VOID AS $$
BEGIN
    -- Delete expired OTPs
    DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 hour';
    
    -- Delete old rate limit records
    DELETE FROM otp_rate_limits WHERE last_request < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
