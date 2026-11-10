import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedStaff, tenantMismatchResponse } from '@/lib/api-auth'
import { OrderService } from '@/lib/services/order-service'

const managers = ['owner', 'manager']
const riders = ['rider', 'delivery']
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const privateHeaders = { 'Cache-Control': 'private, no-store' }

function responseStatus(code?: string) {
    if (code === 'forbidden') return 403
    if (code === 'not_found') return 404
    if (code === 'conflict') return 409
    if (code === 'internal') return 500
    return 400
}

function legacyTracking(assignment: Record<string, unknown>, orderStatus: string) {
    const status = assignment.status
    return {
        ...assignment,
        status: status === 'dispatch_exception' ? 'failed'
            : status === 'en_route' || status === 'arrived' ? 'in_transit'
            : status === 'assigned' || status === 'pending_dispatch'
                ? orderStatus === 'ready' ? 'ready' : 'preparing' : status,
        pickup_time: assignment.actual_pickup_time,
        delivery_time: assignment.actual_delivery_time,
    }
}

// Compatibility API. All writes use the same commands as current checkout and dispatch.
export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await request.json().catch(() => null)
        if (!body || typeof body.data !== 'object' || !body.data || Array.isArray(body.data)) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }
        if (body.restaurant_id !== undefined && body.restaurant_id !== auth.restaurantId) return tenantMismatchResponse()

        const input = body.data
        const canManage = managers.includes(auth.role)
        const isRider = riders.includes(auth.role)

        if (body.action === 'create_delivery_order') {
            if (!canManage && !['cashier', 'waiter'].includes(auth.role)) {
                return NextResponse.json({ error: 'Order creation access denied' }, { status: 403 })
            }
            const customerName = typeof input.customer_name === 'string' ? input.customer_name.trim().slice(0, 100) : ''
            const customerPhone = typeof input.customer_phone === 'string' ? input.customer_phone.trim() : ''
            const address = typeof input.delivery_address === 'string' ? input.delivery_address.trim().slice(0, 300) : ''
            if (!customerName || !/^[\d\s()+-]{10,20}$/.test(customerPhone) || !address ||
                !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) {
                return NextResponse.json({ error: 'Customer, valid phone, delivery address and items are required' }, { status: 400 })
            }
            const order = await OrderService.createOrderAtomic({
                restaurant_id: auth.restaurantId,
                staff_id: auth.staffId,
                order_type: 'delivery',
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_email: typeof input.customer_email === 'string' ? input.customer_email.slice(0, 100) : null,
                delivery_address: address,
                notes: typeof input.notes === 'string' ? input.notes.slice(0, 500) : null,
                source: ['website', 'phone', 'walkin'].includes(input.source) ? input.source : 'phone',
                payment_method: 'cash_on_delivery',
                client_order_id: request.headers.get('idempotency-key') ??
                    request.headers.get('x-idempotency-key') ?? input.client_order_id,
                items: input.items.map((item: any) => ({
                    menu_item_id: item?.menu_item_id,
                    quantity: item?.quantity ?? 1,
                    special_instructions: typeof item?.notes === 'string' ? item.notes.slice(0, 500) : null,
                    modifiers: item?.modifiers,
                })),
            })
            if (!order.success) return NextResponse.json({ error: order.error }, { status: responseStatus(order.code) })
            return NextResponse.json({ success: true, order: {
                id: order.order_id, order_number: order.order_number, status: order.status,
                subtotal: order.subtotal, tax: order.tax, delivery_fee: order.delivery_fee, total: order.total,
            } }, { headers: privateHeaders })
        }

        if (!canManage && (!isRider || body.action === 'assign_rider')) {
            return NextResponse.json({ error: 'Delivery access denied' }, { status: 403 })
        }
        if (typeof input.order_id !== 'string' || !uuid.test(input.order_id)) {
            return NextResponse.json({ error: 'Valid order_id is required' }, { status: 400 })
        }

        const supabase = createAdminClient()
        let lookup = supabase.from('delivery_assignments')
            .select('*, order:orders!inner(order_number, total, status, created_at, restaurant_id), rider:staff(name, phone)')
            .eq('restaurant_id', auth.restaurantId)
            .eq('order.restaurant_id', auth.restaurantId)
            .eq('order_id', input.order_id)
            .neq('status', 'cancelled')
        if (isRider) lookup = lookup.eq('rider_id', auth.staffId)
        const { data: assignment, error: lookupError } = await lookup.maybeSingle()
        if (lookupError) throw lookupError
        if (!assignment) return NextResponse.json({ error: 'Delivery assignment not found' }, { status: 404 })

        const scope = {
            p_restaurant_id: auth.restaurantId,
            p_assignment_id: assignment.id,
            p_staff_id: auth.staffId,
        }

        let command
        switch (body.action) {
            case 'assign_rider':
                if (typeof input.rider_id !== 'string' || !uuid.test(input.rider_id)) {
                    return NextResponse.json({ error: 'Valid rider_id is required' }, { status: 400 })
                }
                command = await supabase.rpc('assign_delivery_rider', { ...scope, p_rider_id: input.rider_id })
                break
            case 'rider_pickup':
                command = await supabase.rpc('transition_delivery_assignment', {
                    ...scope, p_target: 'picked_up', p_can_manage: canManage,
                })
                break
            case 'rider_delivered':
                if (input.cash_collected !== undefined &&
                    (!Number.isFinite(input.cash_collected) || input.cash_collected <= 0)) {
                    return NextResponse.json({ error: 'Invalid cash amount' }, { status: 400 })
                }
                command = await supabase.rpc('complete_delivery_with_cash', {
                    ...scope, p_cash_collected: input.cash_collected ?? null, p_can_manage: canManage,
                })
                break
            case 'delivery_failed':
                command = await supabase.rpc('report_delivery_exception', {
                    ...scope, p_reason: typeof input.reason === 'string' ? input.reason : null,
                })
                break
            case 'get_delivery_status': {
                const order = Array.isArray(assignment.order) ? assignment.order[0] : assignment.order
                const tracking = legacyTracking(assignment, order.status)
                const timeline = [
                    { status: 'Order Received', time: order.created_at, done: true },
                    ...(assignment.actual_pickup_time ? [{ status: 'Picked Up', time: assignment.actual_pickup_time, done: true }] : []),
                    ...(assignment.actual_delivery_time ? [{ status: 'Delivered', time: assignment.actual_delivery_time, done: true }] : []),
                ]
                return NextResponse.json({ order: {
                    order_number: order.order_number, customer_name: assignment.customer_name,
                    address: assignment.delivery_address, total: order.total, current_status: tracking.status,
                    rider: assignment.rider, timeline, estimated_minutes: assignment.estimated_minutes,
                    actual_minutes: assignment.actual_minutes,
                } }, { headers: privateHeaders })
            }
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }

        if (command.error) throw command.error
        return NextResponse.json(command.data, {
            status: command.data.success ? 200 : responseStatus(command.data.code),
            headers: privateHeaders,
        })
    } catch (error) {
        console.error('Delivery flow error:', error)
        return NextResponse.json({ error: 'Delivery operation failed' }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        const restaurantId = request.nextUrl.searchParams.get('restaurant_id')
        if (restaurantId !== null && restaurantId !== auth.restaurantId) return tenantMismatchResponse()

        const isRider = riders.includes(auth.role)
        if (!isRider && ![...managers, 'cashier'].includes(auth.role)) {
            return NextResponse.json({ error: 'Delivery access denied' }, { status: 403 })
        }

        const view = request.nextUrl.searchParams.get('view') ?? 'active'
        let query = createAdminClient().from('delivery_assignments')
            .select('*, order:orders!inner(*, items:order_items(*))')
            .eq('restaurant_id', auth.restaurantId)
            .eq('order.restaurant_id', auth.restaurantId)
            .not('status', 'in', '(cancelled,delivered,dispatch_exception)')
            .order('created_at', { ascending: false })
            .limit(100)

        if (isRider || view === 'my_deliveries') query = query.eq('rider_id', auth.staffId)
        if (view === 'pending') query = query.in('order.status', ['pending', 'preparing'])
        if (view === 'ready') query = query.in('order.status', ['ready', 'served', 'paid'])

        const { data, error } = await query
        if (error) throw error
        const orders = (data ?? []).map(({ order, ...assignment }) => {
            const row = Array.isArray(order) ? order[0] : order
            return { ...row, tracking: [legacyTracking(assignment, row.status)] }
        })
        return NextResponse.json({ orders }, { headers: privateHeaders })
    } catch (error) {
        console.error('Delivery flow GET error:', error)
        return NextResponse.json({ error: 'Failed to load deliveries' }, { status: 500 })
    }
}
