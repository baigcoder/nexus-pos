import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// CORS headers for external access
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Restaurant-ID',
}

// Handle preflight
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders })
}

// POST /api/v1/orders - Create order from external website
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            restaurant_id,
            customer_name,
            customer_phone,
            customer_email,
            delivery_address,
            items,
            notes,
            is_delivery = true,
        } = body

        // Validate required fields
        if (!restaurant_id) {
            return NextResponse.json(
                { error: 'restaurant_id is required' },
                { status: 400, headers: corsHeaders }
            )
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: 'items array is required and must not be empty' },
                { status: 400, headers: corsHeaders }
            )
        }

        if (!customer_name || !customer_phone) {
            return NextResponse.json(
                { error: 'customer_name and customer_phone are required' },
                { status: 400, headers: corsHeaders }
            )
        }

        const supabase = await createClient()

        // Verify restaurant exists
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('id, tax_rate')
            .eq('id', restaurant_id)
            .single()

        if (restaurantError || !restaurant) {
            return NextResponse.json(
                { error: 'Restaurant not found' },
                { status: 404, headers: corsHeaders }
            )
        }

        // Get menu items for price calculation
        const itemIds = items.map((i: any) => i.menu_item_id)
        const { data: menuItems } = await supabase
            .from('menu_items')
            .select('id, price, name')
            .in('id', itemIds)

        if (!menuItems || menuItems.length === 0) {
            return NextResponse.json(
                { error: 'Invalid menu items' },
                { status: 400, headers: corsHeaders }
            )
        }

        // Calculate totals
        let subtotal = 0
        const orderItems = items.map((item: any) => {
            const menuItem = menuItems.find((m: any) => m.id === item.menu_item_id)
            if (!menuItem) return null
            const itemTotal = menuItem.price * item.quantity
            subtotal += itemTotal
            return {
                menu_item_id: item.menu_item_id,
                quantity: item.quantity,
                unit_price: menuItem.price,
                subtotal: itemTotal,
                special_instructions: item.special_instructions || null,
                status: 'pending',
            }
        }).filter(Boolean)

        const tax = Math.round(subtotal * (restaurant.tax_rate / 100))
        const total = subtotal + tax

        // Generate order number
        const orderNumber = 1000 + Math.floor(Math.random() * 9000)

        // Create a virtual table for delivery orders or find existing
        let tableId = null
        const { data: deliveryTable } = await supabase
            .from('tables')
            .select('id')
            .eq('restaurant_id', restaurant_id)
            .eq('table_number', 'DELIVERY')
            .single()

        if (deliveryTable) {
            tableId = deliveryTable.id
        } else {
            // Create delivery virtual table
            const { data: newTable } = await supabase
                .from('tables')
                .insert({
                    restaurant_id,
                    table_number: 'DELIVERY',
                    capacity: 1,
                    status: 'available',
                })
                .select('id')
                .single()
            tableId = newTable?.id
        }

        // Create order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                restaurant_id,
                table_id: tableId,
                order_number: orderNumber,
                status: 'pending',
                subtotal,
                tax,
                discount: 0,
                total,
                notes: `${is_delivery ? 'DELIVERY' : 'PICKUP'} | ${customer_name} | ${customer_phone}${delivery_address ? ` | ${delivery_address}` : ''}${notes ? ` | ${notes}` : ''}`,
                is_priority: false,
            })
            .select('id, order_number')
            .single()

        if (orderError || !order) {
            console.error('Order creation error:', orderError)
            return NextResponse.json(
                { error: 'Failed to create order' },
                { status: 500, headers: corsHeaders }
            )
        }

        // Create order items
        const orderItemsWithOrderId = orderItems.map((item: any) => ({
            ...item,
            order_id: order.id,
        }))

        await supabase.from('order_items').insert(orderItemsWithOrderId)

        // Generate tracking URL
        const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://nexuspos.com'}/track?order=${order.order_number}`

        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                order_number: order.order_number,
                subtotal,
                tax,
                total,
                status: 'pending',
            },
            tracking_url: trackingUrl,
            message: 'Order created successfully',
        }, { status: 201, headers: corsHeaders })

    } catch (error) {
        console.error('Orders API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders }
        )
    }
}

// GET /api/v1/orders?order_number=1234 - Get order status
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const orderNumber = searchParams.get('order_number')
        const orderId = searchParams.get('order_id')

        if (!orderNumber && !orderId) {
            return NextResponse.json(
                { error: 'order_number or order_id is required' },
                { status: 400, headers: corsHeaders }
            )
        }

        const supabase = await createClient()

        let query = supabase
            .from('orders')
            .select('id, order_number, status, subtotal, tax, total, created_at, notes')

        if (orderNumber) {
            query = query.eq('order_number', parseInt(orderNumber))
        } else {
            query = query.eq('id', orderId)
        }

        const { data: order, error } = await query.single()

        if (error || !order) {
            return NextResponse.json(
                { error: 'Order not found' },
                { status: 404, headers: corsHeaders }
            )
        }

        // Map status to customer-friendly format
        const statusMap: Record<string, string> = {
            pending: 'Order Received',
            preparing: 'Being Prepared',
            ready: 'Ready for Pickup',
            served: 'Out for Delivery',
            paid: 'Delivered',
            cancelled: 'Cancelled',
        }

        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                order_number: order.order_number,
                status: order.status,
                status_label: statusMap[order.status] || order.status,
                subtotal: order.subtotal,
                tax: order.tax,
                total: order.total,
                created_at: order.created_at,
            },
        }, { headers: corsHeaders })

    } catch (error) {
        console.error('Orders GET API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders }
        )
    }
}
