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