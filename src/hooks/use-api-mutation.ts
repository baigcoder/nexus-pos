// Generic mutation hook with optimistic updates support
import { useState, useCallback, useRef } from 'react'
import type { ApiResponse } from '@/lib/api'
import { apiCache } from '@/lib/api-utils'

export interface UseApiMutationOptions<TData, TVariables> {
    onSuccess?: (data: TData, variables: TVariables) => void
    onError?: (error: string, variables: TVariables) => void
    onSettled?: (data: TData | null, error: string | null, variables: TVariables) => void
    invalidateKeys?: string[]
}

export interface UseApiMutationResult<TData, TVariables> {
    mutate: (variables: TVariables) => Promise<TData | null>
    mutateAsync: (variables: TVariables) => Promise<ApiResponse<TData>>
    data: TData | null
    error: string | null
    errorCode?: string
    isLoading: boolean
    isError: boolean
    isSuccess: boolean
    reset: () => void
}

export function useApiMutation<TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
    options: UseApiMutationOptions<TData, TVariables> = {}
): UseApiMutationResult<TData, TVariables> {
    const { onSuccess, onError, onSettled, invalidateKeys = [] } = options

    const [data, setData] = useState<TData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [errorCode, setErrorCode] = useState<string | undefined>()
    const [isLoading, setIsLoading] = useState(false)

    const isMountedRef = useRef(true)

    const mutateAsync = useCallback(async (variables: TVariables): Promise<ApiResponse<TData>> => {
        setIsLoading(true)
        setError(null)
        setErrorCode(undefined)

        try {
            const result = await mutationFn(variables)

            if (!isMountedRef.current) return result

            if (result.success && result.data !== null) {
                setData(result.data)
                // Invalidate related cache keys
                invalidateKeys.forEach(key => apiCache.invalidateByPrefix(key))
                onSuccess?.(result.data, variables)
            } else {
                setError(result.error)
                setErrorCode(result.errorCode)
                onError?.(result.error || 'Unknown error', variables)
            }

            onSettled?.(result.data, result.error, variables)
            return result
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            if (isMountedRef.current) {
                setError(message)
            }
            onError?.(message, variables)
            onSettled?.(null, message, variables)
            return { data: null, error: message, success: false }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false)
            }
        }
    }, [mutationFn, onSuccess, onError, onSettled, invalidateKeys])

    const mutate = useCallback(async (variables: TVariables): Promise<TData | null> => {
        const result = await mutateAsync(variables)
        return result.data
    }, [mutateAsync])

    const reset = useCallback(() => {
        setData(null)
        setError(null)
        setErrorCode(undefined)
        setIsLoading(false)
    }, [])

    return {
        mutate,
        mutateAsync,
        data,
        error,
        errorCode,
        isLoading,
        isError: error !== null,
        isSuccess: data !== null && error === null,
        reset,
    }
}

// Optimistic mutation hook
export interface UseOptimisticMutationOptions<TData, TVariables, TContext>
    extends UseApiMutationOptions<TData, TVariables> {
    onMutate?: (variables: TVariables) => TContext | Promise<TContext>
    onRollback?: (context: TContext) => void
}

export function useOptimisticMutation<TData, TVariables, TContext = unknown>(
    mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
    options: UseOptimisticMutationOptions<TData, TVariables, TContext> = {}
): UseApiMutationResult<TData, TVariables> & { context: TContext | null } {
    const { onMutate, onRollback, onError, ...restOptions } = options

    const [context, setContext] = useState<TContext | null>(null)

    const wrappedOnError = useCallback((error: string, variables: TVariables) => {
        if (context && onRollback) {
            onRollback(context)
        }
        onError?.(error, variables)
    }, [context, onRollback, onError])

    const mutation = useApiMutation(mutationFn, {
        ...restOptions,
        onError: wrappedOnError,
    })

    const optimisticMutate = useCallback(async (variables: TVariables) => {
        // Execute optimistic update
        if (onMutate) {
            const ctx = await onMutate(variables)
            setContext(ctx)
        }
        return mutation.mutate(variables)
    }, [mutation.mutate, onMutate])

    return {
        ...mutation,
        mutate: optimisticMutate,
        context,
    }
}
