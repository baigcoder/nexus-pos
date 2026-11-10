import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeEqual } from '@/lib/auth/security'

const KEY_PREFIX_LIVE = 'nxp_live'
const KEY_PREFIX_TEST = 'nxp_test'
const KEY_RANDOM_LENGTH = 32
const KEY_MIN_LENGTH = 40

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

function getAdminClient() {
    return createAdminClient()
}

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
    const prefix = options.isLive ? KEY_PREFIX_LIVE : KEY_PREFIX_TEST
    const randomPart = crypto.randomBytes(24).toString('base64url').slice(0, KEY_RANDOM_LENGTH)
    const fullKey = `${prefix}_${randomPart}`
    const keyHash = await bcrypt.hash(fullKey, 10)

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

export async function validateApiKey(
    apiKey: string | null,
    origin?: string | null
): Promise<ApiKeyValidationResult> {
    if (!apiKey) {
        return { valid: false, error: 'API key is required' }
    }

    if (!apiKey.startsWith(`${KEY_PREFIX_LIVE}_`) && !apiKey.startsWith(`${KEY_PREFIX_TEST}_`)) {
        return { valid: false, error: 'Invalid API key format' }
    }

    if (apiKey.length < KEY_MIN_LENGTH) {
        return { valid: false, error: 'Invalid API key format' }
    }

    const supabase = getAdminClient()
    const prefix = apiKey.slice(0, 8)

    const { data: keys, error: fetchError } = await supabase
        .from('api_keys')
        .select('*')
        .eq('key_prefix', prefix)
        .eq('is_active', true)

    if (fetchError || !keys || keys.length === 0) {
        await slowCompare(apiKey)
        return { valid: false, error: 'Invalid API key' }
    }

    for (const key of keys) {
        if (key.expires_at && new Date(key.expires_at) < new Date()) {
            continue
        }

        const isMatch = await bcrypt.compare(apiKey, key.key_hash)
        if (!isMatch) {
            continue
        }

        if (key.allowed_origins && key.allowed_origins.length > 0) {
            if (origin) {
                const originAllowed = key.allowed_origins.some((allowed: string) => {
                    if (allowed.startsWith('*.')) {
                        const domain = allowed.slice(2)
                        try {
                            const originHost = new URL(origin).hostname
                            return originHost === domain || originHost.endsWith(`.${domain}`)
                        } catch {
                            return origin === `https://${domain}` || origin === `http://${domain}`
                        }
                    }
                    return origin === allowed || origin === `https://${allowed}` || origin === `http://${allowed}`
                })

                if (!originAllowed) {
                    return { valid: false, error: 'Origin not allowed' }
                }
            } else if (key.allowed_origins.length > 0) {
                return { valid: false, error: 'Origin required' }
            }
        }

        await supabase
            .from('api_keys')
            .update({
                last_used_at: new Date().toISOString(),
                usage_count: key.usage_count + 1,
            })
            .eq('id', key.id)

        if (key.rate_limit_per_minute) {
            try {
                const { data: allowed } = await supabase.rpc('check_api_key_rate_limit', {
                    p_api_key_id: key.id,
                    p_rate_limit: key.rate_limit_per_minute,
                })
                if (allowed === false) {
                    return { valid: false, error: 'Rate limit exceeded' }
                }
            } catch {
                // RPC may be missing until migrations are applied
            }
        }

        return {
            valid: true,
            restaurantId: key.restaurant_id,
            permissions: key.permissions,
            allowedOrigins: key.allowed_origins,
        }
    }

    await slowCompare(apiKey)
    return { valid: false, error: 'Invalid API key' }
}

async function slowCompare(key: string): Promise<void> {
    await bcrypt.compare(key, await bcrypt.hash('invalid', 4))
}

export function getCorsHeaders(
    origin: string | null,
    allowedOrigins: string[]
): Record<string, string> {
    const baseHeaders = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Request-ID',
        'Access-Control-Max-Age': '86400',
    }

    if (!allowedOrigins || allowedOrigins.length === 0) {
        return baseHeaders
    }

    if (origin) {
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed.startsWith('*.')) {
                const domain = allowed.slice(2)
                try {
                    const originHost = new URL(origin).hostname
                    return originHost === domain || originHost.endsWith(`.${domain}`)
                } catch {
                    return false
                }
            }
            return origin === allowed || origin === `https://${allowed}` || origin === `http://${allowed}`
        })

        if (isAllowed) {
            return {
                ...baseHeaders,
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Credentials': 'true',
            }
        }
    }

    return {
        ...baseHeaders,
        'Access-Control-Allow-Origin': 'null',
    }
}

export async function revokeApiKey(keyId: string): Promise<boolean> {
    const supabase = getAdminClient()
    const { error } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', keyId)
    return !error
}

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