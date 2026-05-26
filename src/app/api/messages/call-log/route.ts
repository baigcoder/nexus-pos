import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedStaff } from '@/lib/api-auth'

function canCall(senderRole: string, receiverRole: string): boolean {
    return !!senderRole && !!receiverRole
}

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { staffId, role, restaurantId } = auth
        const body = await request.json()
        const { receiverId, callType, status, durationSeconds, endedAt } = body

        if (!receiverId) {
            return NextResponse.json({ error: 'receiverId is required' }, { status: 400 })
        }

        const supabase = createAdminClient()

        const { data: receiver } = await supabase
            .from('staff')
            .select('id, role, restaurant_id')
            .eq('id', receiverId)
            .single()

        if (!receiver) {
            return NextResponse.json({ error: 'Receiver not found' }, { status: 404 })
        }

        if (receiver.restaurant_id !== restaurantId) {
            return NextResponse.json({ error: 'Cannot call staff from another restaurant' }, { status: 403 })
        }

        if (!canCall(role, receiver.role)) {
            return NextResponse.json({ error: 'You cannot call this person' }, { status: 403 })
        }

        const callLog: Record<string, unknown> = {
            restaurant_id: restaurantId,
            caller_id: staffId,
            receiver_id: receiverId,
            call_type: callType || 'audio',
            status: status || 'initiated',
        }

        if (durationSeconds !== undefined) callLog.duration_seconds = durationSeconds
        if (endedAt) callLog.ended_at = endedAt
        if (status === 'connected' || status === 'ended') callLog.started_at = new Date().toISOString()

        const { data: log, error } = await supabase
            .from('call_logs')
            .insert(callLog)
            .select()
            .single()

        if (error) {
            console.error('Call log insert error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, callLog: log })
    } catch (error: unknown) {
        console.error('Call log POST error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to log call' },
            { status: 500 }
        )
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { staffId } = auth
        const body = await request.json()
        const { callLogId, status, durationSeconds, endedAt } = body

        if (!callLogId) {
            return NextResponse.json({ error: 'callLogId is required' }, { status: 400 })
        }

        const supabase = createAdminClient()

        const update: Record<string, unknown> = { status }
        if (durationSeconds !== undefined) update.duration_seconds = durationSeconds
        if (endedAt) update.ended_at = endedAt

        const { data, error } = await supabase
            .from('call_logs')
            .update(update)
            .eq('id', callLogId)
            .eq('caller_id', staffId)
            .select()
            .single()

        if (error) {
            console.error('Call log update error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, callLog: data })
    } catch (error: unknown) {
        console.error('Call log PATCH error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update call log' },
            { status: 500 }
        )
    }
}
