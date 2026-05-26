import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRestaurantId } from '@/stores/auth-store'

const UNPAID_STATUSES = ['pending', 'preparing', 'ready', 'served'] as const

interface BillingOrder {
    id: string
    order_number: number
    status: string
    subtotal: number
    tax: number
    discount: number
    total: number
    created_at: string
    table: { table_number: string } | null
    items: Array<{
        id: string
        name: string
        quantity: number
        price: number
        subtotal: number
        special_instructions?: string | null
        menu_item?: { name: string; price: number } | null
    }>
    staff?: { name: string } | null
    notes?: string | null
    is_priority?: boolean
}

export function useBillingOrders() {
    const restaurantId = useRestaurantId()
    const [orders, setOrders] = useState<BillingOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const channelRef = useRef<ReturnType<typeof createClient>['channel'] | null>(null)

    const fetchOrders = useCallback(async () => {
        if (!restaurantId) {
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const supabase = createClient()
            const { data, error: fetchError } = await supabase
                .from('orders')
                .select(`
                    id,
                    order_number,
                    status,
                    subtotal,
                    tax,
                    discount,
                    total,
                    created_at,
                    is_priority,
                    notes,
                    table:tables(table_number),
                    staff:staff(name),
                    order_items(
                        id,
                        quantity,
                        unit_price,
                        subtotal,
                        special_instructions,
                        menu_item:menu_items(name, price)
                    )
                `)
                .eq('restaurant_id', restaurantId)
                .in('status', UNPAID_STATUSES)
                .order('is_priority', { ascending: false })
                .order('created_at', { ascending: true })

            if (fetchError) throw fetchError

            const mapped = (data || []).map((order: Record<string, unknown>) => ({
                ...order,
                items: (order.order_items as Array<Record<string, unknown>> || []).map((item) => ({
                    id: item.id as string,
                    name: (item.menu_item as Record<string, unknown>)?.name || 'Item',
                    quantity: item.quantity as number,
                    price: (item.menu_item as Record<string, unknown>)?.price || item.unit_price as number || 0,
                    subtotal: item.subtotal as number,
                    special_instructions: item.special_instructions as string | null,
                })),
                table: order.table as { table_number: string } | null,
                staff: order.staff as { name: string } | null,
            }))

            setOrders(mapped as BillingOrder[])
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load orders'
            setError(message)
        } finally {
            setLoading(false)
        }
    }, [restaurantId])

    useEffect(() => {
        fetchOrders()

        if (!restaurantId) return

        const supabase = createClient()
        const channel = supabase
            .channel('billing-orders')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
                () => { fetchOrders() }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'order_items' },
                () => { fetchOrders() }
            )
            .subscribe()

        channelRef.current = channel

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [restaurantId, fetchOrders])

    return { orders, loading, error, refetch: fetchOrders }
}