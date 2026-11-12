import type { SupabaseClient } from '@supabase/supabase-js'

export interface RateLimitEntry {
    count: number
    windowStart: number
    lockedUntil?: number
}

export interface RateLimitConfig {
    maxRequests: number
    windowMs: number
    lockoutDurationMs?: number
}

export interface RateLimitResult {
    allowed: boolean
    remainingRequests: number
    retryAfterMs: number
    isLocked: boolean
}

const store = new Map<string, RateLimitEntry>()

const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupExpired(): void {
    const now = Date.now()
    if (now - lastCleanup < CLEANUP_INTERVAL) return
    lastCleanup = now

    for (const [key, entry] of store) {
        if (entry.lockedUntil && entry.lockedUntil < now) {
            store.delete(key)
        } else if (now - entry.windowStart > 2 * 60 * 60 * 1000) {
            store.delete(key)
        }
    }
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
    cleanupExpired()

    const now = Date.now()
    const entry = store.get(key)

    if (entry?.lockedUntil && entry.lockedUntil > now) {
        return {
            allowed: false,
            remainingRequests: 0,
            retryAfterMs: entry.lockedUntil - now,
            isLocked: true,
        }
    }

    if (!entry || now - entry.windowStart > config.windowMs) {
        store.set(key, { count: 1, windowStart: now })
        return {
            allowed: true,
            remainingRequests: config.maxRequests - 1,
            retryAfterMs: 0,
            isLocked: false,
        }
    }

    if (entry.count >= config.maxRequests) {
        const newEntry: RateLimitEntry = {
            ...entry,
            lockedUntil: config.lockoutDurationMs
                ? now + config.lockoutDurationMs
                : undefined,
        }
        store.set(key, newEntry)

        return {
            allowed: false,
            remainingRequests: 0,
            retryAfterMs: config.windowMs - (now - entry.windowStart),
            isLocked: !!config.lockoutDurationMs,
        }
    }

    entry.count += 1
    store.set(key, entry)

    return {
        allowed: true,
        remainingRequests: config.maxRequests - entry.count,
        retryAfterMs: 0,
        isLocked: false,
    }
}

export function resetRateLimit(key: string): void {
    store.delete(key)
}

export function getRemainingRequests(key: string, maxRequests: number, windowMs: number): number {
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now - entry.windowStart > windowMs) {
        return maxRequests
    }

    return Math.max(0, maxRequests - entry.count)
}

export function getRateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): Record<string, string> {
    const headers: Record<string, string> = {
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': String(result.remainingRequests),
    }

    if (!result.allowed) {
        headers['Retry-After'] = String(Math.ceil(result.retryAfterMs / 1000))
    }

    return headers
}
/*
 * Durable, failure-counting lockout stored in otp_rate_limits (identifier_type 'key').
 * The in-memory store above resets on every serverless instance, so it can't stop PIN brute force alone.
 * Only failures are counted, so a busy restaurant with many staff logins never locks itself out.
 * DB errors fail open (the in-memory limit still applies) so an outage can't lock everyone out.
 */
type DurableConfig = { maxRequests: number; windowMs: number }

export async function getDurableLockoutSeconds(supabase: SupabaseClient, key: string, config: DurableConfig): Promise<number> {
    try {
        const { data } = await supabase
            .from('otp_rate_limits')
            .select('request_count, first_request')
            .eq('identifier', key)
            .eq('identifier_type', 'key')
            .maybeSingle()
        if (!data || data.request_count < config.maxRequests) return 0
        const remainingMs = new Date(data.first_request).getTime() + config.windowMs - Date.now()
        return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0
    } catch {
        return 0
    }
}

export async function recordDurableFailure(supabase: SupabaseClient, key: string, config: DurableConfig): Promise<void> {
    try {
        await supabase.rpc('check_otp_rate_limit', {
            p_identifier: key,
            p_identifier_type: 'key',
            p_max_requests: config.maxRequests,
            p_window_minutes: Math.max(1, Math.round(config.windowMs / 60000)),
        })
    } catch {
        // fail open
    }
}

export async function clearDurableFailures(supabase: SupabaseClient, key: string): Promise<void> {
    try {
        await supabase.from('otp_rate_limits').delete().eq('identifier', key).eq('identifier_type', 'key')
    } catch {
        // fail open
    }
}
