-- ============================================
-- API Keys System for External Integrations
-- Run this in your Supabase SQL Editor
-- ============================================

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- e.g., "WordPress Plugin", "Mobile App"
    key_prefix VARCHAR(8) NOT NULL, -- First 8 chars for identification (e.g., "nxp_live")
    key_hash TEXT NOT NULL, -- bcrypt hash of full key
    permissions JSONB DEFAULT '["menu:read", "orders:create"]'::JSONB,
    rate_limit_per_minute INTEGER DEFAULT 60,
    allowed_origins TEXT[] DEFAULT '{}', -- CORS whitelist
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ, -- NULL = never expires
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_restaurant ON api_keys(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active, expires_at);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Only restaurant owners can manage their API keys
CREATE POLICY "Restaurant owner access" ON api_keys
FOR ALL USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
);

-- Function to validate API key (called by application)
-- Returns restaurant_id if valid, NULL otherwise
CREATE OR REPLACE FUNCTION validate_api_key(p_key TEXT)
RETURNS TABLE (
    restaurant_id UUID,
    permissions JSONB,
    allowed_origins TEXT[]
) AS $$
DECLARE
    v_prefix VARCHAR(8);
    v_key_record api_keys%ROWTYPE;
BEGIN
    -- Extract prefix (first 8 characters)
    v_prefix := LEFT(p_key, 8);
    
    -- Find matching key
    SELECT * INTO v_key_record
    FROM api_keys
    WHERE key_prefix = v_prefix
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());
    
    IF v_key_record.id IS NULL THEN
        RETURN;
    END IF;
    
    -- Verify full key hash (using pgcrypto)
    IF NOT (crypt(p_key, v_key_record.key_hash) = v_key_record.key_hash) THEN
        RETURN;
    END IF;
    
    -- Update usage stats
    UPDATE api_keys 
    SET last_used_at = NOW(), usage_count = usage_count + 1
    WHERE id = v_key_record.id;
    
    -- Return valid key info
    RETURN QUERY SELECT 
        v_key_record.restaurant_id,
        v_key_record.permissions,
        v_key_record.allowed_origins;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- API key rate limiting table
CREATE TABLE IF NOT EXISTS api_key_rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER DEFAULT 1,
    UNIQUE(api_key_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_api_key_rate_limits_key ON api_key_rate_limits(api_key_id, window_start);

-- Enable RLS
ALTER TABLE api_key_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role access" ON api_key_rate_limits
FOR ALL USING (true) WITH CHECK (true);

-- Check API key rate limit
CREATE OR REPLACE FUNCTION check_api_key_rate_limit(
    p_api_key_id UUID,
    p_rate_limit INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_current_count INTEGER;
BEGIN
    -- Get current minute window
    v_window_start := date_trunc('minute', NOW());
    
    -- Upsert rate limit record
    INSERT INTO api_key_rate_limits (api_key_id, window_start, request_count)
    VALUES (p_api_key_id, v_window_start, 1)
    ON CONFLICT (api_key_id, window_start) 
    DO UPDATE SET request_count = api_key_rate_limits.request_count + 1
    RETURNING request_count INTO v_current_count;
    
    -- Check if limit exceeded
    RETURN v_current_count <= p_rate_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION cleanup_api_rate_limits()
RETURNS VOID AS $$
BEGIN
    DELETE FROM api_key_rate_limits 
    WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Updated timestamp trigger
CREATE TRIGGER update_api_keys_updated_at 
BEFORE UPDATE ON api_keys 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
