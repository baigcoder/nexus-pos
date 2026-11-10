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

function isMissingRateLimitTable(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false
    return error.code === '42P01' || /relation .*rate_limits.* does not exist/i.test(error.message || '')
}

function failClosedResult(retryAfterMs = 60_000): RateLimitResult {
    return {
        allowed: false,
        remainingRequests: 0,
        retryAfterMs,
        isLocked: true,
    }
}

export async function resetRateLimitPersistent(key: string): Promise<void> {
    resetRateLimit(key)
    try {
        const { createAdminClient } = await import('@/lib/supabase/admin')
        const supabase = createAdminClient()
        await supabase.from('rate_limits').delete().eq('key', key)
    } catch {
        // Memory entry already cleared
    }
}

export async function checkRateLimitPersistent(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    try {
        const { createAdminClient } = await import('@/lib/supabase/admin')
        const supabase = createAdminClient()
        const now = new Date()
        const { data: row, error: readError } = await supabase
            .from('rate_limits')
            .select('key, count, window_start, locked_until')
            .eq('key', key)
            .maybeSingle()

        if (readError) {
            if (isMissingRateLimitTable(readError)) {
                return checkRateLimit(key, config)
            }
            console.error('Rate limit read failed:', readError.message)
            return failClosedResult()
        }

        const windowStart = row?.window_start ? new Date(row.window_start) : now
        const lockedUntil = row?.locked_until ? new Date(row.locked_until) : null

        if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
            return {
                allowed: false,
                remainingRequests: 0,
                retryAfterMs: lockedUntil.getTime() - now.getTime(),
                isLocked: true,
            }
        }

        const windowExpired = now.getTime() - windowStart.getTime() > config.windowMs
        const nextCount = windowExpired || !row ? 1 : (row.count || 0) + 1
        const allowed = nextCount <= config.maxRequests
        const lockedUntilValue = !allowed && config.lockoutDurationMs
            ? new Date(now.getTime() + config.lockoutDurationMs).toISOString()
            : null

        const { error: writeError } = await supabase.from('rate_limits').upsert({
            key,
            count: nextCount,
            window_start: windowExpired || !row ? now.toISOString() : windowStart.toISOString(),
            locked_until: lockedUntilValue,
            updated_at: now.toISOString(),
        })

        if (writeError) {
            if (isMissingRateLimitTable(writeError)) {
                return checkRateLimit(key, config)
            }
            console.error('Rate limit write failed:', writeError.message)
            return failClosedResult()
        }

        const retryAfterMs = allowed
            ? 0
            : Math.max(
                1000,
                lockedUntilValue
                    ? (config.lockoutDurationMs || config.windowMs)
                    : config.windowMs - (now.getTime() - windowStart.getTime())
            )

        return {
            allowed,
            remainingRequests: Math.max(0, config.maxRequests - nextCount),
            retryAfterMs,
            isLocked: Boolean(lockedUntilValue),
        }
    } catch {
        if (process.env.NODE_ENV === 'production') {
            return failClosedResult()
        }
        return checkRateLimit(key, config)
    }
}