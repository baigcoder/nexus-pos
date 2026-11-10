import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedStaff } from '@/lib/api-auth'

// GET /api/staff/alerts - Get alerts for the authenticated staff member
export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
        }

        const supabase = createAdminClient()
        const { searchParams } = new URL(request.url)
        const unreadOnly = searchParams.get('unread') === 'true'
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

        let query = supabase
            .from('staff_alerts')
            .select('*')
            .eq('restaurant_id', auth.restaurantId)
            .eq('to_staff_id', auth.staffId)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (unreadOnly) {
            query = query.eq('is_read', false)
        }

        const { data: alerts, error } = await query

        if (error) {
            console.error('[Staff Alerts] Fetch error:', error)
            return NextResponse.json({ success: false, error: 'Failed to fetch alerts' }, { status: 500 })
        }

        return NextResponse.json({ success: true, alerts: alerts || [] })
    } catch (err) {
        console.error('[Staff Alerts] Error:', err)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/staff/alerts - Mark alerts as read
export async function PATCH(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
        }

        const body = await request.json()
        const { alert_ids, mark_all } = body

        const supabase = createAdminClient()

        let query = supabase
            .from('staff_alerts')
            .update({ is_read: true })
            .eq('restaurant_id', auth.restaurantId)
            .eq('to_staff_id', auth.staffId)

        if (mark_all) {
            query = query.eq('is_read', false)
        } else if (Array.isArray(alert_ids) && alert_ids.length > 0) {
            query = query.in('id', alert_ids)
        } else {
            return NextResponse.json({ success: false, error: 'alert_ids or mark_all required' }, { status: 400 })
        }

        const { error } = await query

        if (error) {
            console.error('[Staff Alerts] Update error:', error)
            return NextResponse.json({ success: false, error: 'Failed to update alerts' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[Staff Alerts] Error:', err)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
