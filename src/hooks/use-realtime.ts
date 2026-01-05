// Enhanced real-time subscription hook with connection status and auto-reconnect
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface RealtimeConfig {
    table: string
    schema?: string
    filter?: string
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
    onChange?: () => void
    enabled?: boolean
    debounceMs?: number
}

export interface UseRealtimeResult {
    status: ConnectionStatus
    error: string | null
    isConnected: boolean
    reconnect: () => void
}

export function useRealtime(config: RealtimeConfig): UseRealtimeResult {
    const {
        table,
        schema = 'public',
        filter,
        event = '*',
        onChange,
        enabled = true,
        debounceMs = 0,
    } = config

    const [status, setStatus] = useState<ConnectionStatus>('connecting')
    const [error, setError] = useState<string | null>(null)

    const channelRef = useRef<RealtimeChannel | null>(null)
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pendingEventsRef = useRef<number>(0)

    const processEvents = useCallback(() => {
        if (pendingEventsRef.current > 0) {
            pendingEventsRef.current = 0
            onChange?.()
        }
    }, [onChange])

    const handleChange = useCallback(() => {
        if (debounceMs > 0) {
            pendingEventsRef.current++

            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current)
            }

            debounceTimeoutRef.current = setTimeout(processEvents, debounceMs)
        } else {
            onChange?.()
        }
    }, [debounceMs, processEvents, onChange])

    const scheduleReconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
        }

        reconnectTimeoutRef.current = setTimeout(() => {
            if (channelRef.current) {
                const supabase = createClient()
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
            // Will reconnect on next effect run
            setStatus('disconnected')
        }, 5000)
    }, [])

    const disconnect = useCallback(() => {
        if (channelRef.current) {
            const supabase = createClient()
            supabase.removeChannel(channelRef.current)
            channelRef.current = null
        }
        setStatus('disconnected')
    }, [])

    const reconnect = useCallback(() => {
        disconnect()
        // Status change will trigger reconnect via useEffect
    }, [disconnect])

    // Connect on mount or when enabled changes
    useEffect(() => {
        if (!enabled) {
            disconnect()
            return
        }

        setStatus('connecting')
        setError(null)

        const supabase = createClient()
        const channelName = `${table}-changes-${Date.now()}`

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const channel = (supabase.channel(channelName) as any)
            .on(
                'postgres_changes',
                {
                    event,
                    schema,
                    table,
                    ...(filter ? { filter } : {}),
                },
                handleChange
            )
            .subscribe((subscriptionStatus: string) => {
                if (subscriptionStatus === 'SUBSCRIBED') {
                    setStatus('connected')
                    setError(null)
                } else if (subscriptionStatus === 'CHANNEL_ERROR') {
                    setStatus('error')
                    setError('Channel error')
                    scheduleReconnect()
                } else if (subscriptionStatus === 'TIMED_OUT') {
                    setStatus('error')
                    setError('Connection timed out')
                    scheduleReconnect()
                }
            })

        channelRef.current = channel

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current)
            }
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [enabled, table, schema, filter, event, handleChange, disconnect, scheduleReconnect])

    // Handle visibility change for reconnection
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && status === 'disconnected' && enabled) {
                setStatus('connecting')
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [status, enabled])

    return {
        status,
        error,
        isConnected: status === 'connected',
        reconnect,
    }
}

// Hook for subscribing to order changes
export function useOrdersRealtime(
    restaurantId: string | undefined,
    onChange: () => void
) {
    return useRealtime({
        table: 'orders',
        filter: restaurantId ? `restaurant_id=eq.${restaurantId}` : undefined,
        onChange,
        enabled: !!restaurantId,
        debounceMs: 100,
    })
}

// Hook for subscribing to table status changes
export function useTablesRealtime(
    restaurantId: string | undefined,
    onChange: () => void
) {
    return useRealtime({
        table: 'tables',
        filter: restaurantId ? `restaurant_id=eq.${restaurantId}` : undefined,
        onChange,
        enabled: !!restaurantId,
    })
}

// Hook for subscribing to order items changes
export function useOrderItemsRealtime(
    restaurantId: string | undefined,
    onChange: () => void
) {
    return useRealtime({
        table: 'order_items',
        onChange,
        enabled: !!restaurantId,
        debounceMs: 50,
    })
}
