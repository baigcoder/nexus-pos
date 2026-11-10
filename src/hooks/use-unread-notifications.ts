import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRestaurantId } from '@/stores/auth-store'

export interface AppNotification {
    id: string
    restaurant_id: string
    staff_id: string | null
    type: 'info' | 'order' | 'alert' | 'success' | 'warning'
    title: string
    message: string | null
    link: string | null
    read: boolean
    created_at: string
}

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

export function useNotifications(limit = 20) {
    const restaurantId = useRestaurantId()
    const [notifications, setNotifications] = useState<AppNotification[]>([])
    const channelRef = useRef<ReturnType<typeof createClient>['channel'] | null>(null)

    const fetchNotifications = useCallback(async () => {
        if (!restaurantId || !checkNotificationsAvailable()) {
            setNotifications([])
            return
        }

        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: false })
                .limit(limit)

            if (error) {
                if (error.code === '42P01' || error.message?.includes('relation') || error.status === 404) {
                    markNotificationsUnavailable()
                }
                setNotifications([])
                return
            }

            markNotificationsAvailable()
            setNotifications(data || [])
        } catch {
            setNotifications([])
        }
    }, [restaurantId, limit])

    const markAsRead = useCallback(async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
        try {
            const supabase = createClient()
            await supabase.from('notifications').update({ read: true }).eq('id', id)
        } catch {}
    }, [])

    const markAllAsRead = useCallback(async () => {
        if (!restaurantId) return
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        try {
            const supabase = createClient()
            await supabase
                .from('notifications')
                .update({ read: true })
                .eq('restaurant_id', restaurantId)
                .eq('read', false)
        } catch {}
    }, [restaurantId])

    useEffect(() => {
        fetchNotifications()

        if (!restaurantId || !checkNotificationsAvailable()) return

        let supabase: ReturnType<typeof createClient>
        try {
            supabase = createClient()
            const channel = supabase
                .channel('notifications-list')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'notifications', filter: `restaurant_id=eq.${restaurantId}` },
                    () => { fetchNotifications() }
                )
                .on('system', { event: 'SUBSCRIBER_ERROR' }, () => {
                    markNotificationsUnavailable()
                    setNotifications([])
                })
                .subscribe((status: any) => {
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        markNotificationsUnavailable()
                        setNotifications([])
                    }
                })

            channelRef.current = channel
        } catch {
            markNotificationsUnavailable()
            setNotifications([])
        }

        return () => {
            if (channelRef.current && supabase) {
                try {
                    supabase.removeChannel(channelRef.current)
                } catch {}
                channelRef.current = null
            }
        }
    }, [restaurantId, fetchNotifications])

    return { notifications, markAsRead, markAllAsRead, refresh: fetchNotifications }
}