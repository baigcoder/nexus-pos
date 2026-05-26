import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWaiterOrAbove } from '@/lib/api-auth'
import { sanitizeErrorMessage } from '@/lib/auth'

const VALID_TRANSITIONS: Record<string, string[]> = {
    available: ['occupied'],
    occupied: ['available', 'billing', 'reserved'],
    billing: ['available'],
    reserved: ['available', 'occupied'],
}

export async function POST(request: NextRequest) {
    try {
        const { auth, response } = await requireWaiterOrAbove()(request)
        if (response) return response

        const supabase = createAdminClient()

        let body: unknown
        try {
            body = await request.json()
        } catch {
            return NextResponse.json(
                { success: false, error: 'Invalid request body' },
                { status: 400 }
            )
        }

        const { tableId, newStatus } = body as Record<string, unknown>

        if (!tableId || typeof tableId !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Table ID is required' },
                { status: 400 }
            )
        }

        if (!newStatus || typeof newStatus !== 'string') {
            return NextResponse.json(
                { success: false, error: 'New status is required' },
                { status: 400 }
            )
        }

        const validStatuses = ['available', 'occupied', 'billing', 'reserved']
        if (!validStatuses.includes(newStatus)) {
            return NextResponse.json(
                { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            )
        }

        const { data: table, error: fetchError } = await supabase
            .from('tables')
            .select('id, status, table_number, restaurant_id')
            .eq('id', tableId)
            .single()

        if (fetchError || !table) {
            return NextResponse.json(
                { success: false, error: 'Table not found' },
                { status: 404 }
            )
        }

        const currentStatus = table.status as string
        const allowedTransitions = VALID_TRANSITIONS[currentStatus] || []

        if (!allowedTransitions.includes(newStatus)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Cannot transition table from "${currentStatus}" to "${newStatus}". Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`,
                    currentStatus,
                    allowedTransitions,
                },
                { status: 400 }
            )
        }

        const { data: updatedTable, error: updateError } = await supabase
            .from('tables')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', tableId)
            .select()
            .single()

        if (updateError) {
            console.error('[TABLE_STATUS] Update error:', updateError.message)
            return NextResponse.json(
                { success: false, error: 'Failed to update table status' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            table: {
                id: updatedTable.id,
                table_number: updatedTable.table_number,
                status: updatedTable.status,
            },
        })
    } catch (error: unknown) {
        console.error('[TABLE_STATUS] Error:', error instanceof Error ? error.message : 'Unknown error')
        return NextResponse.json(
            { success: false, error: sanitizeErrorMessage(error) },
            { status: 500 }
        )
    }
}