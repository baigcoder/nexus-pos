import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'

interface WaiterStats {
    myOrders: number
    myRevenue: number
    myTips: number
    completedToday: number
}

export function useWaiterStats() {
    const staff = useAuthStore(state => state.staff)
    const restaurantId = useAuthStore(state => state.restaurant?.id)
    const [stats, setStats] = useState<WaiterStats | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchStats = useCallback(async () => {
        if (!staff?.id || !restaurantId) {
            setLoading(false)
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()
            const now = new Date()
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString()
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()

            const { data: orders, error } = await supabase
                .from('orders')
                .select('id, total, status, tip')
                .eq('restaurant_id', restaurantId)
                .eq('staff_id', staff.id)
                .gte('created_at', startOfDay)
                .lte('created_at', endOfDay)

            if (error) throw error

            const allOrders = orders || []
            const completedOrders = allOrders.filter((o: Record<string, unknown>) =>
                o.status === 'completed' || o.status === 'paid'
            )
            const totalRevenue = allOrders.reduce((sum: number, o: Record<string, unknown>) => sum + (o.total as number || 0), 0)
            const totalTips = allOrders.reduce((sum: number, o: Record<string, unknown>) => sum + (o.tip as number || 0), 0)

            setStats({
                myOrders: allOrders.length,
                myRevenue: totalRevenue,
                myTips: totalTips,
                completedToday: completedOrders.length,
            })
        } catch {
            setStats(null)
        } finally {
            setLoading(false)
        }
    }, [staff?.id, restaurantId])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    return { stats, loading, refetch: fetchStats }
}