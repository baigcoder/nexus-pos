// API Utilities for caching, retry logic, and request deduplication
import type { ApiResponse } from './api'

// ============================================
// CACHE MANAGEMENT
// ============================================

interface CacheEntry<T> {
    data: T
    timestamp: number
    expiresAt: number
}

class ApiCache {
    private cache = new Map<string, CacheEntry<unknown>>()
    private defaultTTL = 30000 // 30 seconds

    set<T>(key: string, data: T, ttl?: number): void {
        const now = Date.now()
        this.cache.set(key, {
            data,
            timestamp: now,
            expiresAt: now + (ttl ?? this.defaultTTL),
        })
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key)
            return null
        }

        return entry.data as T
    }

    has(key: string): boolean {
        const entry = this.cache.get(key)
        if (!entry) return false

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key)
            return false
        }

        return true
    }

    invalidate(keyPattern?: string): void {
        if (!keyPattern) {
            this.cache.clear()
            return
        }

        for (const key of this.cache.keys()) {
            if (key.includes(keyPattern)) {
                this.cache.delete(key)
            }
        }
    }

    invalidateByPrefix(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key)
            }
        }
    }
}

export const apiCache = new ApiCache()

// ============================================
// CACHE KEY GENERATION
// ============================================

export function createCacheKey(entity: string, ...params: (string | undefined)[]): string {
    const filteredParams = params.filter(Boolean)
    return `${entity}:${filteredParams.join(':')}`
}

// ============================================
// REQUEST DEDUPLICATION
// ============================================

const pendingRequests = new Map<string, Promise<unknown>>()

export async function deduplicateRequest<T>(
    key: string,
    requestFn: () => Promise<T>
): Promise<T> {
    // Check if there's already a pending request for this key
    const pending = pendingRequests.get(key) as Promise<T> | undefined
    if (pending) {
        return pending
    }

    // Create new request and track it
    const request = requestFn().finally(() => {
        pendingRequests.delete(key)
    })

    pendingRequests.set(key, request)
    return request
}

// ============================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================

interface RetryConfig {
    maxRetries?: number
    baseDelay?: number
    maxDelay?: number
    retryOn?: (error: unknown) => boolean
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryOn: (error: unknown) => {
        // Retry on network errors or 5xx server errors
        if (error instanceof Error) {
            const message = error.message.toLowerCase()
            return (
                message.includes('network') ||
                message.includes('timeout') ||
                message.includes('fetch failed') ||
                message.includes('500') ||
                message.includes('502') ||
                message.includes('503') ||
                message.includes('504')
            )
        }
        return false
    },
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    config?: RetryConfig
): Promise<T> {
    const { maxRetries, baseDelay, maxDelay, retryOn } = {
        ...DEFAULT_RETRY_CONFIG,
        ...config,
    }

    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error

            if (attempt === maxRetries || !retryOn(error)) {
                throw error
            }

            // Calculate delay with exponential backoff and jitter
            const delay = Math.min(
                baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
                maxDelay
            )

            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }

    throw lastError
}

// ============================================
// CACHED API WRAPPER
// ============================================

interface CachedRequestOptions {
    ttl?: number
    forceRefresh?: boolean
    cacheKey?: string
}

export async function withCache<T>(
    key: string,
    fn: () => Promise<ApiResponse<T>>,
    options?: CachedRequestOptions
): Promise<ApiResponse<T>> {
    const { ttl, forceRefresh = false, cacheKey = key } = options ?? {}

    // Check cache unless force refresh
    if (!forceRefresh) {
        const cached = apiCache.get<ApiResponse<T>>(cacheKey)
        if (cached) {
            return cached
        }
    }

    // Make request with deduplication
    const result = await deduplicateRequest(cacheKey, fn)

    // Cache successful responses
    if (result.success && result.data !== null) {
        apiCache.set(cacheKey, result, ttl)
    }

    return result
}

// ============================================
// OPTIMISTIC UPDATE SUPPORT
// ============================================

interface OptimisticConfig<T, R> {
    onOptimisticUpdate?: (data: T) => void
    onSuccess?: (result: R) => void
    onError?: (error: string, rollback: () => void) => void
    invalidateKeys?: string[]
}

export async function withOptimisticUpdate<T, R>(
    optimisticData: T,
    fn: () => Promise<ApiResponse<R>>,
    config: OptimisticConfig<T, R>
): Promise<ApiResponse<R>> {
    const { onOptimisticUpdate, onSuccess, onError, invalidateKeys = [] } = config

    // Apply optimistic update immediately
    onOptimisticUpdate?.(optimisticData)

    try {
        const result = await fn()

        if (result.success) {
            onSuccess?.(result.data!)
            // Invalidate related caches
            invalidateKeys.forEach(key => apiCache.invalidate(key))
        } else {
            // Rollback on server error
            onError?.(result.error || 'Unknown error', () => {
                // Rollback function to be implemented by caller
            })
        }

        return result
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        onError?.(errorMessage, () => { })
        return {
            data: null,
            error: errorMessage,
            success: false,
        }
    }
}

// ============================================
// ERROR TYPES
// ============================================

export class ApiError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode?: number,
        public details?: Record<string, unknown>
    ) {
        super(message)
        this.name = 'ApiError'
    }

    static fromSupabaseError(error: unknown): ApiError {
        if (error && typeof error === 'object') {
            const e = error as { message?: string; code?: string; details?: string; hint?: string }
            return new ApiError(
                e.message || 'Database error',
                e.code || 'SUPABASE_ERROR',
                undefined,
                { details: e.details, hint: e.hint }
            )
        }
        return new ApiError('Unknown error', 'UNKNOWN_ERROR')
    }

    static networkError(message = 'Network error occurred'): ApiError {
        return new ApiError(message, 'NETWORK_ERROR')
    }

    static validationError(message: string, details?: Record<string, unknown>): ApiError {
        return new ApiError(message, 'VALIDATION_ERROR', 400, details)
    }

    static notFoundError(entity: string): ApiError {
        return new ApiError(`${entity} not found`, 'NOT_FOUND', 404)
    }

    static unauthorized(message = 'Unauthorized'): ApiError {
        return new ApiError(message, 'UNAUTHORIZED', 401)
    }
}

// ============================================
// ENHANCED ERROR HANDLER
// ============================================

export function handleApiError(error: unknown): { message: string; code: string } {
    if (error instanceof ApiError) {
        return { message: error.message, code: error.code }
    }

    if (error instanceof Error) {
        // Check for common error patterns
        const message = error.message.toLowerCase()

        if (message.includes('network') || message.includes('fetch')) {
            return { message: 'Network error. Please check your connection.', code: 'NETWORK_ERROR' }
        }

        if (message.includes('unauthorized') || message.includes('jwt')) {
            return { message: 'Session expired. Please log in again.', code: 'UNAUTHORIZED' }
        }

        if (message.includes('duplicate') || message.includes('unique')) {
            return { message: 'This item already exists.', code: 'DUPLICATE_ERROR' }
        }

        if (message.includes('foreign key') || message.includes('reference')) {
            return { message: 'Cannot delete item because it is in use.', code: 'REFERENCE_ERROR' }
        }

        return { message: error.message, code: 'UNKNOWN_ERROR' }
    }

    if (typeof error === 'string') {
        return { message: error, code: 'UNKNOWN_ERROR' }
    }

    return { message: 'An unexpected error occurred', code: 'UNKNOWN_ERROR' }
}

// ============================================
// BATCH REQUEST UTILITY
// ============================================

export async function batchRequests<T>(
    requests: (() => Promise<T>)[],
    concurrency = 3
): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = []

    for (let i = 0; i < requests.length; i += concurrency) {
        const batch = requests.slice(i, i + concurrency)
        const batchResults = await Promise.allSettled(batch.map(fn => fn()))
        results.push(...batchResults)
    }

    return results
}
