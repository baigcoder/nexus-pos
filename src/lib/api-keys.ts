// API Key management utilities
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// API Key format: nxp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (40 chars total)
// Prefix: nxp_live (8 chars) or nxp_test (8 chars)

interface ApiKeyInfo {
    restaurant_id: string
    permissions: string[]
    allowed_origins: string[]
}

interface ApiKeyValidationResult {
    valid: boolean
    restaurantId?: string
    permissions?: string[]
    allowedOrigins?: string[]
    error?: string
}

// Create admin client for server-side operations
function getAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase configuration missing')
    }

    return createClient(supabaseUrl, supabaseServiceKey)
}

/**
 * Generate a new API key for a restaurant
 */
export async function generateApiKey(
    restaurantId: string,
    name: string,
    options: {
        isLive?: boolean
        permissions?: string[]
        allowedOrigins?: string[]
        rateLimitPerMinute?: number
        expiresAt?: Date
    } = {}
): Promise<{ key: string; keyId: string }> {
    const supabase = getAdminClient()

    // Generate prefix
    const prefix = options.isLive ? 'nxp_live' : 'nxp_test'

    // Generate random key part (32 chars)
    const randomPart = crypto.randomBytes(24).toString('base64url').slice(0, 32)
    const fullKey = `${prefix}_${randomPart}`

    // Hash the full key
    const keyHash = await bcrypt.hash(fullKey, 10)

    // Store in database
    const { data, error } = await supabase
        .from('api_keys')
        .insert({
            restaurant_id: restaurantId,
            name,
            key_prefix: prefix,
            key_hash: keyHash,
            permissions: options.permissions || ['menu:read', 'orders:create'],
            allowed_origins: options.allowedOrigins || [],
            rate_limit_per_minute: options.rateLimitPerMinute || 60,
            expires_at: options.expiresAt?.toISOString() || null,
        })
        .select('id')
        .single()

    if (error) {
        throw new Error(`Failed to create API key: ${error.message}`)
    }

    return { key: fullKey, keyId: data.id }
}

/**
 * Validate an API key from request headers
 */
export async function validateApiKey(
    apiKey: string | null,
    origin?: string | null
): Promise<ApiKeyValidationResult> {
    if (!apiKey) {
        return { valid: false, error: 'API key is required' }
    }

    // Quick format validation
    if (!apiKey.startsWith('nxp_live_') && !apiKey.startsWith('nxp_test_')) {
        return { valid: false, error: 'Invalid API key format' }
    }

    if (apiKey.length < 40) {
        return { valid: false, error: 'Invalid API key format' }
    }

    const supabase = getAdminClient()
    const prefix = apiKey.slice(0, 8)

    // Find key by prefix
    const { data: keys, error: fetchError } = await supabase
        .from('api_keys')
        .select('*')
        .eq('key_prefix', prefix)
        .eq('is_active', true)

    if (fetchError || !keys || keys.length === 0) {
        return { valid: false, error: 'Invalid API key' }
    }

    // Try to match against each key with same prefix (should typically be 1)
    for (const key of keys) {
        // Check expiration
        if (key.expires_at && new Date(key.expires_at) < new Date()) {
            continue
        }

        // Verify hash
        const isMatch = await bcrypt.compare(apiKey, key.key_hash)
        if (!isMatch) {
            continue
        }

        // Check origin if restricted
        if (key.allowed_origins && key.allowed_origins.length > 0 && origin) {
            const originMatch = key.allowed_origins.some((allowed: string) => {
                // Support wildcard subdomains
                if (allowed.startsWith('*.')) {
                    const domain = allowed.slice(2)
                    return origin.endsWith(domain) || origin === domain.replace(/^\./, '')
                }
                return origin === allowed || origin === `https://${allowed}` || origin === `http://${allowed}`
            })

            if (!originMatch) {
                return { valid: false, error: 'Origin not allowed' }
            }
        }

        // Update usage stats
        await supabase
            .from('api_keys')
            .update({
                last_used_at: new Date().toISOString(),
                usage_count: key.usage_count + 1
            })
            .eq('id', key.id)

        return {
            valid: true,
            restaurantId: key.restaurant_id,
            permissions: key.permissions,
            allowedOrigins: key.allowed_origins,
        }
    }

    return { valid: false, error: 'Invalid API key' }
}

/**
 * Check if origin is allowed (for CORS)
 */
export function getCorsHeaders(
    origin: string | null,
    allowedOrigins: string[]
): Record<string, string> {
    const baseHeaders = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Restaurant-ID',
        'Access-Control-Max-Age': '86400',
    }

    // If no allowed origins specified, allow all (backward compatible)
    if (!allowedOrigins || allowedOrigins.length === 0) {
        return {
            ...baseHeaders,
            'Access-Control-Allow-Origin': '*',
        }
    }

    // Check if origin is in whitelist
    if (origin) {
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed.startsWith('*.')) {
                const domain = allowed.slice(2)
                return origin.includes(domain)
            }
            return origin === allowed || origin.includes(allowed)
        })

        if (isAllowed) {
            return {
                ...baseHeaders,
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Credentials': 'true',
            }
        }
    }

    // Origin not allowed
    return {
        ...baseHeaders,
        'Access-Control-Allow-Origin': 'null',
    }
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string): Promise<boolean> {
    const supabase = getAdminClient()

    const { error } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', keyId)

    return !error
}

/**
 * List API keys for a restaurant (without exposing actual keys)
 */
export async function listApiKeys(restaurantId: string) {
    const supabase = getAdminClient()

    const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, permissions, allowed_origins, rate_limit_per_minute, last_used_at, usage_count, is_active, expires_at, created_at')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(`Failed to list API keys: ${error.message}`)
    }

    return data
}
