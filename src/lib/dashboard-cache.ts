interface CacheEntry<T> {
    data: T
    timestamp: number
}

const DEFAULT_TTL = 5 * 60 * 1000

const cache = new Map<string, CacheEntry<unknown>>()
const pendingRequests = new Map<string, Promise<unknown>>()

export function getCached<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
    const entry = cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > ttl) {
        cache.delete(key)
        return null
    }
    return entry.data as T
}

export function setCached<T>(key: string, data: T): void {
    cache.set(key, { data, timestamp: Date.now() })
}

export function invalidateCache(keyPrefix?: string): void {
    if (!keyPrefix) {
        cache.clear()
        return
    }
    for (const key of cache.keys()) {
        if (key.startsWith(keyPrefix)) {
            cache.delete(key)
        }
    }
}

export async function dedupedFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = DEFAULT_TTL
): Promise<T> {
    const cached = getCached<T>(key, ttl)
    if (cached !== null) return cached

    const pending = pendingRequests.get(key) as Promise<T> | undefined
    if (pending) return pending

    const promise = fetcher().then((data) => {
        setCached(key, data)
        pendingRequests.delete(key)
        return data
    }).catch((error) => {
        pendingRequests.delete(key)
        throw error
    })

    pendingRequests.set(key, promise)
    return promise
}

export function cleanupCache(): void {
    const now = Date.now()
    for (const [key, entry] of cache) {
        if (now - entry.timestamp > DEFAULT_TTL * 2) {
            cache.delete(key)
        }
    }
}

if (typeof window !== 'undefined') {
    setInterval(cleanupCache, 60_000)
}