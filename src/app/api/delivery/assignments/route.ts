import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedStaff } from '@/lib/api-auth'

const STAFF_DELIVERY_VIEW_ROLES = new Set(['owner', 'manager', 'waiter', 'kitchen', 'cashier', 'delivery', 'rider'])
const DELIVERY_WORKER_ROLES = new Set(['delivery', 'rider'])
const DELIVERY_MANAGER_ROLES = new Set(['owner', 'manager'])

function canUpdateDelivery(role: string, riderId: string | null, staffId: string) {
    return DELIVERY_MANAGER_ROLES.has(role) || (DELIVERY_WORKER_ROLES.has(role) && riderId === staffId)
}

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
            .select('*, order:orders(id, order_number, total, created_at, order_items(quantity, menu_item:menu_items(name)))')
            .eq('restaurant_id', auth.restaurantId)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false })

        if (DELIVERY_WORKER_ROLES.has(auth.role)) {
            query = query.eq('rider_id', auth.staffId)
        }

        const { data, error } = await query
        if (error) {
            console.error('Delivery assignments GET error:', error)
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            assignments: data || [],
            scope: DELIVERY_WORKER_ROLES.has(auth.role) ? 'mine' : 'restaurant',
            role: auth.role,
            staffId: auth.staffId,
        })
    } catch (error: unknown) {
        console.error('Delivery assignments GET error:', error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to load deliveries' },
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

        const body = await request.json()
        const { assignmentId, status } = body as { assignmentId?: string; status?: string }
        const validStatuses = ['assigned', 'ready_pickup', 'picked_up', 'en_route', 'arrived', 'delivered']

        if (!assignmentId || !status || !validStatuses.includes(status)) {
            return NextResponse.json({ success: false, error: 'Valid assignmentId and status are required' }, { status: 400 })
        }

        const supabase = createAdminClient()
        const { data: assignment, error: fetchError } = await supabase
            .from('delivery_assignments')
            .select('id, restaurant_id, rider_id, order_id')
            .eq('id', assignmentId)
            .eq('restaurant_id', auth.restaurantId)
            .maybeSingle()

        if (fetchError) {
            return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
        }

        if (!assignment) {
            return NextResponse.json({ success: false, error: 'Delivery assignment not found' }, { status: 404 })
        }

        if (!canUpdateDelivery(auth.role, assignment.rider_id, auth.staffId)) {
            return NextResponse.json(
                { success: false, error: 'Only the assigned rider, manager, or owner can update this delivery' },
                { status: 403 }
            )
        }

        const update: Record<string, unknown> = {
            status,
            updated_at: new Date().toISOString(),
        }

        if (status === 'picked_up') update.actual_pickup_time = new Date().toISOString()
        if (status === 'delivered') update.actual_delivery_time = new Date().toISOString()

        const { error: updateError } = await supabase
            .from('delivery_assignments')
            .update(update)
            .eq('id', assignment.id)
            .eq('restaurant_id', auth.restaurantId)

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
        }

        if (status === 'delivered' && assignment.order_id) {
            await supabase
                .from('orders')
                .update({ status: 'served' })
                .eq('id', assignment.order_id)
                .eq('restaurant_id', auth.restaurantId)
        }

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        console.error('Delivery assignments PATCH error:', error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to update delivery' },
            { status: 500 }
        )
    }
}
