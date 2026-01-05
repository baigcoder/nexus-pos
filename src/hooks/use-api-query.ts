// Generic query hook with SWR-like patterns
import { useState, useEffect, useCallback, useRef } from 'react'
import type { ApiResponse } from '@/lib/api'

export interface UseApiQueryOptions<T> {
    enabled?: boolean
    refetchOnWindowFocus?: boolean
    refetchInterval?: number
    onSuccess?: (data: T) => void
    onError?: (error: string) => void
    staleTime?: number
}

export interface UseApiQueryResult<T> {
    data: T | null
    error: string | null
    errorCode?: string
    isLoading: boolean
    isError: boolean
    isSuccess: boolean
    refetch: () => Promise<void>
    setData: (data: T | null) => void
}

export function useApiQuery<T>(
    queryKey: (string | undefined)[],
    queryFn: () => Promise<ApiResponse<T>>,
    options: UseApiQueryOptions<T> = {}
): UseApiQueryResult<T> {
    const {
        enabled = true,
        refetchOnWindowFocus = false,
        refetchInterval,
        onSuccess,
        onError,
        staleTime = 0,
    } = options

    const [data, setData] = useState<T | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [errorCode, setErrorCode] = useState<string | undefined>()
    const [isLoading, setIsLoading] = useState(false)

    // Track last fetch time for stale data detection
    const lastFetchRef = useRef<number>(0)
    const isMountedRef = useRef(true)

    // Generate a stable key from query key array
    const keyString = queryKey.filter(Boolean).join(':')

    const fetchData = useCallback(async () => {
        // Don't fetch if not enabled or key parts are missing
        if (!enabled || queryKey.some(k => k === undefined)) {
            return
        }

        // Check if data is still fresh
        if (staleTime > 0 && Date.now() - lastFetchRef.current < staleTime && data !== null) {
            return
        }

        setIsLoading(true)
        setError(null)
        setErrorCode(undefined)

        try {
            const result = await queryFn()

            if (!isMountedRef.current) return

            if (result.success && result.data !== null) {
                setData(result.data)
                lastFetchRef.current = Date.now()
                onSuccess?.(result.data)
            } else {
                setError(result.error)
                setErrorCode(result.errorCode)
                onError?.(result.error || 'Unknown error')
            }
        } catch (err) {
            if (!isMountedRef.current) return
            const message = err instanceof Error ? err.message : 'Unknown error'
            setError(message)
            onError?.(message)
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false)
            }
        }
    }, [enabled, keyString, queryFn, onSuccess, onError, staleTime, data])

    // Initial fetch
    useEffect(() => {
        isMountedRef.current = true
        fetchData()
        return () => {
            isMountedRef.current = false
        }
    }, [fetchData])

    // Refetch on window focus
    useEffect(() => {
        if (!refetchOnWindowFocus) return

        const handleFocus = () => {
            fetchData()
        }

        window.addEventListener('focus', handleFocus)
        return () => window.removeEventListener('focus', handleFocus)
    }, [refetchOnWindowFocus, fetchData])

    // Refetch interval
    useEffect(() => {
        if (!refetchInterval || !enabled) return

        const interval = setInterval(fetchData, refetchInterval)
        return () => clearInterval(interval)
    }, [refetchInterval, enabled, fetchData])

    return {
        data,
        error,
        errorCode,
        isLoading,
        isError: error !== null,
        isSuccess: data !== null && error === null,
        refetch: fetchData,
        setData,
    }
}

// Hook for queries that depend on auth state
export function useAuthenticatedQuery<T>(
    queryKey: (string | undefined)[],
    queryFn: () => Promise<ApiResponse<T>>,
    options: UseApiQueryOptions<T> = {}
) {
    // Import auth store dynamically to avoid circular deps
    const { useAuthStore } = require('@/stores')
    const { restaurant } = useAuthStore()

    return useApiQuery<T>(
        [...queryKey, restaurant?.id],
        queryFn,
        {
            ...options,
            enabled: options.enabled !== false && !!restaurant?.id,
        }
    )
}
