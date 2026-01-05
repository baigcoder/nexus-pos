import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey, getCorsHeaders } from '@/lib/api-keys'

// Default CORS headers for backward compatibility
const defaultCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Restaurant-ID',
}

// Handle preflight
export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get('origin')
    const apiKey = request.headers.get('x-api-key')

    // If API key provided, validate and get CORS settings
    if (apiKey) {
        const validation = await validateApiKey(apiKey, origin)
        if (validation.valid && validation.allowedOrigins) {
            return NextResponse.json({}, {
                headers: getCorsHeaders(origin, validation.allowedOrigins)
            })
        }
    }

    return NextResponse.json({}, { headers: defaultCorsHeaders })
}

// POST /api/v1/orders - Create order from external website
export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    const apiKey = request.headers.get('x-api-key')

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
                { status: 400, headers: defaultCorsHeaders }
            )
        }

        // If API key provided, validate it
        let corsHeaders: Record<string, string> = defaultCorsHeaders
        if (apiKey) {
            const validation = await validateApiKey(apiKey, origin)

            if (!validation.valid) {
                return NextResponse.json(
                    { error: validation.error || 'Invalid API key' },
                    { status: 401, headers: defaultCorsHeaders }
                )
            }

            // Check if API key matches restaurant
            if (validation.restaurantId !== restaurant_id) {
                return NextResponse.json(
                    { error: 'API key does not match restaurant' },
                    { status: 403, headers: defaultCorsHeaders }
                )
            }

            // Check permission
            if (!validation.permissions?.includes('orders:create')) {
                return NextResponse.json(
                    { error: 'API key does not have permission to create orders' },
                    { status: 403, headers: defaultCorsHeaders }
                )
            }

            corsHeaders = getCorsHeaders(origin, validation.allowedOrigins || [])
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

        // Validate phone format (basic check)
        const phoneRegex = /^[\d\s\-+()]{10,20}$/
        if (!phoneRegex.test(customer_phone)) {
            return NextResponse.json(
                { error: 'Invalid phone number format' },
                { status: 400, headers: corsHeaders }
            )
        }

        // Validate email if provided
        if (customer_email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(customer_email)) {
                return NextResponse.json(
                    { error: 'Invalid email format' },
                    { status: 400, headers: corsHeaders }
                )
            }
        }

        const supabase = await createClient()

        // Verify restaurant exists
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('id, tax_rate, name')
            .eq('id', restaurant_id)
            .single()

        if (restaurantError || !restaurant) {
            return NextResponse.json(
                { error: 'Restaurant not found' },
                { status: 404, headers: corsHeaders }
            )
        }

        // Get menu items for price calculation
        const itemIds = items.map((i: { menu_item_id: string }) => i.menu_item_id)
        const { data: menuItems } = await supabase
            .from('menu_items')
            .select('id, price, name, is_available')
            .in('id', itemIds)

        if (!menuItems || menuItems.length === 0) {
            return NextResponse.json(
                { error: 'Invalid menu items' },
                { status: 400, headers: corsHeaders }
            )
        }

        // Check all items are available
        const unavailableItems = menuItems.filter(item => !item.is_available)
        if (unavailableItems.length > 0) {
            return NextResponse.json(
                {
                    error: 'Some items are not available',
                    unavailable: unavailableItems.map(i => i.name)
                },
                { status: 400, headers: corsHeaders }
            )
        }

        // Calculate totals
        let subtotal = 0
        const orderItems = items.map((item: { menu_item_id: string; quantity: number; special_instructions?: string }) => {
            const menuItem = menuItems.find((m) => m.id === item.menu_item_id)
            if (!menuItem) return null

            // Validate quantity
            const quantity = Math.max(1, Math.min(99, Math.floor(item.quantity)))
            const itemTotal = menuItem.price * quantity
            subtotal += itemTotal

            return {
                menu_item_id: item.menu_item_id,
                quantity,
                unit_price: menuItem.price,
                subtotal: itemTotal,
                special_instructions: item.special_instructions?.slice(0, 500) || null, // Limit length
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

        // Sanitize notes
        const sanitizedNotes = [
            is_delivery ? 'DELIVERY' : 'PICKUP',
            customer_name.slice(0, 100),
            customer_phone.slice(0, 20),
            delivery_address ? delivery_address.slice(0, 200) : null,
            notes ? notes.slice(0, 500) : null,
        ].filter(Boolean).join(' | ')

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
                notes: sanitizedNotes,
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
        const orderItemsWithOrderId = orderItems.map((item) => ({
            ...item,
            order_id: order.id,
        }))

        await supabase.from('order_items').insert(orderItemsWithOrderId)

        // Generate tracking URL
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexuspos.com'
        const trackingUrl = `${appUrl}/track?order=${order.order_number}`

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
            { status: 500, headers: defaultCorsHeaders }
        )
    }
}

// GET /api/v1/orders?order_number=1234 - Get order status
export async function GET(request: NextRequest) {
    const origin = request.headers.get('origin')
    const apiKey = request.headers.get('x-api-key')

    try {
        const { searchParams } = new URL(request.url)
        const orderNumber = searchParams.get('order_number')
        const orderId = searchParams.get('order_id')

        if (!orderNumber && !orderId) {
            return NextResponse.json(
                { error: 'order_number or order_id is required' },
                { status: 400, headers: defaultCorsHeaders }
            )
        }

        // Determine CORS headers based on API key
        let corsHeaders: Record<string, string> = defaultCorsHeaders
        if (apiKey) {
            const validation = await validateApiKey(apiKey, origin)
            if (validation.valid && validation.allowedOrigins) {
                corsHeaders = getCorsHeaders(origin, validation.allowedOrigins)
            }
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
            { status: 500, headers: defaultCorsHeaders }
        )
    }
}
