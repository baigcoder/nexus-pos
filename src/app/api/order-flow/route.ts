import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Complete Restaurant Order Flow System
// Handles: Dine-in (Table) -> Waiter -> Kitchen -> Ready -> Serve -> Pay

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get staff info
        const { data: staffData } = await supabase
            .from('staff')
            .select('id, restaurant_id, role, name')
            .eq('user_id', user.id)
            .single()

        if (!staffData) {
            return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
        }

        const { restaurant_id, role, action, data: actionData } = await request.json()
        // Never trust a client-supplied restaurant: only an owner may target another restaurant they own.
        let targetRestaurantId = staffData.restaurant_id
        if (restaurant_id && restaurant_id !== staffData.restaurant_id) {
            const { data: owned } = await supabase
                .from('restaurants')
                .select('id')
                .eq('id', restaurant_id)
                .eq('owner_id', user.id)
                .maybeSingle()
            if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            targetRestaurantId = owned.id
        }

        // ============== TABLE MANAGEMENT ==============
        if (action === 'assign_table') {
            // Manager/Owner assigns table to waiter
            const { table_id, waiter_id, customer_count } = actionData

            // Update table status
            await supabase
                .from('tables')
                .update({
                    status: 'occupied',
                    current_waiter_id: waiter_id,
                    customer_count: customer_count || 1,
                    occupied_at: new Date().toISOString()
                })
                .eq('id', table_id)
                .eq('restaurant_id', targetRestaurantId)

            // Log activity
            await supabase.from('staff_activity_logs').insert({
                restaurant_id: targetRestaurantId,
                staff_id: waiter_id,
                action_type: 'table_assigned',
                action_details: { table_id, customer_count }
            })

            return NextResponse.json({ success: true, message: 'Table assigned' })
        }

        if (action === 'release_table') {
            // Release table after customer leaves
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

        if (action === 'get_available_tables') {
            // Get all tables with availability status
            const { data: tables } = await supabase
                .from('tables')
                .select('*')
                .eq('restaurant_id', targetRestaurantId)
                .order('table_number')

            // Get available waiters
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

        // ============== ORDER CREATION ==============
        if (action === 'create_order') {
            const { table_id, items, customer_name, notes, is_priority } = actionData

            // Verify table belongs to restaurant
            const { data: table } = await supabase
                .from('tables')
                .select('id, current_waiter_id, restaurant_id')
                .eq('id', table_id)
                .eq('restaurant_id', targetRestaurantId)
                .single()

            if (!table) {
                return NextResponse.json({ error: 'Table not found' }, { status: 404 })
            }

            // Get menu items for price calculation
            const itemIds = items.map((i: any) => i.menu_item_id)
            const { data: menuItems } = await supabase
                .from('menu_items')
                .select('id, price, name, is_available, preparation_time')
                .in('id', itemIds)

            // Check availability
            const unavailable = menuItems?.filter(m => !m.is_available) || []
            if (unavailable.length > 0) {
                return NextResponse.json({
                    error: 'Some items unavailable',
                    items: unavailable.map((u: any) => u.name)
                }, { status: 400 })
            }

            // Calculate totals
            let subtotal = 0
            const orderItems = items.map((item: any) => {
                const menuItem = menuItems?.find(m => m.id === item.menu_item_id)
                if (!menuItem) return null
                const qty = Math.max(1, item.quantity || 1)
                const itemTotal = menuItem.price * qty
                subtotal += itemTotal
                return {
                    menu_item_id: item.menu_item_id,
                    quantity: qty,
                    unit_price: menuItem.price,
                    subtotal: itemTotal,
                    special_instructions: item.notes || null,
                    status: 'pending'
                }
            }).filter(Boolean)

            // Get restaurant tax rate
            const { data: restaurant } = await supabase
                .from('restaurants')
                .select('tax_rate')
                .eq('id', targetRestaurantId)
                .single()

            const taxRate = restaurant?.tax_rate || 0
            const tax = Math.round(subtotal * taxRate / 100)
            const total = subtotal + tax

            // Generate order number
            const { data: lastOrder } = await supabase
                .from('orders')
                .select('order_number')
                .eq('restaurant_id', targetRestaurantId)
                .order('order_number', { ascending: false })
                .limit(1)
                .single()

            const nextOrderNum = (lastOrder?.order_number || 1000) + 1

            // Create order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    restaurant_id: targetRestaurantId,
                    table_id,
                    staff_id: table.current_waiter_id || staffData.id,
                    order_number: nextOrderNum,
                    status: 'pending',
                    subtotal,
                    tax,
                    total,
                    notes: notes || null,
                    is_priority: is_priority || false,
                    customer_name: customer_name || null
                })
                .select('id, order_number, status, total')
                .single()

            if (orderError) {
                console.error('Order error:', orderError)
                return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
            }

            // Insert order items
            const orderItemsWithId = orderItems.map((item: any) => ({
                ...item,
                order_id: order.id
            }))
            await supabase.from('order_items').insert(orderItemsWithId)

            // Add to kitchen queue
            const maxPrepTime = Math.max(
                ...(menuItems?.map(m => m.preparation_time || 15) || [15])
            )

            await supabase.from('kitchen_order_queue').insert({
                order_id: order.id,
                restaurant_id: targetRestaurantId,
                assigned_to: null,
                priority: is_priority ? 'high' : 'normal',
                status: 'pending',
                prep_time_seconds: maxPrepTime * 60
            })

            // Log activity
            await supabase.from('staff_activity_logs').insert({
                restaurant_id: targetRestaurantId,
                staff_id: staffData.id,
                action_type: 'order_created',
                action_details: { order_id: order.id, table_id, item_count: items.length }
            })

            // Update staff metrics
            const today = new Date().toISOString().split('T')[0]
            const { data: existingMetrics } = await supabase
                .from('staff_metrics')
                .select('*')
                .eq('staff_id', table.current_waiter_id || staffData.id)
                .eq('date', today)
                .single()

            if (existingMetrics) {
                await supabase
                    .from('staff_metrics')
                    .update({
                        orders_taken: (existingMetrics.orders_taken || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingMetrics.id)
            } else {
                await supabase.from('staff_metrics').insert({
                    staff_id: table.current_waiter_id || staffData.id,
                    restaurant_id: targetRestaurantId,
                    date: today,
                    orders_taken: 1
                })
            }

            return NextResponse.json({
                success: true,
                order: {
                    id: order.id,
                    order_number: order.order_number,
                    status: order.status,
                    subtotal,
                    tax,
                    total
                }
            })
        }

        // ============== KITCHEN ACTIONS ==============
        if (action === 'kitchen_start') {
            // Kitchen starts preparing
            const { order_id } = actionData

            await supabase
                .from('kitchen_order_queue')
                .update({
                    status: 'preparing',
                    started_at: new Date().toISOString(),
                    assigned_to: staffData.id
                })
                .eq('order_id', order_id)

            await supabase
                .from('orders')
                .update({ status: 'preparing' })
                .eq('id', order_id)
                .eq('restaurant_id', targetRestaurantId)

            // Notify waiter
            const { data: order } = await supabase
                .from('orders')
                .select('table_id, staff_id')
                .eq('id', order_id)
                .eq('restaurant_id', targetRestaurantId)
                .single()

            if (order?.staff_id) {
                await supabase.from('staff_alerts').insert({
                    restaurant_id: targetRestaurantId,
                    to_staff_id: order.staff_id,
                    alert_type: 'kitchen_update',
                    title: 'Order Started',
                    message: `Order ${order_id.slice(0, 8)} is being prepared`,
                    priority: 'low'
                })
            }

            return NextResponse.json({ success: true, message: 'Kitchen started preparing' })
        }

        if (action === 'kitchen_ready') {
            // Kitchen marks order ready
            const { order_id } = actionData

            const { data: queueItem } = await supabase
                .from('kitchen_order_queue')
                .select('started_at')
                .eq('order_id', order_id)
                .single()

            const actualTime = queueItem?.started_at
                ? Math.round((Date.now() - new Date(queueItem.started_at).getTime()) / 1000)
                : 0

            await supabase
                .from('kitchen_order_queue')
                .update({
                    status: 'ready',
                    ready_at: new Date().toISOString(),
                    actual_prep_time_seconds: actualTime
                })
                .eq('order_id', order_id)

            await supabase
                .from('orders')
                .update({ status: 'ready' })
                .eq('id', order_id)
                .eq('restaurant_id', targetRestaurantId)

            // Notify assigned waiter
            const { data: order } = await supabase
                .from('orders')
                .select('table_id, staff_id, table:tables(table_number)')
                .eq('id', order_id)
                .eq('restaurant_id', targetRestaurantId)
                .single()

            if (order?.staff_id) {
                await supabase.from('staff_alerts').insert({
                    restaurant_id: targetRestaurantId,
                    to_staff_id: order.staff_id,
                    alert_type: 'order_ready',
                    title: 'Order Ready!',
                    message: `Order for Table ${(order.table as any)?.table_number || '?'} is ready to serve`,
                    priority: 'high'
                })
            }

            // Log kitchen performance
            if (staffData.role === 'kitchen') {
                const today = new Date().toISOString().split('T')[0]
                await supabase.from('staff_activity_logs').insert({
                    restaurant_id: targetRestaurantId,
                    staff_id: staffData.id,
                    action_type: 'order_prepared',
                    action_details: { order_id, prep_time: actualTime },
                    duration_seconds: actualTime
                })
            }

            return NextResponse.json({ success: true, message: 'Order marked ready' })
        }

        // ============== SERVE & COMPLETE ==============
        if (action === 'serve_order') {
            // Waiter serves the order
            const { order_id } = actionData

            // Update order items status
            await supabase
                .from('order_items')
                .update({ status: 'served' })
                .eq('order_id', order_id)

            // Update kitchen queue
            await supabase
                .from('kitchen_order_queue')
                .update({ status: 'served', served_at: new Date().toISOString() })
                .eq('order_id', order_id)

            await supabase
                .from('orders')
                .update({ status: 'served' })
                .eq('id', order_id)
                .eq('restaurant_id', targetRestaurantId)

            // Log activity
            await supabase.from('staff_activity_logs').insert({
                restaurant_id: targetRestaurantId,
                staff_id: staffData.id,
                action_type: 'order_served',
                action_details: { order_id }
            })

            return NextResponse.json({ success: true, message: 'Order served' })
        }

        if (action === 'request_bill') {
            // Customer requests bill
            const { order_id } = actionData

            const { data: order } = await supabase
                .from('orders')
                .select('id, total, staff_id')
                .eq('id', order_id)
                .eq('restaurant_id', targetRestaurantId)
                .single()

            if (!order) {
                return NextResponse.json({ error: 'Order not found' }, { status: 404 })
            }

            // Alert cashier
            const { data: cashiers } = await supabase
                .from('staff')
                .select('id')
                .eq('restaurant_id', targetRestaurantId)
                .eq('role', 'cashier')
                .eq('is_active', true)

            if (cashiers?.length) {
                for (const cashier of cashiers) {
                    await supabase.from('staff_alerts').insert({
                        restaurant_id: targetRestaurantId,
                        to_staff_id: cashier.id,
                        alert_type: 'bill_request',
                        title: 'Bill Request',
                        message: `Bill requested for order #${order_id.slice(0, 8)} - Rs.${order.total}`,
                        priority: 'medium'
                    })
                }
            }

            // Update table status to billing
            const { data: orderData } = await supabase
                .from('orders')
                .select('table_id')
                .eq('id', order_id)
                .eq('restaurant_id', targetRestaurantId)
                .single()

            if (orderData?.table_id) {
                await supabase
                    .from('tables')
                    .update({ status: 'billing' })
                    .eq('id', orderData.table_id)
                    .eq('restaurant_id', targetRestaurantId)
            }

            return NextResponse.json({ success: true, message: 'Bill requested' })
        }

        // ============== PAYMENT ==============
        if (action === 'process_payment') {
            const { order_id, payment_method, amount_received, is_partial } = actionData

            // Get order details
            const { data: order } = await supabase
                .from('orders')
                .select('*')
                .eq('id', order_id)
                .eq('restaurant_id', targetRestaurantId)
                .single()

            if (!order) {
                return NextResponse.json({ error: 'Order not found' }, { status: 404 })
            }

            const amount = amount_received || order.total
            const change = Math.max(0, amount - order.total)

            // Create transaction record
            await supabase.from('cashier_transactions').insert({
                restaurant_id: targetRestaurantId,
                staff_id: staffData.id,
                order_id,
                transaction_type: 'sale',
                amount: is_partial ? amount : order.total,
                payment_method: payment_method || 'cash'
            })

            // Update order status
            const newStatus = is_partial ? 'partial_paid' : 'paid'
            await supabase
                .from('orders')
                .update({
                    status: newStatus,
                    payment_method: payment_method || 'cash',
                    amount_paid: (order.amount_paid || 0) + amount,
                    paid_at: is_partial ? null : new Date().toISOString()
                })
                .eq('id', order_id)
                .eq('restaurant_id', targetRestaurantId)

            // Update staff metrics
            const today = new Date().toISOString().split('T')[0]
            const { data: existingMetrics } = await supabase
                .from('staff_metrics')
                .select('*')
                .eq('staff_id', staffData.id)
                .eq('date', today)
                .single()

            if (existingMetrics) {
                await supabase
                    .from('staff_metrics')
                    .update({
                        revenue_generated: (existingMetrics.revenue_generated || 0) + (is_partial ? amount : order.total),
                        orders_completed: is_partial ? existingMetrics.orders_completed : (existingMetrics.orders_completed || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingMetrics.id)
            } else {
                await supabase.from('staff_metrics').insert({
                    staff_id: staffData.id,
                    restaurant_id: targetRestaurantId,
                    date: today,
                    revenue_generated: is_partial ? amount : order.total,
                    orders_completed: is_partial ? 0 : 1
                })
            }

            // Log activity
            await supabase.from('staff_activity_logs').insert({
                restaurant_id: targetRestaurantId,
                staff_id: staffData.id,
                action_type: 'payment_processed',
                action_details: {
                    order_id,
                    amount: is_partial ? amount : order.total,
                    payment_method,
                    change
                }
            })

            // Release table if fully paid
            if (!is_partial) {
                await supabase
                    .from('tables')
                    .update({
                        status: 'available',
                        current_waiter_id: null,
                        customer_count: null,
                        occupied_at: null
                    })
                    .eq('id', order.table_id)
                    .eq('restaurant_id', targetRestaurantId)
            }

            return NextResponse.json({
                success: true,
                payment: {
                    order_id,
                    amount_paid: amount,
                    total: order.total,
                    change
                }
            })
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
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const view = searchParams.get('view') // 'tables' | 'kitchen' | 'orders' | 'my_tables'
        const restaurantId = searchParams.get('restaurant_id')

        // Get staff restaurant
        const { data: staffData } = await supabase
            .from('staff')
            .select('id, restaurant_id, role')
            .eq('user_id', user.id)
            .single()

        const targetRestaurant = restaurantId || staffData?.restaurant_id
        if (!targetRestaurant) {
            return NextResponse.json({ error: 'No restaurant' }, { status: 404 })
        }

        if (view === 'tables') {
            // Manager view - all tables
            const { data: tables } = await supabase
                .from('tables')
                .select('*, waiter:staff(name)')
                .eq('restaurant_id', targetRestaurant)
                .order('table_number')

            return NextResponse.json({ tables: tables || [] })
        }

        if (view === 'kitchen') {
            // Kitchen view - order queue
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

            // Get order items
            const orderIds = (queue || []).map(q => q.order_id)
            const { data: allItems } = await supabase
                .from('order_items')
                .select('*, menu_item:menu_items(name)')
                .in('order_id', orderIds.length > 0 ? orderIds : ['empty'])

            const queueWithItems = (queue || []).map(q => ({
                ...q,
                items: (allItems || []).filter(i => i.order_id === q.order_id)
            }))

            return NextResponse.json({ queue: queueWithItems })
        }

        if (view === 'my_tables') {
            // Waiter view - assigned tables only
            const { data: tables } = await supabase
                .from('tables')
                .select('*')
                .eq('restaurant_id', targetRestaurant)
                .eq('current_waiter_id', staffData?.id)
                .not('status', 'in', '("available")')

            // Get orders for these tables
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