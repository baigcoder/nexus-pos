import crypto from 'crypto'
import type {
    Table,
    Order,
    OrderItem,
    UserRole,
    KitchenStatus,
    DeliveryStatus,
    RegisterShift,
    CashDrawerMovement,
    WasteRecord,
    RestaurantEvent,
    AiActionProposal,
    DeliveryAssignment,
} from '../../src/types/database.ts'

export interface MockDatabase {
    restaurants: Map<string, any>
    tables: Map<string, any>
    categories: Map<string, any>
    menu_items: Map<string, any>
    orders: Map<string, any>
    order_items: Map<string, any>
    order_item_modifiers: Map<string, any>
    restaurant_daily_sequences: Map<string, { current_number: number; business_date: string }>
    idempotency_keys: Map<string, any>
    restaurant_events: any[]
    cash_registers: Map<string, any>
    register_shifts: Map<string, any>
    cash_drawer_movements: any[]
    waste_records: any[]
    ai_action_proposals: any[]
    delivery_assignments: Map<string, any>
    staff: Map<string, any>
    expenses: any[]
    daily_reports: any[]
}

export function createInMemoryDatabase(): MockDatabase {
    return {
        restaurants: new Map(),
        tables: new Map(),
        categories: new Map(),
        menu_items: new Map(),
        orders: new Map(),
        order_items: new Map(),
        order_item_modifiers: new Map(),
        restaurant_daily_sequences: new Map(),
        idempotency_keys: new Map(),
        restaurant_events: [],
        cash_registers: new Map(),
        register_shifts: new Map(),
        cash_drawer_movements: [],
        waste_records: [],
        ai_action_proposals: [],
        delivery_assignments: new Map(),
        staff: new Map(),
        expenses: [],
        daily_reports: [],
    }
}

/**
 * Simulates PostgreSQL generate_daily_order_number with 4-hour local rollover offset.
 */
export function simulateGenerateDailyOrderNumber(
    db: MockDatabase,
    restaurantId: string,
    simulatedNow: Date = new Date(),
    tzOffsetHours: number = 5 // Asia/Karachi UTC+5
): number {
    // 4-hour rollover: (NOW - 4 hours) determines the local business date
    const localTimeMs = simulatedNow.getTime() + tzOffsetHours * 3600 * 1000
    const businessDateObj = new Date(localTimeMs - 4 * 3600 * 1000)
    const businessDate = businessDateObj.toISOString().split('T')[0]

    const key = `${restaurantId}:${businessDate}`
    const existing = db.restaurant_daily_sequences.get(key)

    if (!existing) {
        db.restaurant_daily_sequences.set(key, { current_number: 1001, business_date: businessDate })
        return 1001
    }

    existing.current_number += 1
    return existing.current_number
}

/**
 * Simulates PostgreSQL seat_table_atomic RPC with row locking & status checks.
 */
export function simulateSeatTableAtomic(
    db: MockDatabase,
    tableId: string,
    waiterId: string,
    customerCount: number = 1
): { success: boolean; table?: any; error?: string; event_id?: number } {
    const table = db.tables.get(tableId)
    if (!table) {
        return { success: false, error: 'Table not found' }
    }

    if (table.status !== 'available') {
        return {
            success: false,
            error: `Table is currently occupied (status: ${table.status})`,
        }
    }

    // Atomic update with version increment
    table.status = 'occupied'
    table.current_waiter_id = waiterId
    table.customer_count = customerCount
    table.occupied_at = new Date().toISOString()
    table.version = (table.version || 1) + 1

    const eventId = db.restaurant_events.length + 1
    db.restaurant_events.push({
        id: eventId,
        restaurant_id: table.restaurant_id,
        aggregate_type: 'TABLE',
        aggregate_id: tableId,
        event_type: 'TABLE_SEATED',
        payload: {
            table_id: tableId,
            table_number: table.table_number,
            waiter_id: waiterId,
            customer_count: customerCount,
            version: table.version,
        },
        created_at: new Date().toISOString(),
    })

    return { success: true, table, event_id: eventId }
}

/**
 * Simulates PostgreSQL create_order_atomic RPC.
 * Enforces server-side price lookups, snapshots, and outbox event recording.
 */
export function simulateCreateOrderAtomic(
    db: MockDatabase,
    payload: {
        restaurant_id: string
        table_id?: string | null
        staff_id?: string | null
        order_type?: 'dine_in' | 'takeaway' | 'delivery'
        items: {
            menu_item_id: string
            quantity: number
            special_instructions?: string
            modifiers?: { name: string; price_modifier: number }[]
        }[]
        delivery_address?: string
        delivery_fee?: number
    }
): { success: boolean; order?: any; error?: string; event_id?: number } {
    const restaurant = db.restaurants.get(payload.restaurant_id)
    if (!restaurant) {
        return { success: false, error: 'Restaurant not found' }
    }

    const orderType = payload.order_type || 'dine_in'
    let table = null
    if (payload.table_id) {
        table = db.tables.get(payload.table_id)
        if (!table) {
            return { success: false, error: 'Table not found' }
        }
    } else if (orderType === 'dine_in') {
        return { success: false, error: 'table_id is required for dine_in orders' }
    }

    let subtotal = 0
    let totalTax = 0
    const processedItems: any[] = []

    for (const itemInput of payload.items) {
        const menuItem = db.menu_items.get(itemInput.menu_item_id)
        if (!menuItem) {
            return { success: false, error: `Menu item ${itemInput.menu_item_id} not found` }
        }
        if (menuItem.is_available === false) {
            return { success: false, error: `Menu item "${menuItem.name}" is currently 86'd (out of stock)` }
        }

        let itemPrice = Number(menuItem.price)
        let modifierTotal = 0
        const itemMods: any[] = []

        if (itemInput.modifiers && itemInput.modifiers.length > 0) {
            for (const mod of itemInput.modifiers) {
                modifierTotal += Number(mod.price_modifier) || 0
                itemMods.push({
                    id: crypto.randomUUID(),
                    modifier_name_snapshot: mod.name,
                    price_modifier_snapshot: mod.price_modifier,
                })
            }
        }

        const unitPriceWithMods = itemPrice + modifierTotal
        const itemSubtotal = unitPriceWithMods * itemInput.quantity
        const itemTax = (itemSubtotal * (restaurant.tax_rate || 0)) / 100

        subtotal += itemSubtotal
        totalTax += itemTax

        processedItems.push({
            id: crypto.randomUUID(),
            menu_item_id: menuItem.id,
            item_name_snapshot: menuItem.name,
            variant_name_snapshot: null,
            unit_price: unitPriceWithMods,
            unit_cost_snapshot: Number(menuItem.cost_price) || 0,
            tax_rate_snapshot: Number(restaurant.tax_rate) || 0,
            tax_amount_snapshot: itemTax,
            kitchen_status: 'fired',
            quantity: itemInput.quantity,
            subtotal: itemSubtotal,
            special_instructions: itemInput.special_instructions || null,
            modifiers: itemMods,
        })
    }

    const deliveryFee = Number(payload.delivery_fee) || 0
    const total = subtotal + totalTax + deliveryFee
    const orderNumber = simulateGenerateDailyOrderNumber(db, payload.restaurant_id)

    const orderId = crypto.randomUUID()
    const orderRecord = {
        id: orderId,
        restaurant_id: payload.restaurant_id,
        table_id: payload.table_id || null,
        staff_id: payload.staff_id || null,
        order_number: orderNumber,
        order_type: orderType,
        status: 'pending',
        subtotal,
        tax: totalTax,
        delivery_fee: deliveryFee,
        total,
        payment_status: 'unpaid',
        delivery_address: payload.delivery_address || null,
        created_at: new Date().toISOString(),
    }

    db.orders.set(orderId, orderRecord)

    for (const pItem of processedItems) {
        pItem.order_id = orderId
        db.order_items.set(pItem.id, pItem)
        for (const mod of pItem.modifiers) {
            mod.order_item_id = pItem.id
            db.order_item_modifiers.set(mod.id, mod)
        }
    }

    if (table) {
        table.status = 'occupied'
        table.version = (table.version || 1) + 1
    }

    const eventId = db.restaurant_events.length + 1
    db.restaurant_events.push({
        id: eventId,
        restaurant_id: payload.restaurant_id,
        aggregate_type: 'ORDER',
        aggregate_id: orderId,
        event_type: 'ORDER_CREATED',
        payload: {
            order_id: orderId,
            order_number: orderNumber,
            total,
            item_count: processedItems.length,
        },
        created_at: new Date().toISOString(),
    })

    return { success: true, order: { ...orderRecord, items: processedItems }, event_id: eventId }
}

/**
 * Simulates request_or_execute_item_void with automatic kitchen waste logging.
 */
export function simulateVoidItem(
    db: MockDatabase,
    orderItemId: string,
    reason: string,
    staffId: string
): { success: boolean; voided?: boolean; waste_logged?: boolean; error?: string; event_id?: number } {
    const item = db.order_items.get(orderItemId)
    if (!item) {
        return { success: false, error: 'Order item not found' }
    }

    const order = db.orders.get(item.order_id)
    if (!order) {
        return { success: false, error: 'Order not found' }
    }

    if (['paid', 'cancelled'].includes(order.status)) {
        return { success: false, error: `Cannot void item from order with status: ${order.status}` }
    }

    if (item.kitchen_status === 'voided') {
        return { success: false, error: 'Item is already voided' }
    }

    let wasteLogged = false
    // If the food was already being prepared or plated, inventory was consumed -> Log waste record
    if (['cooking', 'plated', 'served'].includes(item.kitchen_status)) {
        const wasteId = crypto.randomUUID()
        db.waste_records.push({
            id: wasteId,
            restaurant_id: order.restaurant_id,
            order_id: order.id,
            order_item_id: orderItemId,
            menu_item_id: item.menu_item_id,
            item_name: item.item_name_snapshot,
            quantity: item.quantity,
            cost_price: item.unit_cost_snapshot,
            total_cost_wasted: Number(item.unit_cost_snapshot) * item.quantity,
            reason,
            staff_id: staffId,
            created_at: new Date().toISOString(),
        })
        wasteLogged = true
    }

    item.kitchen_status = 'voided'

    // Deduct from order totals
    order.subtotal -= item.subtotal
    order.tax -= item.tax_amount_snapshot
    order.total = order.subtotal + order.tax + (order.delivery_fee || 0)

    const eventId = db.restaurant_events.length + 1
    db.restaurant_events.push({
        id: eventId,
        restaurant_id: order.restaurant_id,
        aggregate_type: 'ORDER',
        aggregate_id: order.id,
        event_type: 'ITEM_VOIDED',
        payload: {
            order_id: order.id,
            order_item_id: orderItemId,
            item_name: item.item_name_snapshot,
            waste_logged: wasteLogged,
            new_total: order.total,
        },
        created_at: new Date().toISOString(),
    })

    return { success: true, voided: true, waste_logged: wasteLogged, event_id: eventId }
}

/**
 * Zero-trust RBAC evaluator checking access by UserRole against resources.
 */
export function evaluateRbacPermission(
    role: UserRole,
    resource: 'expenses' | 'daily_reports' | 'cash_registers' | 'register_shifts' | 'drawer_movements' | 'waste' | 'deliveries' | 'ai_proposals',
    action: 'read' | 'write' | 'approve'
): boolean {
    if (role === 'owner') return true

    if (role === 'manager') {
        return true
    }

    if (role === 'cashier') {
        if (resource === 'cash_registers' || resource === 'register_shifts' || resource === 'drawer_movements') {
            return action !== 'approve'
        }
        if (resource === 'deliveries') return action === 'read' || action === 'write'
        return false
    }

    if (role === 'waiter') {
        // Waiter can only access dining orders and table seating; no financial ledgers
        return false
    }

    if (role === 'kitchen') {
        if (resource === 'waste') return true
        return false
    }

    if (role === 'rider' || role === 'delivery') {
        if (resource === 'deliveries') return true
        return false
    }

    return false
}

/**
 * Simulates settle_order_payment_atomic RPC.
 */
export function simulateSettlePaymentAtomic(
    db: MockDatabase,
    payload: {
        order_id: string
        staff_id?: string
        payment_method: string
        amount?: number
        cash_received?: number
        tip?: number
        discount?: number
    }
): { success: boolean; order?: any; shift?: any; table_released?: boolean; error?: string; event_id?: number } {
    const order = db.orders.get(payload.order_id)
    if (!order) {
        return { success: false, error: 'Order not found' }
    }

    if (order.status === 'paid') {
        return { success: false, error: 'Order is already fully paid' }
    }

    const payAmount = payload.amount !== undefined ? payload.amount : order.total
    const totalPaid = (order.amount_paid || 0) + payAmount
    const remaining = Math.max(0, order.total - totalPaid)
    const isFullyPaid = remaining <= 0.01

    order.amount_paid = totalPaid
    order.payment_method = payload.payment_method
    order.status = isFullyPaid ? 'paid' : 'partial_paid'
    order.payment_status = isFullyPaid ? 'paid' : 'partial'
    if (isFullyPaid) {
        order.paid_at = new Date().toISOString()
    }

    // Update active cashier shift
    let matchedShift = null
    if (payload.staff_id) {
        for (const shift of db.register_shifts.values()) {
            if (shift.staff_id === payload.staff_id && shift.status === 'open') {
                if (payload.payment_method === 'cash') {
                    shift.total_sales_cash = (shift.total_sales_cash || 0) + payAmount
                } else if (payload.payment_method === 'card') {
                    shift.total_sales_card = (shift.total_sales_card || 0) + payAmount
                }
                shift.total_tax_collected = (shift.total_tax_collected || 0) + Math.round((payAmount * (order.tax || 0)) / Math.max(1, order.total))
                matchedShift = shift
                break
            }
        }
    }

    let tableReleased = false
    if (isFullyPaid && order.table_id) {
        const table = db.tables.get(order.table_id)
        if (table) {
            table.status = 'available'
            table.current_waiter_id = null
            table.customer_count = 1
            table.occupied_at = null
            table.version = (table.version || 1) + 1
            tableReleased = true
        }
    } else if (!isFullyPaid && order.table_id) {
        const table = db.tables.get(order.table_id)
        if (table) {
            table.status = 'billing'
        }
    }

    const eventId = db.restaurant_events.length + 1
    db.restaurant_events.push({
        id: eventId,
        restaurant_id: order.restaurant_id,
        aggregate_type: 'ORDER',
        aggregate_id: order.id,
        event_type: isFullyPaid ? 'ORDER_PAID' : 'ORDER_PARTIAL_PAID',
        payload: {
            order_id: order.id,
            amount_paid: payAmount,
            total_paid: totalPaid,
            remaining_balance: remaining,
            is_fully_paid: isFullyPaid,
            table_released: tableReleased,
        },
        created_at: new Date().toISOString(),
    })

    return {
        success: true,
        order,
        shift: matchedShift,
        table_released: tableReleased,
        event_id: eventId,
    }
}

/**
 * Simulates transfer_table_atomic RPC.
 */
export function simulateTransferTableAtomic(
    db: MockDatabase,
    fromTableId: string,
    toTableId: string,
    staffId: string
): { success: boolean; from_table_number?: string; to_table_number?: string; error?: string } {
    const fromTable = db.tables.get(fromTableId)
    const toTable = db.tables.get(toTableId)

    if (!fromTable || !toTable) {
        return { success: false, error: 'Table not found' }
    }

    if (toTable.status !== 'available') {
        return { success: false, error: `Destination table is currently ${toTable.status}` }
    }

    // Find active order at source table
    let activeOrder = null
    for (const order of db.orders.values()) {
        if (order.table_id === fromTableId && !['paid', 'cancelled'].includes(order.status)) {
            activeOrder = order
            break
        }
    }

    if (activeOrder) {
        activeOrder.table_id = toTableId
    }

    toTable.status = 'occupied'
    toTable.current_waiter_id = fromTable.current_waiter_id || staffId
    toTable.customer_count = fromTable.customer_count
    toTable.version = (toTable.version || 1) + 1

    fromTable.status = 'available'
    fromTable.current_waiter_id = null
    fromTable.customer_count = 1
    fromTable.version = (fromTable.version || 1) + 1

    return {
        success: true,
        from_table_number: fromTable.table_number,
        to_table_number: toTable.table_number,
    }
}

/**
 * Simulates advance_kds_item_atomic RPC.
 */
export function simulateAdvanceKdsItemAtomic(
    db: MockDatabase,
    orderItemId: string,
    newStatus: string
): { success: boolean; item?: any; order_ready?: boolean; error?: string } {
    const item = db.order_items.get(orderItemId)
    if (!item) {
        return { success: false, error: 'Order item not found' }
    }

    item.kitchen_status = newStatus

    // Check if all items in order are plated or served
    let allPlated = true
    for (const oi of db.order_items.values()) {
        if (oi.order_id === item.order_id && !['plated', 'served', 'voided'].includes(oi.kitchen_status)) {
            allPlated = false
            break
        }
    }

    const order = db.orders.get(item.order_id)
    if (allPlated && order && order.status !== 'ready') {
        order.status = 'ready'
    }

    return { success: true, item, order_ready: allPlated }
}

