import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedStaff } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { staffId, role, restaurantId } = auth

        if (role !== 'owner') {
            return NextResponse.json({ error: 'Only owners can send broadcasts' }, { status: 403 })
        }

        const body = await request.json()
        const { content, receiverIds } = body

        if (!content?.trim()) {
            return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
        }

        const supabase = createAdminClient()

        const { data: targetStaff, error: staffError } = await supabase
            .from('staff')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('is_active', true)
            .neq('id', staffId)

        if (staffError) {
            console.error('Broadcast staff fetch error:', staffError)
            return NextResponse.json({ error: staffError.message }, { status: 500 })
        }

        let recipients = targetStaff || []
        if (receiverIds && Array.isArray(receiverIds) && receiverIds.length > 0) {
            recipients = recipients.filter(s => receiverIds.includes(s.id))
        }

        if (recipients.length === 0) {
            return NextResponse.json({ error: 'No recipients found' }, { status: 400 })
        }

        const messages = recipients.map(r => ({
            restaurant_id: restaurantId,
            sender_id: staffId,
            receiver_id: r.id,
            content: content.trim(),
            message_type: 'broadcast' as const,
            is_read: false,
        }))

        const { data: inserted, error: insertError } = await supabase
            .from('messages')
            .insert(messages)
            .select()

        if (insertError) {
            console.error('Broadcast insert error:', insertError)
            return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, count: inserted?.length || 0 })
    } catch (error: unknown) {
        console.error('Broadcast POST error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to send broadcast' },
            { status: 500 }
        )
    }
}