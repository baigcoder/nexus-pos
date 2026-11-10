import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedStaff } from '@/lib/api-auth'
import { OrderService } from '@/lib/services/order-service'

const frontOfHouseRoles = ['owner', 'manager', 'waiter', 'cashier']
const kitchenRoles = ['owner', 'manager', 'kitchen']
const actionRoles = new Map<string, string[]>([
    ['assign_table', frontOfHouseRoles],
    ['release_table', frontOfHouseRoles],
    ['transfer_table', frontOfHouseRoles],
    ['merge_tables', frontOfHouseRoles],
    ['get_available_tables', frontOfHouseRoles],
    ['create_order', frontOfHouseRoles],
    ['void_item', frontOfHouseRoles],
    ['kitchen_start', [...frontOfHouseRoles, 'kitchen']],
    ['kitchen_ready', kitchenRoles],
    ['serve_order', [...frontOfHouseRoles, 'kitchen']],
    ['request_bill', frontOfHouseRoles],
    ['process_payment', ['owner', 'manager', 'cashier']],
])

const kitchenTargets = new Map([
    ['kitchen_start', 'preparing'],
    ['kitchen_ready', 'ready'],
    ['serve_order', 'served'],
])

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createAdminClient()
        const staffData = {
            id: auth.staffId,
            restaurant_id: auth.restaurantId,
            role: auth.role,
            name: auth.email,
        }

        const body = await request.json()
        const { restaurant_id, action, data: actionData } = body
        if (restaurant_id && restaurant_id !== auth.restaurantId) {
            return NextResponse.json({ error: 'Access denied for this restaurant' }, { status: 403 })
        }
        const targetRestaurantId = auth.restaurantId
        const allowedRoles = actionRoles.get(action)
        if (!allowedRoles) return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
        if (!allowedRoles.includes(auth.role)) {
            return NextResponse.json({ error: 'You do not have permission for this action' }, { status: 403 })
        }

        // Legacy commands use a service-role client. Scope caller-supplied IDs before any write.
        if (action === 'request_bill') {
            const { data: order, error } = await supabase.from('orders').select('id')
                .eq('id', actionData?.order_id).eq('restaurant_id', targetRestaurantId).maybeSingle()
            if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        if (['assign_table', 'transfer_table', 'merge_tables'].includes(action)) {
            const tableIds: unknown[] = action === 'assign_table' ? [actionData?.table_id]
                : action === 'transfer_table' ? [actionData?.from_table_id, actionData?.to_table_id]
                : [actionData?.source_table_id, actionData?.target_table_id]
            if (tableIds.some(id => typeof id !== 'string' || !id) || new Set(tableIds).size !== tableIds.length) {
                return NextResponse.json({ error: 'Distinct table IDs are required' }, { status: 400 })
            }
            const { data: tables, error } = await supabase.from('tables').select('id')
                .eq('restaurant_id', targetRestaurantId).in('id', tableIds)
            if (error || tables?.length !== tableIds.length) {
                return NextResponse.json({ error: 'Table not found' }, { status: 404 })
            }
        }

        // ============== TABLE MANAGEMENT ==============
        if (action === 'assign_table') {
            const { table_id, waiter_id, customer_count } = actionData

            if (waiter_id && waiter_id !== staffData.id) {
                const { data: waiter, error } = await supabase.from('staff').select('id')
                    .eq('id', waiter_id).eq('restaurant_id', targetRestaurantId)
                    .eq('role', 'waiter').eq('is_active', true).maybeSingle()
                if (error || !waiter) return NextResponse.json({ error: 'Waiter not found' }, { status: 404 })
            }

            // Atomic seating with optimistic lock and availability check
            const seatResult = await OrderService.seatTableAtomic(
                table_id,
                waiter_id || staffData.id,
                customer_count || 1
            )

            if (!seatResult.success) {
                return NextResponse.json({ error: seatResult.error }, { status: 400 })
            }

            // Log activity
            await supabase.from('staff_activity_logs').insert({
                restaurant_id: targetRestaurantId,
                staff_id: waiter_id || staffData.id,
                action_type: 'table_assigned',
                action_details: { table_id, customer_count }
            })

            return NextResponse.json({ success: true, message: 'Table assigned', data: seatResult })
        }

        if (action === 'release_table') {
            const { table_id } = actionData

            await supabase
                .from('tables')
                .update({
                    status: 'available',
                    current_waiter_id: null,
                    customer_count: null,
                    occupied_at: null
                })
                .eq('id', table_id)
                .eq('restaurant_id', targetRestaurantId)

            return NextResponse.json({ success: true, message: 'Table released' })
        }

        if (action === 'transfer_table') {
            const { from_table_id, to_table_id } = actionData
            if (!from_table_id || !to_table_id) {
                return NextResponse.json({ error: 'Both from_table_id and to_table_id are required' }, { status: 400 })
            }

            const transferResult = await OrderService.transferTableAtomic(
                from_table_id,
                to_table_id,
                staffData.id
            )

            if (!transferResult.success) {
                return NextResponse.json({ error: transferResult.error }, { status: 400 })
            }

            return NextResponse.json({
                success: true,
                message: `Table transferred from ${transferResult.from_table_number} to ${transferResult.to_table_number}`,
                data: transferResult,
            })
        }

        if (action === 'merge_tables') {
            const { source_table_id, target_table_id } = actionData
            if (!source_table_id || !target_table_id) {
                return NextResponse.json({ error: 'Both source_table_id and target_table_id are required' }, { status: 400 })
            }

            const mergeResult = await OrderService.mergeTablesAtomic(
                source_table_id,
                target_table_id,
                staffData.id
            )

            if (!mergeResult.success) {
                return NextResponse.json({ error: mergeResult.error }, { status: 400 })
            }

            return NextResponse.json({
                success: true,
                message: mergeResult.message || 'Tables successfully merged',
                data: mergeResult,
            })
        }

        if (action === 'get_available_tables') {
            const { data: tables } = await supabase
                .from('tables')
                .select('*')
                .eq('restaurant_id', targetRestaurantId)
                .order('table_number')

            const { data: waiters } = await supabase
                .from('staff')
                .select('id, name, role')
                .eq('restaurant_id', targetRestaurantId)
                .eq('role', 'waiter')
                .eq('is_active', true)

            return NextResponse.json({
                tables: tables || [],
                waiters: waiters || []
            })
        }

        // ============== ORDER CREATION (ATOMIC) ==============
        if (action === 'create_order') {
            if (!actionData || !Array.isArray(actionData.items)) {
                return NextResponse.json({ error: 'Order items are required' }, { status: 400 })
            }

            const { table_id, items, customer_count, customer_name, notes, is_priority, client_order_id } = actionData
            const result = await OrderService.createOrderAtomic({
                restaurant_id: targetRestaurantId,
                table_id,
                staff_id: staffData.id,
                order_type: 'dine_in',
                items: items.map((item: any) => ({
                    menu_item_id: item?.menu_item_id,
                    quantity: item?.quantity ?? 1,
                    special_instructions: typeof item?.special_instructions === 'string'
                        ? item.special_instructions.slice(0, 500)
                        : typeof item?.notes === 'string' ? item.notes.slice(0, 500) : null,
                    modifiers: item?.modifiers,
                })),
                notes: typeof notes === 'string' ? notes.slice(0, 500) : null,
                is_priority: is_priority === true,
                customer_name: typeof customer_name === 'string' ? customer_name.slice(0, 100) : null,
                customer_count,
                source: 'pos',
                client_order_id: request.headers.get('idempotency-key') ??
                    request.headers.get('x-idempotency-key') ?? client_order_id,
            })

            if (!result.success || !result.order_id) {
                const status = result.code === 'conflict' ? 409 : result.code === 'internal' ? 500 : 400
                return NextResponse.json({ error: result.error || 'Failed to create order' }, { status })
            }

            return NextResponse.json({
                success: true,
                order: {
                    id: result.order_id,
                    order_number: result.order_number,
                    subtotal: result.subtotal,
                    tax: result.tax,
                    total: result.total,
                    status: result.status,
                    idempotent_replay: result.idempotent_replay || false,
                },
            })
        }


        // ============== ITEM FIRE & VOID PROTOCOL ==============
        if (action === 'void_item') {
            const { order_item_id, reason } = actionData

            if (!order_item_id) {
                return NextResponse.json({ error: 'order_item_id is required' }, { status: 400 })
            }

            const { data: item, error } = await supabase.from('order_items')
                .select('id, order:orders!inner(restaurant_id)')
                .eq('id', order_item_id).eq('order.restaurant_id', targetRestaurantId).maybeSingle()
            if (error || !item) return NextResponse.json({ error: 'Order item not found' }, { status: 404 })

            const voidResult = await OrderService.voidOrderItem(
                order_item_id,
                reason || 'Customer request',
                staffData.id
            )

            if (!voidResult.success) {
                return NextResponse.json({ error: voidResult.error }, { status: 400 })
            }

            return NextResponse.json({
                success: true,
                message: voidResult.waste_logged ? 'Item voided and logged to kitchen waste' : 'Item voided successfully',
                data: voidResult
            })
        }

        const kitchenTarget = kitchenTargets.get(action)
        if (kitchenTarget) {
            const orderId = actionData?.order_id
            if (typeof orderId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(orderId)) {
                return NextResponse.json({ error: 'A valid order ID is required' }, { status: 400 })
            }
            const result = await OrderService.transitionKitchenOrder(targetRestaurantId, orderId, kitchenTarget, staffData.id)
            if (!result.success) {
                const status = result.code === 'conflict' ? 409 : result.code === 'not_found' ? 404 :
                    result.code === 'internal' ? 500 : 400
                return NextResponse.json({ error: result.error }, { status })
            }
            return NextResponse.json(result)
        }

        if (action === 'request_bill') {
            const { order_id } = actionData

            const { data: order } = await supabase
                .from('orders')
                .select('id, total, staff_id, table_id')
                .eq('id', order_id)
                .single()

            if (!order) {
                return NextResponse.json({ error: 'Order not found' }, { status: 404 })
            }

            // Update table status to billing
            if (order.table_id) {
                await supabase
                    .from('tables')
                    .update({ status: 'billing' })
                    .eq('id', order.table_id)
            }

            return NextResponse.json({ success: true, message: 'Bill requested' })
        }

        // ============== PAYMENT (ATOMIC) ==============
        if (action === 'process_payment') {
            const { order_id, payment_method, amount, amount_received, tip, discount, is_split, split_payments } = actionData
            const payment = await OrderService.settlePaymentAtomic({
                order_id,
                restaurant_id: targetRestaurantId,
                request_key: request.headers.get('idempotency-key'),
                staff_id: staffData.id,
                payment_method: payment_method || 'cash',
                amount,
                cash_received: amount_received,
                tip,
                discount,
                is_split,
                split_payments,
            })
            if (!payment.success) {
                const status = payment.code === 'conflict' ? 409 : payment.code === 'not_found' ? 404 :
                    payment.code === 'internal' ? 500 : 400
                return NextResponse.json({ error: payment.error }, { status })
            }
            return NextResponse.json({ success: true, payment })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    } catch (err) {
        console.error('Order flow error:', err)
        return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
    }
}

// GET - Fetch current orders/tables for staff
export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createAdminClient()
        const staffData = { id: auth.staffId, restaurant_id: auth.restaurantId, role: auth.role }

        const { searchParams } = new URL(request.url)
        const view = searchParams.get('view')
        const restaurantId = searchParams.get('restaurant_id')
        if (restaurantId && restaurantId !== auth.restaurantId) {
            return NextResponse.json({ error: 'Access denied for this restaurant' }, { status: 403 })
        }

        const targetRestaurant = auth.restaurantId

        if (view === 'tables') {
            const { data, error } = await supabase
                .from('tables')
                .select('*')
                .eq('restaurant_id', targetRestaurant)
                .order('table_number')

            if (error) return NextResponse.json({ error: 'Could not load the floor.' }, { status: 500 })
            const tables = (data ?? []) as { current_waiter_id?: string | null }[]
            const waiterIds = [...new Set(tables.flatMap(table => table.current_waiter_id ? [table.current_waiter_id] : []))]
            const waitersById = new Map<string, string>()
            if (waiterIds.length) {
                const { data: waiters } = await supabase.from('staff').select('id, name')
                    .eq('restaurant_id', targetRestaurant).in('id', waiterIds)
                for (const waiter of waiters ?? []) waitersById.set(waiter.id, waiter.name)
            }
            return NextResponse.json({ tables: tables.map(table => {
                const name = table.current_waiter_id && waitersById.get(table.current_waiter_id)
                return { ...table, waiter: name ? { name } : null }
            }) })
        }

        if (view === 'kitchen') {
            const { data: queue } = await supabase
                .from('kitchen_order_queue')
                .select(`
                    *,
                    order:orders(
                        id, order_number, created_at, table:tables(table_number),
                        customer_name, is_priority
                    )
                `)
                .eq('restaurant_id', targetRestaurant)
                .not('status', 'in', '("served","cancelled")')
                .order('priority', { ascending: false })
                .order('received_at', { ascending: true })

            const orderIds = (queue || []).map(q => q.order_id)
            const { data: allItems } = await supabase
                .from('order_items')
                .select('*, menu_item:menu_items(name)')
                .in('order_id', orderIds.length > 0 ? orderIds : ['empty'])

            const queueWithItems = (queue || []).map(q => ({
                ...q,
                items: (allItems || []).map(i => ({
                    ...i,
                    display_name: i.item_name_snapshot || i.menu_item?.name || 'Item'
                })).filter(i => i.order_id === q.order_id)
            }))

            return NextResponse.json({ queue: queueWithItems })
        }

        if (view === 'my_tables') {
            const { data: tables } = await supabase
                .from('tables')
                .select('*')
                .eq('restaurant_id', targetRestaurant)
                .eq('current_waiter_id', staffData?.id)
                .not('status', 'in', '("available")')

            const tableIds = (tables || []).map(t => t.id)
            const { data: orders } = await supabase
                .from('orders')
                .select('*, table:tables(table_number)')
                .in('table_id', tableIds.length > 0 ? tableIds : ['empty'])
                .not('status', 'in', '("paid","cancelled")')

            return NextResponse.json({
                tables: tables || [],
                orders: orders || []
            })
        }

        // Default - active orders for the restaurant
        const { data: orders } = await supabase
            .from('orders')
            .select(`
                *,
                table:tables(table_number),
                staff:staff(name)
            `)
            .eq('restaurant_id', targetRestaurant)
            .not('status', 'in', '("paid","cancelled")')
            .order('created_at', { ascending: false })

        return NextResponse.json({ orders: orders || [] })

    } catch (err) {
        console.error('Order flow GET error:', err)
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
    }
}
