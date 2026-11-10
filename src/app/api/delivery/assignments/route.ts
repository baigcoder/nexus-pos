import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedStaff } from '@/lib/api-auth'

const STAFF_DELIVERY_VIEW_ROLES = new Set(['owner', 'manager', 'cashier', 'delivery', 'rider'])
const DELIVERY_WORKER_ROLES = new Set(['delivery', 'rider'])
const DELIVERY_MANAGER_ROLES = new Set(['owner', 'manager'])

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        if (!STAFF_DELIVERY_VIEW_ROLES.has(auth.role)) {
            return NextResponse.json({ success: false, error: 'Delivery access denied' }, { status: 403 })
        }

        const supabase = createAdminClient()
        let query = supabase
            .from('delivery_assignments')
            .select('*, order:orders(id, order_number, total, amount_paid, payment_method, status, created_at, order_items(quantity, menu_item:menu_items(name)))')
            .eq('restaurant_id', auth.restaurantId)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false })

        if (DELIVERY_WORKER_ROLES.has(auth.role)) {
            query = query.eq('rider_id', auth.staffId)
        }

        const { data, error } = await query
        if (error) {
            console.error('Delivery assignments GET error:', error)
            return NextResponse.json({ success: false, error: 'Failed to load deliveries' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            assignments: data || [],
            scope: DELIVERY_WORKER_ROLES.has(auth.role) ? 'mine' : 'restaurant',
            role: auth.role,
            staffId: auth.staffId,
        }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error: unknown) {
        console.error('Delivery assignments GET error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to load deliveries' },
            { status: 500 }
        )
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const canManage = DELIVERY_MANAGER_ROLES.has(auth.role)
        const body = await request.json().catch(() => null)
        const canAct = body?.status === 'reconcile_cash'
            ? canManage || auth.role === 'cashier'
            : canManage || DELIVERY_WORKER_ROLES.has(auth.role)
        if (!canAct) {
            return NextResponse.json({ success: false, error: 'Delivery access denied' }, { status: 403 })
        }
        const assignmentId = body?.assignmentId
        const status = body?.status
        const validStatuses = ['assigned', 'picked_up', 'en_route', 'arrived', 'delivered', 'reconcile_cash', 'dispatch_exception']
        const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
        if (typeof assignmentId !== 'string' || !uuid.test(assignmentId) || !validStatuses.includes(status)) {
            return NextResponse.json({ success: false, error: 'Valid assignmentId and status are required' }, { status: 400 })
        }

        const supabase = createAdminClient()
        const riderId = body?.riderId
        if (riderId !== undefined && (!canManage || status !== 'assigned')) {
            return NextResponse.json({ success: false, error: 'Rider assignment access denied' }, { status: 403 })
        }
        if (riderId !== undefined && (typeof riderId !== 'string' || !uuid.test(riderId))) {
            return NextResponse.json({ success: false, error: 'Valid riderId is required' }, { status: 400 })
        }

        const cashCollected = body?.cashCollected
        if (cashCollected !== undefined &&
            (status !== 'delivered' || !Number.isFinite(cashCollected) || cashCollected <= 0)) {
            return NextResponse.json({ success: false, error: 'Invalid cash collection amount' }, { status: 400 })
        }

        const scope = {
            p_restaurant_id: auth.restaurantId,
            p_assignment_id: assignmentId,
            p_staff_id: auth.staffId,
        }
        let result
        if (riderId !== undefined) {
            result = await supabase.rpc('assign_delivery_rider', { ...scope, p_rider_id: riderId })
        } else if (status === 'delivered') {
            result = await supabase.rpc('complete_delivery_with_cash', {
                ...scope, p_can_manage: canManage, p_cash_collected: cashCollected ?? null,
            })
        } else if (status === 'reconcile_cash') {
            result = await supabase.rpc('reconcile_delivery_cash', scope)
        } else if (status === 'dispatch_exception') {
            if (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 500) {
                return NextResponse.json({ success: false, error: 'A delivery exception reason is required' }, { status: 400 })
            }
            result = await supabase.rpc('report_delivery_exception', { ...scope, p_reason: body.reason })
        } else {
            result = await supabase.rpc('transition_delivery_assignment', {
                ...scope, p_target: status, p_can_manage: canManage,
            })
        }
        const { data, error } = result
        if (error) {
            console.error('Delivery assignment transition failed:', error)
            return NextResponse.json({ success: false, error: 'Failed to update delivery' }, { status: 500 })
        }
        if (!data.success) {
            const status = data.code === 'not_found' ? 404 : data.code === 'forbidden' ? 403 : data.code === 'invalid' ? 400 : 409
            return NextResponse.json(data, { status })
        }

        return NextResponse.json(data)
    } catch (error: unknown) {
        console.error('Delivery assignments PATCH error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to update delivery' },
            { status: 500 }
        )
    }
}
