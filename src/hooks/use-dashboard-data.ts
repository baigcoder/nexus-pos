import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRestaurantId } from '@/stores/auth-store'
import { dedupedFetch, invalidateCache } from '@/lib/dashboard-cache'
import { getStartOfDay, getEndOfDay, getDaysAgo } from '@/lib/format'
import type { OrderStatus } from '@/types/database'

function getSupabase() {
    return createClient()
}

export interface DashboardStats {
    todayRevenue: number
    todayOrders: number
    avgOrderValue: number
    pendingOrders: number
    preparingOrders: number
    completedOrders: number
    activeTables: number
    totalTables: number
    activeStaff: number
    totalStaff: number
    yesterdayRevenue: number
    revenueChange: number | null
    orderChange: number | null
}

export interface RevenueDataPoint {
    date: string
    revenue: number
    orders: number
}

export interface StatusBreakdown {
    status: OrderStatus
    count: number
}

export interface HourlyDataPoint {
    hour: number
    orders: number
}

export interface CategoryBreakdown {
    category: string
    count: number
    revenue: number
}

export interface RecentOrder {
    id: string
    order_number: number
    status: OrderStatus
    total: number
    created_at: string
    customer_name?: string
    table_number?: string
}

export function useDashboardStats() {
    const restaurantId = useRestaurantId()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    const fetchStats = useCallback(async () => {
        if (!restaurantId) {
            setLoading(false)
            return
        }

        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()

        setLoading(true)
        setError(null)

        try {
            const cacheKey = `dashboard-stats:${restaurantId}`
            const cached = await dedupedFetch(cacheKey, async () => {
                const now = new Date()
                const startOfDay = getStartOfDay(now)
                const endOfDay = getEndOfDay(now)
                const yesterdayStart = getStartOfDay(getDaysAgo(1))
                const yesterdayEnd = getEndOfDay(getDaysAgo(1))

                const safeQuery = async <T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> => {
                    try {
                        const result = await query
                        if (result.error) return []
                        return result.data ?? []
                    } catch {
                        return []
                    }
                }

                const [
                    orders,
                    yesterdayOrders,
                    tables,
                    staff,
                ] = await Promise.all([
                    safeQuery(getSupabase()
                        .from('orders')
                        .select('id, total, status, created_at')
                        .eq('restaurant_id', restaurantId!)
                        .gte('created_at', startOfDay.toISOString())
                        .lte('created_at', endOfDay.toISOString())),
                    safeQuery(getSupabase()
                        .from('orders')
                        .select('id, total')
                        .eq('restaurant_id', restaurantId!)
                        .gte('created_at', yesterdayStart.toISOString())
                        .lte('created_at', yesterdayEnd.toISOString())),
                    safeQuery(getSupabase()
                        .from('tables')
                        .select('id, status')
                        .eq('restaurant_id', restaurantId!)),
                    safeQuery(getSupabase()
                        .from('staff')
                        .select('id, is_active')
                        .eq('restaurant_id', restaurantId!)),
                ])

                const todayRevenue = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
                const todayOrders = orders.length
                const avgOrderValue = todayOrders > 0 ? todayRevenue / todayOrders : 0

                const pendingOrders = orders.filter((o: any) => o.status === 'pending').length
                const preparingOrders = orders.filter((o: any) => o.status === 'preparing' || o.status === 'ready').length
                const completedOrders = orders.filter((o: any) => o.status === 'served' || o.status === 'paid').length

                const activeTables = tables.filter((t: any) => t.status === 'occupied').length
                const totalTables = tables.length

                const activeStaff = staff.filter((s: any) => s.is_active).length
                const totalStaff = staff.length

                const yesterdayRevenue = yesterdayOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
                const revenueChange = yesterdayRevenue > 0
                    ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
                    : null
                const orderChange = yesterdayOrders.length > 0
                    ? ((todayOrders - yesterdayOrders.length) / yesterdayOrders.length) * 100
                    : null

                return {
                    todayRevenue,
                    todayOrders,
                    avgOrderValue,
                    pendingOrders,
                    preparingOrders,
                    completedOrders,
                    activeTables,
                    totalTables,
                    activeStaff,
                    totalStaff,
                    yesterdayRevenue,
                    revenueChange,
                    orderChange,
                } as DashboardStats
            }, 30_000)

            setStats(cached)
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return
            setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
        } finally {
            setLoading(false)
        }
    }, [restaurantId])

    useEffect(() => {
        fetchStats()
        return () => {
            if (abortRef.current) abortRef.current.abort()
        }
    }, [fetchStats])

    return { stats, loading, error, refetch: () => { invalidateCache('dashboard-stats'); fetchStats() } }
}

export function useRevenueChart(days: number = 7) {
    const restaurantId = useRestaurantId()
    const [data, setData] = useState<RevenueDataPoint[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        if (!restaurantId) {
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const cacheKey = `revenue-chart:${restaurantId}:${days}`
            const cached = await dedupedFetch(cacheKey, async () => {
                const startDate = getDaysAgo(days)
                const endDate = new Date()

                const { data: orders, error } = await getSupabase()
                    .from('orders')
                    .select('created_at, total')
                    .eq('restaurant_id', restaurantId!)
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString())

                if (error) throw error

                const groupedData: Record<string, { revenue: number; orders: number }> = {}
                for (let i = 0; i < days; i++) {
                    const date = getDaysAgo(days - 1 - i)
                    const dateKey = date.toISOString().split('T')[0]
                    groupedData[dateKey] = { revenue: 0, orders: 0 }
                }

                orders?.forEach((order: any) => {
                    const dateKey = order.created_at.split('T')[0]
                    if (groupedData[dateKey]) {
                        groupedData[dateKey].revenue += order.total || 0
                        groupedData[dateKey].orders += 1
                    }
                })

                return Object.entries(groupedData)
                    .map(([date, values]) => ({
                        date,
                        revenue: values.revenue,
                        orders: values.orders,
                    }))
                    .sort((a, b) => a.date.localeCompare(b.date))
            }, 60_000)

            setData(cached)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load revenue data')
        } finally {
            setLoading(false)
        }
    }, [restaurantId, days])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    return { data, loading, error, refetch: () => { invalidateCache('revenue-chart'); fetchData() } }
}

export function useOrdersByStatus() {
    const restaurantId = useRestaurantId()
    const [data, setData] = useState<StatusBreakdown[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        if (!restaurantId) {
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const cacheKey = `orders-status:${restaurantId}`
            const cached = await dedupedFetch(cacheKey, async () => {
                const thirtyDaysAgo = getDaysAgo(30)

                const { data: orders, error } = await getSupabase()
                    .from('orders')
                    .select('status')
                    .eq('restaurant_id', restaurantId!)
                    .gte('created_at', thirtyDaysAgo.toISOString())

                if (error) throw error

                const statusCounts: Record<string, number> = {
                    pending: 0,
                    preparing: 0,
                    ready: 0,
                    completed: 0,
                    paid: 0,
                    cancelled: 0,
                }

                orders?.forEach((order: any) => {
                    if (order.status in statusCounts) {
                        statusCounts[order.status]++
                    }
                })

                return Object.entries(statusCounts)
                    .filter(([_, count]) => count > 0)
                    .map(([status, count]) => ({
                        status: status as OrderStatus,
                        count,
                    }))
            }, 60_000)

            setData(cached)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load order status data')
        } finally {
            setLoading(false)
        }
    }, [restaurantId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    return { data, loading, error, refetch: () => { invalidateCache('orders-status'); fetchData() } }
}

export function useHourlyOrders() {
    const restaurantId = useRestaurantId()
    const [data, setData] = useState<HourlyDataPoint[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        if (!restaurantId) {
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const now = new Date()
            const startOfDay = getStartOfDay(now)
            const endOfDay = getEndOfDay(now)

            const { data: orders, error } = await getSupabase()
                .from('orders')
                .select('created_at')
                .eq('restaurant_id', restaurantId!)
                .gte('created_at', startOfDay.toISOString())
                .lte('created_at', endOfDay.toISOString())

            if (error) throw error

            const hourlyData: Record<number, number> = {}
            for (let i = 6; i <= 23; i++) {
                hourlyData[i] = 0
            }

            orders?.forEach((order: any) => {
                const hour = new Date(order.created_at).getHours()
                if (hour in hourlyData) {
                    hourlyData[hour]++
                }
            })

            const chartData: HourlyDataPoint[] = Object.entries(hourlyData)
                .map(([hour, orders]) => ({
                    hour: parseInt(hour),
                    orders,
                }))
                .sort((a, b) => a.hour - b.hour)

            setData(chartData)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load hourly data')
        } finally {
            setLoading(false)
        }
    }, [restaurantId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    return { data, loading, error, refetch: fetchData }
}

export function useCategoryBreakdown() {
    const restaurantId = useRestaurantId()
    const [data, setData] = useState<CategoryBreakdown[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        if (!restaurantId) {
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const cacheKey = `category-breakdown:${restaurantId}`
            const cached = await dedupedFetch(cacheKey, async () => {
                const { data: orderItems, error } = await getSupabase()
                    .from('order_items')
                    .select(`
                        id,
                        subtotal,
                        menu_item:menu_items(
                            id,
                            name,
                            category:categories(
                                id,
                                name
                            )
                        )
                    `)
                    .limit(5000)

                if (error) throw error

                const categoryData: Record<string, { count: number; revenue: number }> = {}

                orderItems?.forEach((item: any) => {
                    const categoryName = (item.menu_item as Record<string, unknown>)?.category
                        ? ((item.menu_item as Record<string, unknown>).category as Record<string, unknown>)?.name as string || 'Uncategorized'
                        : 'Uncategorized'
                    if (!categoryData[categoryName]) {
                        categoryData[categoryName] = { count: 0, revenue: 0 }
                    }
                    categoryData[categoryName].count++
                    categoryData[categoryName].revenue += item.subtotal || 0
                })

                return Object.entries(categoryData)
                    .map(([category, values]) => ({
                        category,
                        count: values.count,
                        revenue: values.revenue,
                    }))
                    .sort((a, b) => b.revenue - a.revenue)
            }, 120_000)

            setData(cached)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load category data')
        } finally {
            setLoading(false)
        }
    }, [restaurantId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    return { data, loading, error, refetch: () => { invalidateCache('category-breakdown'); fetchData() } }
}

export function useRecentOrders(limit: number = 10) {
    const restaurantId = useRestaurantId()
    const [orders, setOrders] = useState<RecentOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchOrders = useCallback(async () => {
        if (!restaurantId) {
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { data: ordersData, error } = await getSupabase()
                .from('orders')
                .select(`
                    id,
                    order_number,
                    status,
                    total,
                    created_at,
                    table:tables(table_number)
                `)
                .eq('restaurant_id', restaurantId!)
                .order('created_at', { ascending: false })
                .limit(limit)

            if (error) throw error

            const formattedOrders: RecentOrder[] = (ordersData || []).map((order: any) => ({
                id: order.id,
                order_number: order.order_number,
                status: order.status,
                total: order.total,
                created_at: order.created_at,
                table_number: (order.table as Record<string, unknown>)?.table_number as string | undefined,
            }))

            setOrders(formattedOrders)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load recent orders')
        } finally {
            setLoading(false)
        }
    }, [restaurantId, limit])

    useEffect(() => {
        fetchOrders()
    }, [fetchOrders])

    return { orders, loading, error, refetch: fetchOrders }
}