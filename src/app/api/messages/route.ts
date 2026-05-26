import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedStaff } from '@/lib/api-auth'

function isAdminOrOwner(role: string): boolean {
    return role === 'owner' || role === 'manager'
}

function canMessage(senderRole: string, receiverRole: string): boolean {
    return !!senderRole && !!receiverRole
}

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { staffId, role, restaurantId } = auth
        const { searchParams } = new URL(request.url)
        const peerId = searchParams.get('peerId')
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
        const offset = parseInt(searchParams.get('offset') || '0')

        if (!peerId) {
            return NextResponse.json({ error: 'peerId is required' }, { status: 400 })
        }

        const supabase = createAdminClient()

        const { data: peer } = await supabase
            .from('staff')
            .select('id, role, restaurant_id, is_active')
            .eq('id', peerId)
            .single()

        if (!peer) {
            return NextResponse.json({ error: 'Peer not found' }, { status: 404 })
        }

        if (peer.restaurant_id !== restaurantId) {
            return NextResponse.json({ error: 'Cannot read messages from another restaurant' }, { status: 403 })
        }

        if (!canMessage(role, peer.role)) {
            return NextResponse.json({ error: 'You cannot message this person' }, { status: 403 })
        }

        const { data: messages, error } = await supabase
            .from('messages')
            .select('*, sender:staff!sender_id(name, role, avatar_url), receiver:staff!receiver_id(name, role, avatar_url)')
            .eq('restaurant_id', restaurantId)
            .or(`and(sender_id.eq.${staffId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${staffId})`)
            .order('created_at', { ascending: true })
            .range(offset, offset + limit - 1)

        if (error) {
            console.error('Fetch messages error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, messages: messages || [] })
    } catch (error: unknown) {
        console.error('Messages GET error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch messages' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            console.error('Messages POST: No auth')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { staffId, role, restaurantId } = auth

        let body: { receiverId?: string; content?: string; messageType?: string }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const { receiverId, content, messageType } = body

        if (!receiverId || !content?.trim()) {
            return NextResponse.json({ error: 'receiverId and content are required' }, { status: 400 })
        }

        const supabase = createAdminClient()

        // Validate receiver exists and permissions
        const { data: receiver } = await supabase
            .from('staff')
            .select('id, role, restaurant_id')
            .eq('id', receiverId)
            .single()

        if (!receiver) {
            return NextResponse.json({ error: 'Receiver not found' }, { status: 404 })
        }

        if (receiver.restaurant_id !== restaurantId) {
            return NextResponse.json({ error: 'Cannot message staff from another restaurant' }, { status: 403 })
        }

        if (!canMessage(role, receiver.role)) {
            return NextResponse.json({ error: 'You cannot message this person' }, { status: 403 })
        }

        // First insert without select to avoid RLS issues
        const { data: insertResult, error: insertError } = await supabase
            .from('messages')
            .insert({
                restaurant_id: restaurantId,
                sender_id: staffId,
                receiver_id: receiverId,
                content: content.trim(),
                message_type: messageType || 'direct',
            })
            .select('id')
            .maybeSingle()

        if (insertError) {
            console.error('Send message insert error:', insertError)
            return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        if (!insertResult?.id) {
            return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
        }

        // Fetch the complete message with relations
        const { data: message, error: selectError } = await supabase
            .from('messages')
            .select('*, sender:staff!sender_id(name, role, avatar_url), receiver:staff!receiver_id(name, role, avatar_url)')
            .eq('id', insertResult.id)
            .maybeSingle()

        if (selectError) {
            console.error('Send message fetch error:', selectError)
            // Return partial success - message was created but relations failed
            return NextResponse.json({
                success: true,
                message: {
                    id: insertResult.id,
                    sender_id: staffId,
                    receiver_id: receiverId,
                    content: content.trim(),
                    message_type: messageType || 'direct',
                    is_read: false,
                    created_at: new Date().toISOString(),
                }
            })
        }

        return NextResponse.json({ success: true, message: message || null })
    } catch (error: unknown) {
        console.error('Messages POST error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to send message' },
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

        const { staffId, restaurantId } = auth
        const { searchParams } = new URL(request.url)
        const peerId = searchParams.get('peerId')

        if (!peerId) {
            return NextResponse.json({ error: 'peerId is required' }, { status: 400 })
        }

        const supabase = createAdminClient()

        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('sender_id', peerId)
            .eq('receiver_id', staffId)
            .eq('restaurant_id', restaurantId)
            .eq('is_read', false)

        if (error) {
            console.error('Mark read error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        console.error('Messages PATCH error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to mark as read' },
            { status: 500 }
        )
    }
}
