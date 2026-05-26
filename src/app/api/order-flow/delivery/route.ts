import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Delivery Order Flow System
// Handles: Website Order / Phone Call -> Kitchen -> Delivery Rider -> Customer

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { restaurant_id, action, data: actionData } = await request.json()

        // Get staff info
        const { data: staffData } = await supabase
            .from('staff')
            .select('id, restaurant_id, role, name')
            .eq('user_id', user.id)
            .single()

        const targetRestaurantId = restaurant_id || staffData?.restaurant_id
        if (!targetRestaurantId) {
            return NextResponse.json({ error: 'No restaurant' }, { status: 404 })
        }

        // ============== CREATE DELIVERY ORDER ==============
        if (action === 'create_delivery_order') {
            const {
                customer_name,
                customer_phone,
                customer_email,
                delivery_address,
                items,
                notes,
                source, // 'website' | 'phone' | 'walkin'
                payment_method = 'cash_on_delivery'
            } = actionData

            // Get menu items
            const itemIds = items.map((i: any) => i.menu_item_id)
            const { data: menuItems } = await supabase
                .from('menu_items')
                .select('id, price, name, is_available, preparation_time')
                .in('id', itemIds)

            // Check availability
            const unavailable = menuItems?.filter(m => !m.is_available) || []
            if (unavailable.length > 0) {
                return NextResponse.json({
                    error: 'Items unavailable',
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

            // Get restaurant settings
            const { data: restaurant } = await supabase
                .from('restaurants')
                .select('tax_rate, delivery_fee')
                .eq('id', targetRestaurantId)
                .single()

            const taxRate = restaurant?.tax_rate || 0
            const deliveryFee = restaurant?.delivery_fee || 0
            const tax = Math.round(subtotal * taxRate / 100)
            const total = subtotal + tax + deliveryFee

            // Generate order number
            const { data: lastOrder } = await supabase
                .from('orders')
                .select('order_number')
                .eq('restaurant_id', targetRestaurantId)
                .order('order_number', { ascending: false })
                .limit(1)
                .single()

            const nextOrderNum = (lastOrder?.order_number || 1000) + 1

            // Get or create delivery virtual table
            const { data: deliveryTable } = await supabase
                .from('tables')
                .select('id')
                .eq('restaurant_id', targetRestaurantId)
                .eq('table_number', 'DELIVERY')
                .single()

            const tableId = deliveryTable?.id

            // Create order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    restaurant_id: targetRestaurantId,
                    table_id: tableId,
                    staff_id: staffData?.id,
                    order_number: nextOrderNum,
                    status: 'pending',
                    order_type: 'delivery',
                    subtotal,
                    tax,
                    delivery_fee: deliveryFee,
                    total,
                    notes: `${source?.toUpperCase() || 'ORDER'} | ${customer_name} | ${customer_phone}${delivery_address ? ` | ${delivery_address}` : ''}${notes ? ` | ${notes}` : ''}`,
                    customer_name,
                    customer_phone,
                    customer_email,
                    delivery_address,
                    payment_method,
                    source
                })
                .select('id, order_number, status, total')
                .single()

            if (orderError) {
                console.error('Delivery order error:', orderError)
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
                priority: 'normal',
                status: 'pending',
                prep_time_seconds: maxPrepTime * 60
            })

            // Create delivery tracking
            await supabase.from('delivery_tracking').insert({
                order_id: order.id,
                restaurant_id: targetRestaurantId,
                rider_id: null,
                status: 'preparing',
                estimated_minutes: maxPrepTime + 20 // prep + delivery
            })

            // Log activity
            await supabase.from('staff_activity_logs').insert({
                restaurant_id: targetRestaurantId,
                staff_id: staffData?.id,
                action_type: 'delivery_order_created',
                action_details: {
                    order_id: order.id,
                    source,
                    customer_name,
                    item_count: items.length
                }
            })

            // Notify kitchen
            const { data: kitchenStaff } = await supabase
                .from('staff')
                .select('id')
                .eq('restaurant_id', targetRestaurantId)
                .eq('role', 'kitchen')
                .eq('is_active', true)

            if (kitchenStaff?.length) {
                for (const kitchen of kitchenStaff) {
                    await supabase.from('staff_alerts').insert({
                        restaurant_id: targetRestaurantId,
                        to_staff_id: kitchen.id,
                        alert_type: 'new_delivery',
                        title: 'New Delivery Order',
                        message: `Order #${nextOrderNum} - ${customer_name} - Rs.${total}`,
                        priority: 'medium'
                    })
                }
            }

            return NextResponse.json({
                success: true,
                order: {
                    id: order.id,
                    order_number: order.order_number,
                    status: order.status,
                    subtotal,
                    tax,
                    delivery_fee: deliveryFee,
                    total
                }
            })
        }

        // ============== DELIVERY RIDER ACTIONS ==============
        if (action === 'assign_rider') {
            const { order_id, rider_id } = actionData

            await supabase
                .from('delivery_tracking')
                .update({
                    rider_id,
                    status: 'ready'
                })
                .eq('order_id', order_id)

            // Notify rider
            await supabase.from('staff_alerts').insert({
                restaurant_id: targetRestaurantId,
                to_staff_id: rider_id,
                alert_type: 'delivery_assigned',
                title: 'New Delivery Assigned',
                message: `Pickup order from restaurant`,
                priority: 'high',
                related_order_id: order_id
            })

            return NextResponse.json({ success: true, message: 'Rider assigned' })
        }

        if (action === 'rider_pickup') {
            const { order_id } = actionData

            await supabase
                .from('delivery_tracking')
                .update({
                    status: 'picked_up',
                    pickup_time: new Date().toISOString()
                })
                .eq('order_id', order_id)

            await supabase
                .from('orders')
                .update({ status: 'ready' })
                .eq('id', order_id)

            // Notify customer (via tracking)
            const { data: order } = await supabase
                .from('orders')
                .select('order_number, customer_phone')
                .eq('id', order_id)
                .single()

            return NextResponse.json({
                success: true,
                message: `Order #${order?.order_number} picked up`,
                sms_hint: `Your order #${order?.order_number} is on its way!`
            })
        }

        if (action === 'rider_delivered') {
            const { order_id, customer_feedback, rating } = actionData

            const { data: tracking } = await supabase
                .from('delivery_tracking')
                .select('pickup_time')
                .eq('order_id', order_id)
                .single()

            const deliveryTime = tracking?.pickup_time
                ? Math.round((Date.now() - new Date(tracking.pickup_time).getTime()) / 60000)
                : 0

            await supabase
                .from('delivery_tracking')
                .update({
                    status: 'delivered',
                    delivery_time: new Date().toISOString(),
                    actual_minutes: deliveryTime,
                    customer_feedback,
                    rating
                })
                .eq('order_id', order_id)

            await supabase
                .from('orders')
                .update({ status: 'served' })
                .eq('id', order_id)

            // Update rider metrics
            if (staffData?.role === 'delivery') {
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
                            orders_completed: (existingMetrics.orders_completed || 0) + 1,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingMetrics.id)
                } else {
                    await supabase.from('staff_metrics').insert({
                        staff_id: staffData.id,
                        restaurant_id: targetRestaurantId,
                        date: today,
                        orders_completed: 1
                    })
                }

                // Log activity
                await supabase.from('staff_activity_logs').insert({
                    restaurant_id: targetRestaurantId,
                    staff_id: staffData.id,
                    action_type: 'delivery_completed',
                    action_details: { order_id, delivery_time: deliveryTime }
                })
            }

            return NextResponse.json({
                success: true,
                message: 'Delivery confirmed',
                delivery_time_minutes: deliveryTime
            })
        }

        if (action === 'delivery_failed') {
            const { order_id, reason } = actionData

            await supabase
                .from('delivery_tracking')
                .update({
                    status: 'failed'
                })
                .eq('order_id', order_id)

            await supabase.from('staff_alerts').insert({
                restaurant_id: targetRestaurantId,
                alert_type: 'delivery_failed',
                title: 'Delivery Failed',
                message: `Order ${order_id.slice(0, 8)} - ${reason}`,
                priority: 'urgent'
            })

            return NextResponse.json({ success: true, message: 'Marked as failed' })
        }

        // ============== GET DELIVERY STATUS ==============
        if (action === 'get_delivery_status') {
            const { order_id } = actionData

            const { data: tracking } = await supabase
                .from('delivery_tracking')
                .select(`
                    *,
                    rider:staff(name, phone)
                `)
                .eq('order_id', order_id)
                .single()

            const { data: order } = await supabase
                .from('orders')
                .select('order_number, total, customer_name, delivery_address, status, created_at')
                .eq('id', order_id)
                .single()

            if (!order) {
                return NextResponse.json({ error: 'Order not found' }, { status: 404 })
            }

            // Status timeline
            const timeline = []
            timeline.push({ status: 'Order Received', time: order.created_at, done: true })
            if (tracking?.pickup_time) {
                timeline.push({ status: 'Picked Up', time: tracking.pickup_time, done: true })
            }
            if (tracking?.delivery_time) {
                timeline.push({ status: 'Delivered', time: tracking.delivery_time, done: true })
            }

            return NextResponse.json({
                order: {
                    order_number: order.order_number,
                    customer_name: order.customer_name,
                    address: order.delivery_address,
                    total: order.total,
                    current_status: tracking?.status,
                    rider: tracking?.rider,
                    timeline,
                    estimated_minutes: tracking?.estimated_minutes,
                    actual_minutes: tracking?.actual_minutes
                }
            })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    } catch (err) {
        console.error('Delivery flow error:', err)
        return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
    }
}

// GET - Get delivery orders for restaurant
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const view = searchParams.get('view') || 'active'
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

        if (view === 'pending') {
            // Orders in kitchen/preparation
            const { data: orders } = await supabase
                .from('orders')
                .select(`
                    *,
                    tracking:delivery_tracking(*)
                `)
                .eq('restaurant_id', targetRestaurant)
                .eq('order_type', 'delivery')
                .eq('tracking.status', 'preparing')
                .order('created_at', { ascending: true })

            return NextResponse.json({ orders: orders || [] })
        }

        if (view === 'ready') {
            // Ready for pickup
            const { data: orders } = await supabase
                .from('orders')
                .select(`
                    *,
                    tracking:delivery_tracking(*)
                `)
                .eq('restaurant_id', targetRestaurant)
                .eq('order_type', 'delivery')
                .in('tracking.status', ['ready', 'picked_up'])
                .order('created_at', { ascending: true })

            return NextResponse.json({ orders: orders || [] })
        }

        if (view === 'my_deliveries' && staffData?.role === 'delivery') {
            // Rider's assigned deliveries
            const { data: orders } = await supabase
                .from('orders')
                .select(`
                    *,
                    tracking:delivery_tracking(*)
                `)
                .eq('restaurant_id', targetRestaurant)
                .eq('order_type', 'delivery')
                .eq('tracking.rider_id', staffData.id)
                .not('tracking.status', 'in', '("delivered","failed")')
                .order('created_at', { ascending: true })

            return NextResponse.json({ orders: orders || [] })
        }

        // Default - all active deliveries
        const { data: orders } = await supabase
            .from('orders')
            .select(`
                *,
                tracking:delivery_tracking(*),
                items:order_items(*)
            `)
            .eq('restaurant_id', targetRestaurant)
            .eq('order_type', 'delivery')
            .not('status', 'in', '("paid","cancelled")')
            .order('created_at', { ascending: false })

        return NextResponse.json({ orders: orders || [] })

    } catch (err) {
        console.error('Delivery flow GET error:', err)
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
    }
}