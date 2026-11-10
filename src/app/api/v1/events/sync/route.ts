import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireManagerOrOwner, tenantMismatchResponse } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/events/sync
 * Staff-only inspection of restaurant events ordered by event ID.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl
        const { auth, response } = await requireManagerOrOwner()(request)
        if (response) return response

        const since = searchParams.get('since_seq') ?? '0'
        const requestedLimit = searchParams.get('limit') ?? '100'
        if (!/^\d+$/.test(since) || !/^\d+$/.test(requestedLimit) ||
            !Number.isSafeInteger(Number(since)) || !Number.isSafeInteger(Number(requestedLimit)) || Number(requestedLimit) < 1) {
            return NextResponse.json({ success: false, error: 'Invalid event cursor or limit' }, { status: 400 })
        }
        const sinceSeq = Number(since)
        const limit = Math.min(Number(requestedLimit), 500)
        const paramRestaurantId = searchParams.get('restaurant_id')
        const aggregateType = searchParams.get('aggregate_type')

        const restaurantId = auth.restaurantId
        if (paramRestaurantId !== null && paramRestaurantId !== restaurantId) return tenantMismatchResponse()

        const supabase = createAdminClient()

        let query = supabase
            .from('restaurant_events')
            .select('id, restaurant_id, aggregate_type, aggregate_id, event_type, payload, created_at')
            .eq('restaurant_id', restaurantId)
            .gt('id', sinceSeq)
            .order('id', { ascending: true })
            .limit(limit + 1)

        if (aggregateType) {
            query = query.eq('aggregate_type', aggregateType.toUpperCase())
        }

        const { data: rows, error } = await query

        if (error) {
            console.error('[EventsSync] Database query error:', error)
            return NextResponse.json(
                { success: false, error: 'Failed to retrieve event stream' },
                { status: 500 }
            )
        }

        const allRows = rows || []
        const hasMore = allRows.length > limit
        const events = hasMore ? allRows.slice(0, limit) : allRows
        const latestSeq = events.length > 0 ? events[events.length - 1].id : sinceSeq

        return NextResponse.json({
            success: true,
            events,
            since_seq: sinceSeq,
            latest_seq: latestSeq,
            has_more: hasMore,
            count: events.length,
        }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (err) {
        console.error('[EventsSync] Unhandled error:', err)
        return NextResponse.json(
            { success: false, error: 'Internal server error while syncing events' },
            { status: 500 }
        )
    }
}

