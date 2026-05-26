import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'

interface DeliveryStats {
    activeDeliveries: number
    completedToday: number
    myEarnings: number
    avgRating: number | null
}

export function useDeliveryStats() {
    const staff = useAuthStore(state => state.staff)
    const restaurantId = useAuthStore(state => state.restaurant?.id)
    const [stats, setStats] = useState<DeliveryStats | null>(null)
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

            const { data: orders } = await supabase
                .from('orders')
                .select('id, total, status, delivery_fee, staff_id')
                .eq('restaurant_id', restaurantId)
                .eq('staff_id', staff.id)
                .gte('created_at', startOfDay)
                .lte('created_at', endOfDay)

            const allOrders = orders || []
            const activeDeliveries = allOrders.filter((o: Record<string, unknown>) =>
                o.status === 'preparing' || o.status === 'ready' || o.status === 'served'
            ).length
            const completedToday = allOrders.filter((o: Record<string, unknown>) =>
                o.status === 'completed' || o.status === 'paid'
            ).length
            const myEarnings = allOrders.reduce((sum: number, o: Record<string, unknown>) => sum + ((o.delivery_fee as number) || 0), 0)

            const { data: feedback } = await supabase
                    .from('feedback')
                    .select('rating')
                    .eq('restaurant_id', restaurantId)
                    .gte('created_at', startOfDay)

            let avgRating: number | null = null
            if (feedback && feedback.length > 0) {
                const totalRating = feedback.reduce((sum: number, f: Record<string, unknown>) => sum + (f.rating as number), 0)
                avgRating = Math.round((totalRating / feedback.length) * 10) / 10
            }

            setStats({
                activeDeliveries,
                completedToday,
                myEarnings,
                avgRating,
            })
        } catch {
            setStats({
                activeDeliveries: 0,
                completedToday: 0,
                myEarnings: 0,
                avgRating: null,
            })
        } finally {
            setLoading(false)
        }
    }, [staff?.id, restaurantId])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    return { stats, loading, refetch: fetchStats }
}