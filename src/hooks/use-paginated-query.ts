import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PaginationState<T> {
    data: T[]
    loading: boolean
    error: string | null
    page: number
    pageSize: number
    total: number
    hasMore: boolean
    nextPage: () => void
    prevPage: () => void
    goToPage: (page: number) => void
    refetch: () => void
}

export function usePaginatedQuery<T extends Record<string, unknown>>(
    table: string,
    restaurantId: string | undefined,
    options: {
        pageSize?: number
        select?: string
        filters?: Record<string, string>
        orderBy?: string
        ascending?: boolean
    } = {}
): PaginationState<T> {
    const {
        pageSize = 20,
        select = '*',
        filters = {},
        orderBy = 'created_at',
        ascending = false,
    } = options

    const [data, setData] = useState<T[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const abortRef = useRef<AbortController | null>(null)

    const fetchPage = useCallback(async (targetPage: number) => {
        if (!restaurantId) {
            setLoading(false)
            return
        }

        if (abortRef.current) {
            abortRef.current.abort()
        }
        abortRef.current = new AbortController()

        setLoading(true)
        setError(null)

        try {
            const supabase = createClient()
            const from = (targetPage - 1) * pageSize
            const to = from + pageSize - 1

            let query = supabase
                .from(table)
                .select(select, { count: 'exact' })
                .eq('restaurant_id', restaurantId)
                .range(from, to)
                .order(orderBy, { ascending })

            for (const [key, value] of Object.entries(filters)) {
                query = query.eq(key, value)
            }

            const { data: results, count, error: fetchError } = await query

            if (fetchError) throw fetchError

            setData((results || []) as T[])
            setTotal(count || 0)
            setPage(targetPage)
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                setError(err.message || 'Failed to fetch data')
            }
        } finally {
            setLoading(false)
        }
    }, [restaurantId, table, select, pageSize, orderBy, ascending, filters])

    useEffect(() => {
        fetchPage(1)
    }, [fetchPage])

    const totalPages = Math.ceil(total / pageSize)

    return {
        data,
        loading,
        error,
        page,
        pageSize,
        total,
        hasMore: page < totalPages,
        nextPage: () => { if (page < totalPages) fetchPage(page + 1) },
        prevPage: () => { if (page > 1) fetchPage(page - 1) },
        goToPage: (p: number) => { if (p >= 1 && p <= totalPages) fetchPage(p) },
        refetch: () => fetchPage(page),
    }
}