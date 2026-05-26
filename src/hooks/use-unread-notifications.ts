import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRestaurantId } from '@/stores/auth-store'

const NOTIFICATIONS_AVAILABLE_KEY = 'notifications_table_available'

function checkNotificationsAvailable(): boolean {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(NOTIFICATIONS_AVAILABLE_KEY) !== 'false'
}

function markNotificationsUnavailable(): void {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(NOTIFICATIONS_AVAILABLE_KEY, 'false')
}

function markNotificationsAvailable(): void {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(NOTIFICATIONS_AVAILABLE_KEY, 'true')
}

export function useUnreadNotifications() {
    const restaurantId = useRestaurantId()
    const [count, setCount] = useState(0)
    const channelRef = useRef<ReturnType<typeof createClient>['channel'] | null>(null)

    const fetchCount = useCallback(async () => {
        if (!restaurantId) {
            setCount(0)
            return
        }

        if (!checkNotificationsAvailable()) {
            setCount(0)
            return
        }

        try {
            const supabase = createClient()
            const { count: notificationCount, error } = await supabase
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('restaurant_id', restaurantId)
                .eq('read', false)

            if (error) {
                if (error.code === '42P01' || error.message?.includes('relation') || error.status === 404) {
                    markNotificationsUnavailable()
                }
                setCount(0)
                return
            }

            markNotificationsAvailable()
            setCount(notificationCount || 0)
        } catch {
            setCount(0)
        }
    }, [restaurantId])

    useEffect(() => {
        fetchCount()

        if (!restaurantId || !checkNotificationsAvailable()) return

        let supabase: ReturnType<typeof createClient>
        try {
            supabase = createClient()
            const channel = supabase
                .channel('notifications-count')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'notifications', filter: `restaurant_id=eq.${restaurantId}` },
                    () => { fetchCount() }
                )
                .on('system', { event: 'SUBSCRIBER_ERROR' }, () => {
                    markNotificationsUnavailable()
                    setCount(0)
                })
                .subscribe((status: any) => {
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        markNotificationsUnavailable()
                        setCount(0)
                    }
                })

            channelRef.current = channel
        } catch {
            markNotificationsUnavailable()
            setCount(0)
        }

        return () => {
            if (channelRef.current && supabase) {
                try {
                    supabase.removeChannel(channelRef.current)
                } catch {}
                channelRef.current = null
            }
        }
    }, [restaurantId, fetchCount])

    return count
}