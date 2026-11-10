import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateApiKey, getCorsHeaders } from '@/lib/api-keys'
import { isFirstPartyOrigin } from '@/lib/origin'
import { getTableQrSecret, verifyTableQrToken } from '@/lib/table-qr'
import { checkRateLimitPersistent, getClientIp } from '@/lib/auth'
import { OrderService } from '@/lib/services/order-service'
import { getOrderAccessSecret, issueOrderAccessToken, privateOrderHeaders, verifyOrderAccessToken } from '@/lib/order-access'

// Default CORS headers for backward compatibility
const defaultCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key, X-Restaurant-ID, Idempotency-Key, X-Idempotency-Key',
}

// Handle preflight
export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get('origin')
    const apiKey = request.headers.get('x-api-key')

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

// POST /api/v1/orders - Create order from external website or QR ordering
export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    const apiKey = request.headers.get('x-api-key')

    try {
        const rate = await checkRateLimitPersistent(`v1_orders:${getClientIp(request)}`, {
            maxRequests: 40,
            windowMs: 60 * 1000,
        })
        if (!rate.allowed) {
            return NextResponse.json(
                { error: 'Too many order requests. Please try again shortly.' },
                { status: 429, headers: defaultCorsHeaders }
            )
        }

        const body = await request.json().catch(() => null)
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: defaultCorsHeaders })
        }

        const {
            restaurant_id,
            customer_name,
            customer_phone,
            customer_email,
            delivery_address,
            items,
            notes,
            is_delivery = true,
            order_type,
            table_number,
            table_qr,
            payment_method,
            client_order_id,
        } = body

        // QR table ordering: dine-in orders tied to a physical table
        const isDineIn = order_type === 'dine_in' || !!table_number
        const resolvedOrderType: 'dine_in' | 'takeaway' | 'delivery' = isDineIn
            ? 'dine_in'
            : is_delivery
            ? 'delivery'
            : 'takeaway'

        // Validate required fields
        if (typeof restaurant_id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(restaurant_id)) {
            return NextResponse.json(
                { error: 'restaurant_id is required' },
                { status: 400, headers: defaultCorsHeaders }
            )
        }

        // QR / first-party app can create without a key. External sites must send an API key.
        let corsHeaders: Record<string, string> = defaultCorsHeaders
        if (!apiKey && !isFirstPartyOrigin(origin, request.nextUrl.origin)) {
            return NextResponse.json(
                { error: 'API key is required' },
                { status: 401, headers: defaultCorsHeaders }
            )
        }

        if (apiKey) {
            const validation = await validateApiKey(apiKey, origin)

            if (!validation.valid) {
                return NextResponse.json(
                    { error: validation.error || 'Invalid API key' },
                    { status: 401, headers: defaultCorsHeaders }
                )
            }

            if (validation.restaurantId !== restaurant_id) {
                return NextResponse.json(
                    { error: 'API key does not match restaurant' },
                    { status: 403, headers: defaultCorsHeaders }
                )
            }

            if (!validation.permissions?.includes('orders:create')) {
                return NextResponse.json(
                    { error: 'API key does not have permission to create orders' },
                    { status: 403, headers: defaultCorsHeaders }
                )
            }

            corsHeaders = getCorsHeaders(origin, validation.allowedOrigins || [])
        }

        if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
            return NextResponse.json(
                { error: 'Order must contain between 1 and 100 line items' },
                { status: 400, headers: corsHeaders }
            )
        }

        if (!isDineIn && (!customer_name || !customer_phone)) {
            return NextResponse.json(
                { error: 'customer_name and customer_phone are required' },
                { status: 400, headers: corsHeaders }
            )
        }

        if (customer_phone) {
            const phoneRegex = /^[\d\s\-+()]{10,20}$/
            if (!phoneRegex.test(customer_phone)) {
                return NextResponse.json(
                    { error: 'Invalid phone number format' },
                    { status: 400, headers: corsHeaders }
                )
            }
        }

        if (customer_email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(customer_email)) {
                return NextResponse.json(
                    { error: 'Invalid email format' },
                    { status: 400, headers: corsHeaders }
                )
            }
        }

        const supabase = createAdminClient()

        // Verify restaurant exists and can accept orders
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('id, tax_rate, name, is_active, plan, trial_ends_at')
            .eq('id', restaurant_id)
            .single()

        if (restaurantError || !restaurant) {
            return NextResponse.json(
                { error: 'Restaurant not found' },
                { status: 404, headers: corsHeaders }
            )
        }

        if (!restaurant.is_active) {
            return NextResponse.json(
                { error: 'Restaurant is currently unavailable' },
                { status: 503, headers: corsHeaders }
            )
        }

        const { canCreateOrders } = await import('@/lib/plan')
        if (!canCreateOrders(restaurant)) {
            return NextResponse.json(
                { error: 'This restaurant is not accepting new orders while the trial is expired.' },
                { status: 402, headers: corsHeaders }
            )
        }

        // Resolve table if dine-in
        let tableId: string | null = null
        let qrOrderVersion: string | undefined
        if (isDineIn) {
            const qrSecret = getTableQrSecret()
            if (!qrSecret) return NextResponse.json({ error: 'Table ordering is temporarily unavailable' }, { status: 503, headers: corsHeaders })
            if (typeof table_qr !== 'string' || typeof table_number !== 'string' || !table_number.trim()) {
                return NextResponse.json({ error: 'Scan the current QR code at your table' }, { status: 403, headers: corsHeaders })
            }
            const { data: dineTable } = await supabase
                .from('tables')
                .select('id, is_qr_active, qr_order_version')
                .eq('restaurant_id', restaurant_id)
                .eq('table_number', String(table_number))
                .single()

            if (!dineTable || dineTable.is_qr_active === false ||
                !verifyTableQrToken(table_qr, restaurant.id, dineTable.id, dineTable.qr_order_version, qrSecret)) {
                return NextResponse.json({ error: 'Scan the current QR code at your table' }, { status: 403, headers: corsHeaders })
            }

            tableId = dineTable.id
            qrOrderVersion = dineTable.qr_order_version
        }

        const accessSecret = getOrderAccessSecret()
        if (!accessSecret) {
            return NextResponse.json({ error: 'Online ordering is temporarily unavailable' }, {
                status: 503, headers: corsHeaders,
            })
        }

        const trackingUrl = new URL('/track', process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin)
        const requestKey = request.headers.get('idempotency-key') ??
            request.headers.get('x-idempotency-key') ?? client_order_id
        const result = await OrderService.createOrderAtomic({
            restaurant_id,
            table_id: tableId,
            qr_order_version: qrOrderVersion,
            order_type: resolvedOrderType,
            items: items.map((item: any) => ({
                menu_item_id: item?.menu_item_id,
                quantity: item?.quantity ?? 1,
                special_instructions: typeof item?.special_instructions === 'string'
                    ? item.special_instructions.slice(0, 500) : null,
                modifiers: item?.modifiers,
            })),
            notes: notes ? String(notes).slice(0, 500) : null,
            is_priority: false,
            customer_name: customer_name ? String(customer_name).slice(0, 100) : null,
            customer_phone: customer_phone ? String(customer_phone).slice(0, 20) : null,
            customer_email: customer_email ? String(customer_email).slice(0, 100) : null,
            delivery_address: delivery_address ? String(delivery_address).slice(0, 300) : null,
            payment_method: resolvedOrderType === 'delivery' ? 'cash_on_delivery' : payment_method ?? 'cash',
            source: isDineIn ? 'qr_menu' : 'online_storefront',
            client_order_id: requestKey,
        })

        if (!result.success || !result.order_id) {
            const status = result.code === 'conflict' ? 409 : result.code === 'internal' ? 500 : result.code === 'forbidden' ? 403 : 400
            return NextResponse.json({ error: result.error || 'Failed to create order' }, { status, headers: corsHeaders })
        }

        const token = issueOrderAccessToken(result.order_id, accessSecret, result.credential_issued_at)
        const activeToken = verifyOrderAccessToken(`Bearer ${token}`, accessSecret)
        trackingUrl.hash = `token=${token}`
        return NextResponse.json({
            success: true,
            order: {
                id: result.order_id,
                order_number: result.order_number,
                subtotal: result.subtotal,
                tax: result.tax,
                delivery_fee: result.delivery_fee,
                total: result.total,
                status: result.status,
                idempotent_replay: result.idempotent_replay || false,
            },
            tracking_url: activeToken ? trackingUrl.href : null,
            status_url: activeToken ? `/order/status/${result.order_id}#token=${token}` : null,
            message: 'Order created successfully',
        }, { status: 201, headers: { ...corsHeaders, ...privateOrderHeaders } })


    } catch (error) {
        console.error('Orders API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers: defaultCorsHeaders }
        )
    }
}

// The bearer token selects the order. Request identifiers cannot widen its scope.
export async function GET(request: NextRequest) {
    const headers = { ...defaultCorsHeaders, ...privateOrderHeaders }

    try {
        const orderId = verifyOrderAccessToken(request.headers.get('authorization'))
        if (!orderId) {
            return NextResponse.json({ error: 'A valid order link is required' }, { status: 401, headers })
        }

        const details = await OrderService.getOrderDetails(orderId)

        if (!details.success || !details.order) {
            return NextResponse.json(
                { error: 'Order not found' },
                { status: 404, headers }
            )
        }

        const order = details.order

        const statusMap: Record<string, string> = {
            pending: 'Order Received',
            preparing: 'Being Prepared',
            ready: 'Ready for Pickup',
            served: 'Served',
            paid: 'Delivered & Paid',
            cancelled: 'Cancelled',
        }

        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                order_number: order.order_number,
                status: order.status,
                status_label: statusMap[order.status] || order.status,
                order_type: order.order_type,
                subtotal: order.subtotal,
                tax: order.tax,
                delivery_fee: order.delivery_fee,
                discount: order.discount,
                total: order.total,
                created_at: order.created_at,
                table: order.table,
                restaurant: order.restaurant,
                items: (order.order_items || []).map((item: any) => ({
                    id: item.id,
                    name: item.item_name_snapshot,
                    variant: item.variant_name_snapshot,
                    price: item.unit_price,
                    quantity: item.quantity,
                    subtotal: item.subtotal,
                    special_instructions: item.special_instructions,
                    kitchen_status: item.kitchen_status,
                    modifiers: item.modifiers || [],
                })),
            },
        }, { headers })

    } catch (error) {
        console.error('Orders GET API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers }
        )
    }
}
