import { createAdminClient } from '@/lib/supabase/admin'

export interface OrderModifierInput {
    modifier_option_id: string
}

export interface OrderItemInput {
    menu_item_id: string
    quantity: number
    special_instructions?: string | null
    modifiers?: OrderModifierInput[]
}

export interface CreateOrderPayload {
    restaurant_id: string
    table_id?: string | null
    qr_order_version?: string
    staff_id?: string | null
    order_type?: 'dine_in' | 'takeaway' | 'delivery'
    items: OrderItemInput[]
    notes?: string | null
    is_priority?: boolean
    customer_count?: number
    customer_name?: string | null
    customer_phone?: string | null
    customer_email?: string | null
    delivery_address?: string | null
    delivery_fee?: number
    payment_method?: string | null
    source?: string
    client_order_id?: string | null
}

export interface OrderRpcResult {
    success: boolean
    code?: 'conflict' | 'internal' | 'forbidden'
    credential_issued_at?: number
    order_id?: string
    order_number?: number
    subtotal?: number
    tax?: number
    delivery_fee?: number
    total?: number
    status?: string
    error?: string
    idempotent_replay?: boolean
    event_id?: number
}

export interface SeatTableRpcResult {
    success: boolean
    table_id?: string
    table_number?: string
    status?: string
    waiter_id?: string
    customer_count?: number
    error?: string
    event_id?: number
}

export interface VoidItemRpcResult {
    success: boolean
    order_id?: string
    order_item_id?: string
    voided?: boolean
    waste_logged?: boolean
    new_subtotal?: number
    new_total?: number
    error?: string
    event_id?: number
}

export interface SettlePaymentPayload {
    order_id: string
    restaurant_id: string
    request_key?: string | null
    staff_id?: string
    payment_method: string
    amount?: number
    tip?: number
    discount?: number
    cash_received?: number
    is_split?: boolean
    split_payments?: Array<{
        split_number?: number
        amount: number
        method?: string
        items?: any[]
    }>
}

export interface SettlePaymentRpcResult {
    success: boolean
    code?: 'not_found' | 'conflict' | 'internal'
    order_id?: string
    order_number?: number
    amount_paid?: number
    total_paid?: number
    remaining_balance?: number
    change?: number
    status?: string
    table_released?: boolean
    error?: string
    event_id?: number
}

export interface TableOperationRpcResult {
    success: boolean
    message?: string
    from_table_number?: string
    to_table_number?: string
    target_table_id?: string
    order_transferred?: boolean
    error?: string
    event_id?: number
}

export interface KdsAdvanceRpcResult {
    success: boolean
    order_item_id?: string
    kitchen_status?: string
    order_all_plated?: boolean
    error?: string
    event_id?: number
}

export interface DeliveryUpdateRpcResult {
    success: boolean
    delivery_id?: string
    status?: string
    cod_collected?: number
    error?: string
    event_id?: number
}

export class OrderService {
    /**
     * Executes atomic order creation inside a single ACID PostgreSQL transaction.
     * Guarantees:
     * - Server-side price lookups (client prices are disregarded)
     * - Table locking (FOR UPDATE)
     * - Daily sequential order numbers with 4-hour offset
     * - Historical snapshots saved to order_items
     * - Outbox event emission to restaurant_events
     */
    static async createOrderAtomic(payload: CreateOrderPayload): Promise<OrderRpcResult> {
        const supabase = createAdminClient()

        // 1. Sanitize & validate input
        if (!payload.restaurant_id) {
            return { success: false, error: 'restaurant_id is required' }
        }

        const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
        if (payload.client_order_id != null && !uuid.test(payload.client_order_id)) {
            return { success: false, error: 'Order request key must be a UUID' }
        }
        if (payload.table_id != null && !uuid.test(payload.table_id)) {
            return { success: false, error: 'Invalid table ID' }
        }
        if (payload.customer_count !== undefined && (!Number.isInteger(payload.customer_count) ||
            payload.customer_count < 1 || payload.customer_count > 100)) {
            return { success: false, error: 'Invalid guest count' }
        }
        if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 100 ||
            payload.items.some(item => !item || !uuid.test(item.menu_item_id) ||
                !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 ||
                (item.modifiers !== undefined && (!Array.isArray(item.modifiers) || item.modifiers.length > 25 ||
                    item.modifiers.some(option => !option || typeof option.modifier_option_id !== 'string' ||
                        !option.modifier_option_id || option.modifier_option_id.length > 100))))) {
            return { success: false, error: 'Invalid order items, quantities or modifiers' }
        }

        const { data, error } = await supabase.rpc('create_verified_checkout_order', {
            p_payload: payload,
        })

        if (error) {
            console.error('[OrderService.createOrderAtomic] RPC Error:', error)
            return {
                success: false,
                code: 'internal',
                error: 'Could not create order',
            }
        }

        return data as OrderRpcResult
    }

    /**
     * Seats guests at a table with optimistic concurrency and status verification.
     */
    static async seatTableAtomic(
        tableId: string,
        waiterId: string,
        customerCount: number = 1
    ): Promise<SeatTableRpcResult> {
        const supabase = createAdminClient()

        const { data, error } = await supabase.rpc('seat_table_atomic', {
            p_table_id: tableId,
            p_waiter_id: waiterId,
            p_customer_count: customerCount,
        })

        if (error) {
            console.error('[OrderService.seatTableAtomic] RPC Error:', error)
            return {
                success: false,
                error: error.message || 'Failed to seat table',
            }
        }

        return data as SeatTableRpcResult
    }

    /**
     * Executes item-level void with automatic kitchen waste tracking if cooking/plated.
     */
    static async voidOrderItem(
        orderItemId: string,
        reason: string,
        staffId: string
    ): Promise<VoidItemRpcResult> {
        const supabase = createAdminClient()

        const { data, error } = await supabase.rpc('request_or_execute_item_void', {
            p_order_item_id: orderItemId,
            p_reason: reason,
            p_staff_id: staffId,
        })

        if (error) {
            console.error('[OrderService.voidOrderItem] RPC Error:', error)
            return {
                success: false,
                error: error.message || 'Failed to void item',
            }
        }

        return data as VoidItemRpcResult
    }

    /**
     * Retrieves an order with full historical snapshots preserved.
     */
    static async getOrderDetails(orderId: string) {
        const supabase = createAdminClient()

        const { data, error } = await supabase
            .from('orders')
            .select(`
                id,
                order_number,
                status,
                order_type,
                subtotal,
                tax,
                delivery_fee,
                discount,
                total,
                created_at,
                table:tables(id, table_number),
                restaurant:restaurants(id, name, slug, logo_url, phone, address, currency),
                order_items (
                    id,
                    quantity,
                    unit_price,
                    subtotal,
                    special_instructions,
                    item_name_snapshot,
                    variant_name_snapshot,
                    tax_amount_snapshot,
                    kitchen_status,
                    menu_item_id,
                    modifiers:order_item_modifiers(id, modifier_name_snapshot, price_modifier_snapshot)
                )
            `)
            .eq('id', orderId)
            .single()

        if (error || !data) {
            return { success: false, error: 'Order not found', order: null }
        }

        return { success: true, order: data }
    }

    /**
     * Executes atomic payment settlement with register shift balance update,
     * table release, split payments, and outbox event recording.
     */
    static async settlePaymentAtomic(payload: SettlePaymentPayload): Promise<SettlePaymentRpcResult> {
        const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
        if (!uuid.test(payload.order_id)) return { success: false, error: 'A valid order ID is required' }
        if (payload.request_key != null && !uuid.test(payload.request_key)) {
            return { success: false, error: 'Idempotency-Key must be a UUID' }
        }
        if ([payload.amount, payload.cash_received, payload.tip, payload.discount]
            .some(value => value !== undefined && !Number.isFinite(value))) {
            return { success: false, error: 'Payment amounts must be finite numbers' }
        }
        if (payload.split_payments !== undefined && (!Array.isArray(payload.split_payments) ||
            payload.split_payments.length > 25 ||
            payload.split_payments.some(tender => !tender || !Number.isFinite(tender.amount)))) {
            return { success: false, error: 'Invalid split tenders' }
        }

        const supabase = createAdminClient()
        const { data, error } = await supabase.rpc('settle_restaurant_order_payment', {
            p_payload: payload,
        })

        if (error) {
            console.error('[OrderService.settlePaymentAtomic] RPC Error:', error)
            return {
                success: false,
                code: 'internal',
                error: 'Could not settle payment',
            }
        }

        return data as SettlePaymentRpcResult
    }

    static async transitionKitchenOrder(restaurantId: string, orderId: string, status: string, staffId: string) {
        const { data, error } = await createAdminClient().rpc('transition_kitchen_order', {
            p_restaurant_id: restaurantId,
            p_order_id: orderId,
            p_target: status,
            p_staff_id: staffId,
        })
        if (error) {
            console.error('[OrderService.transitionKitchenOrder] RPC Error:', error)
            return { success: false, code: 'internal', error: 'Could not update the kitchen order' }
        }
        return data as { success: boolean; status?: string; code?: string; error?: string }
    }

    /**
     * Moves dining guests & active orders from one table to another atomically.
     */
    static async transferTableAtomic(
        fromTableId: string,
        toTableId: string,
        staffId: string
    ): Promise<TableOperationRpcResult> {
        const supabase = createAdminClient()
        const { data, error } = await supabase.rpc('transfer_table_atomic', {
            p_from_table_id: fromTableId,
            p_to_table_id: toTableId,
            p_staff_id: staffId,
        })

        if (error) {
            return { success: false, error: error.message || 'Failed to transfer table' }
        }

        return data as TableOperationRpcResult
    }

    /**
     * Merges two tables and joins their orders into a single bill atomically.
     */
    static async mergeTablesAtomic(
        sourceTableId: string,
        targetTableId: string,
        staffId: string
    ): Promise<TableOperationRpcResult> {
        const supabase = createAdminClient()
        const { data, error } = await supabase.rpc('merge_tables_atomic', {
            p_source_table_id: sourceTableId,
            p_target_table_id: targetTableId,
            p_staff_id: staffId,
        })

        if (error) {
            return { success: false, error: error.message || 'Failed to merge tables' }
        }

        return data as TableOperationRpcResult
    }

    /**
     * Advances item kitchen status and automatically transitions order to 'ready'
     * when all items are plated.
     */
    static async advanceKdsItemAtomic(
        orderItemId: string,
        newStatus: string,
        staffId: string
    ): Promise<KdsAdvanceRpcResult> {
        const supabase = createAdminClient()
        const { data, error } = await supabase.rpc('advance_kds_item_atomic', {
            p_order_item_id: orderItemId,
            p_new_status: newStatus,
            p_staff_id: staffId,
        })

        if (error) {
            return { success: false, error: error.message || 'Failed to advance kitchen item' }
        }

        return data as KdsAdvanceRpcResult
    }

    /**
     * Updates delivery assignment state machine and reconciles Rider COD wallet.
     */
    static async updateDeliveryStatusAtomic(
        deliveryId: string,
        status: string,
        riderId?: string,
        codCollected: number = 0.00,
        notes?: string
    ): Promise<DeliveryUpdateRpcResult> {
        const supabase = createAdminClient()
        const { data, error } = await supabase.rpc('update_delivery_status_atomic', {
            p_delivery_id: deliveryId,
            p_new_status: status,
            p_rider_id: riderId || null,
            p_cod_collected: codCollected,
            p_notes: notes || null,
        })

        if (error) {
            return { success: false, error: error.message || 'Failed to update delivery status' }
        }

        return data as DeliveryUpdateRpcResult
    }
}

