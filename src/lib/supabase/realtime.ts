// Supabase Realtime subscription utilities
import { createClient } from './client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Order, Table, OrderItem } from '@/types'

type OrderChangeHandler = (payload: RealtimePostgresChangesPayload<Order>) => void
type TableChangeHandler = (payload: RealtimePostgresChangesPayload<Table>) => void
type OrderItemChangeHandler = (payload: RealtimePostgresChangesPayload<OrderItem>) => void

/**
 * Create a realtime subscription for orders in a restaurant
 */
export function subscribeToOrders(
    restaurantId: string,
    onInsert?: (order: Order) => void,
    onUpdate?: (order: Order) => void,
    onDelete?: (oldOrder: Order) => void
): RealtimeChannel {
    const supabase = createClient()

    const channel = supabase
        .channel(`orders:${restaurantId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'orders',
                filter: `restaurant_id=eq.${restaurantId}`,
            },
            (payload) => {
                if (onInsert) onInsert(payload.new as Order)
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `restaurant_id=eq.${restaurantId}`,
            },
            (payload) => {
                if (onUpdate) onUpdate(payload.new as Order)
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'orders',
                filter: `restaurant_id=eq.${restaurantId}`,
            },
            (payload) => {
                if (onDelete) onDelete(payload.old as Order)
            }
        )
        .subscribe()

    return channel
}

/**
 * Create a realtime subscription for order items
 */
export function subscribeToOrderItems(
    orderId: string,
    onInsert?: (item: OrderItem) => void,
    onUpdate?: (item: OrderItem) => void,
    onDelete?: (oldItem: OrderItem) => void
): RealtimeChannel {
    const supabase = createClient()

    const channel = supabase
        .channel(`order_items:${orderId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'order_items',
                filter: `order_id=eq.${orderId}`,
            },
            (payload) => {
                if (payload.eventType === 'INSERT' && onInsert) {
                    onInsert(payload.new as OrderItem)
                } else if (payload.eventType === 'UPDATE' && onUpdate) {
                    onUpdate(payload.new as OrderItem)
                } else if (payload.eventType === 'DELETE' && onDelete) {
                    onDelete(payload.old as OrderItem)
                }
            }
        )
        .subscribe()

    return channel
}

/**
 * Create a realtime subscription for tables in a restaurant
 */
export function subscribeToTables(
    restaurantId: string,
    onUpdate?: (table: Table) => void
): RealtimeChannel {
    const supabase = createClient()

    const channel = supabase
        .channel(`tables:${restaurantId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'tables',
                filter: `restaurant_id=eq.${restaurantId}`,
            },
            (payload) => {
                if (onUpdate) onUpdate(payload.new as Table)
            }
        )
        .subscribe()

    return channel
}

/**
 * Unsubscribe from a channel
 */
export async function unsubscribe(channel: RealtimeChannel): Promise<void> {
    const supabase = createClient()
    await supabase.removeChannel(channel)
}

/**
 * Subscribe to all order-related changes for kitchen display
 * Returns cleanup function
 */
export function subscribeToKitchenUpdates(
    restaurantId: string,
    handlers: {
        onNewOrder?: (order: Order) => void
        onOrderUpdate?: (order: Order) => void
        onOrderDelete?: (order: Order) => void
        onTableUpdate?: (table: Table) => void
    }
): () => void {
    const supabase = createClient()
    const channels: RealtimeChannel[] = []

    // Orders channel
    const ordersChannel = subscribeToOrders(
        restaurantId,
        handlers.onNewOrder,
        handlers.onOrderUpdate,
        handlers.onOrderDelete
    )
    channels.push(ordersChannel)

    // Tables channel
    const tablesChannel = subscribeToTables(restaurantId, handlers.onTableUpdate)
    channels.push(tablesChannel)

    // Cleanup function
    return () => {
        channels.forEach((channel) => {
            supabase.removeChannel(channel)
        })
    }
}
