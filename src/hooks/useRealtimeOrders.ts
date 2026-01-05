// React hooks for real-time data subscriptions
import { useEffect, useCallback, useRef, useState } from 'react'
import { useOrderStore } from '@/stores'
import { useAuthStore } from '@/stores'
import { subscribeToOrders, subscribeToTables, unsubscribe } from '@/lib/supabase/realtime'
import { fetchOrders } from '@/lib/api'
import type { Order, Table, OrderStatus } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Hook for real-time order updates
 * Automatically subscribes when component mounts and cleans up on unmount
 */
export function useRealtimeOrders(statusFilter?: OrderStatus | OrderStatus[]) {
    const { restaurant } = useAuthStore()
    const { activeOrders, setActiveOrders, addOrder, updateOrderStatus, removeOrder } = useOrderStore()
    const channelRef = useRef<RealtimeChannel | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Fetch initial orders
    const loadOrders = useCallback(async () => {
        if (!restaurant?.id) {
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        const result = await fetchOrders(restaurant.id)
        if (result.success && result.data) {
            let orders = result.data

            // Apply status filter if provided
            if (statusFilter) {
                const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter]
                orders = orders.filter((o) => statuses.includes(o.status))
            }

            setActiveOrders(orders)
        }
        setIsLoading(false)
    }, [restaurant?.id, statusFilter, setActiveOrders])

    // Handle new order
    const handleNewOrder = useCallback(
        async (order: Order) => {
            // Play sound notification
            if (typeof window !== 'undefined') {
                import('@/lib/sounds').then(({ playNewOrderSound }) => playNewOrderSound())
            }
            // Refetch to get full order with items
            await loadOrders()
        },
        [loadOrders]
    )

    // Handle order update
    const handleOrderUpdate = useCallback(
        (order: Order) => {
            updateOrderStatus(order.id, order.status)
        },
        [updateOrderStatus]
    )

    // Handle order delete
    const handleOrderDelete = useCallback(
        (order: Order) => {
            removeOrder(order.id)
        },
        [removeOrder]
    )

    // Subscribe to realtime updates
    useEffect(() => {
        if (!restaurant?.id) {
            setIsLoading(false)
            return
        }

        // Initial load
        loadOrders()

        // Subscribe to realtime
        const channel = subscribeToOrders(
            restaurant.id,
            handleNewOrder,
            handleOrderUpdate,
            handleOrderDelete
        )
        channelRef.current = channel

        // Cleanup
        return () => {
            if (channelRef.current) {
                unsubscribe(channelRef.current)
                channelRef.current = null
            }
        }
    }, [restaurant?.id, loadOrders, handleNewOrder, handleOrderUpdate, handleOrderDelete])

    // Return active orders (optionally filtered)
    const filteredOrders = statusFilter
        ? activeOrders.filter((o) => {
            const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter]
            return statuses.includes(o.status)
        })
        : activeOrders

    return {
        orders: filteredOrders,
        isLoading,
        refresh: loadOrders,
    }
}

/**
 * Hook for real-time table updates
 */
export function useRealtimeTables(onTableUpdate?: (table: Table) => void) {
    const { restaurant } = useAuthStore()
    const channelRef = useRef<RealtimeChannel | null>(null)

    useEffect(() => {
        if (!restaurant?.id) return

        const channel = subscribeToTables(restaurant.id, (table) => {
            if (onTableUpdate) onTableUpdate(table)
        })
        channelRef.current = channel

        return () => {
            if (channelRef.current) {
                unsubscribe(channelRef.current)
                channelRef.current = null
            }
        }
    }, [restaurant?.id, onTableUpdate])
}

/**
 * Hook for kitchen display - filters to active orders only
 */
export function useKitchenOrders() {
    return useRealtimeOrders(['pending', 'preparing', 'ready'])
}

/**
 * Hook for all orders display
 */
export function useAllOrders() {
    return useRealtimeOrders()
}
