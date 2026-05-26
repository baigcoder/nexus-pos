import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedStaff } from '@/lib/api-auth'

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
        const supabase = createAdminClient()

        const { data: allStaff, error: staffError } = await supabase
            .from('staff')
            .select('id, name, role, avatar_url, is_active, phone')
            .eq('restaurant_id', restaurantId)
            .neq('id', staffId)
            .eq('is_active', true)

        if (staffError) {
            console.error('Fetch staff error:', staffError)
            return NextResponse.json({ error: staffError.message }, { status: 500 })
        }

        const visibleStaff = (allStaff || []).filter(s => canMessage(role, s.role))

        if (visibleStaff.length === 0) {
            return NextResponse.json({ success: true, conversations: [] })
        }

        const peerIds = visibleStaff.map(s => s.id)

        const { data: lastMessages } = await supabase
            .from('messages')
            .select('sender_id, receiver_id, content, created_at, message_type')
            .eq('restaurant_id', restaurantId)
            .or(`sender_id.eq.${staffId},receiver_id.eq.${staffId}`)
            .order('created_at', { ascending: false })

        const { data: unreadCounts } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('restaurant_id', restaurantId)
            .eq('receiver_id', staffId)
            .eq('is_read', false)

        const unreadMap = new Map<string, number>()
        ;(unreadCounts || []).forEach(m => {
            unreadMap.set(m.sender_id, (unreadMap.get(m.sender_id) || 0) + 1)
        })

        const lastMessageMap = new Map<string, { content: string; created_at: string }>()
        ;(lastMessages || []).forEach(m => {
            const peerId = m.sender_id === staffId ? m.receiver_id : m.sender_id
            if (!lastMessageMap.has(peerId)) {
                lastMessageMap.set(peerId, { content: m.content, created_at: m.created_at })
            }
        })

        const conversations = visibleStaff.map(s => ({
            peer_id: s.id,
            peer_name: s.name,
            peer_role: s.role,
            peer_avatar_url: s.avatar_url,
            peer_phone: s.phone,
            peer_is_active: s.is_active,
            last_message: lastMessageMap.get(s.id)?.content || null,
            last_message_at: lastMessageMap.get(s.id)?.created_at || null,
            unread_count: unreadMap.get(s.id) || 0,
        }))

        conversations.sort((a, b) => {
            const aDate = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
            const bDate = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
            return bDate - aDate
        })

        return NextResponse.json({ success: true, conversations })
    } catch (error: unknown) {
        console.error('Conversations GET error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch conversations' },
            { status: 500 }
        )
    }
}
