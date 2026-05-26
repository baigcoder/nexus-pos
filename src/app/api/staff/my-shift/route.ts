import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedStaff } from '@/lib/api-auth'

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10)
}

function timeFromDate(date: Date) {
    return date.toTimeString().slice(0, 8)
}

function toShiftResponse(shift: any) {
    const clockIn = `${shift.shift_date}T${shift.start_time || '00:00:00'}`
    const clockOut = shift.end_time ? `${shift.shift_date}T${shift.end_time}` : null
    const totalHours = clockOut
        ? Math.max(0, (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60) - (Number(shift.break_minutes || 0) / 60))
        : null

    return {
        id: shift.id,
        clock_in: clockIn,
        clock_out: clockOut,
        break_minutes: Number(shift.break_minutes || 0),
        total_hours: totalHours === null ? null : Math.round(totalHours * 100) / 100,
        status: shift.status,
        notes: shift.notes,
    }
}

async function loadShifts(staffId: string, restaurantId: string) {
    const supabase = createAdminClient()

    const { data: activeShift, error: activeError } = await supabase
        .from('shifts')
        .select('*')
        .eq('staff_id', staffId)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (activeError) throw activeError

    const { data: history, error: historyError } = await supabase
        .from('shifts')
        .select('*')
        .eq('staff_id', staffId)
        .eq('restaurant_id', restaurantId)
        .in('status', ['completed', 'absent'])
        .order('shift_date', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(10)

    if (historyError) throw historyError

    return {
        currentShift: activeShift ? toShiftResponse(activeShift) : null,
        history: (history || []).map(toShiftResponse),
    }
}

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const shifts = await loadShifts(auth.staffId, auth.restaurantId)
        return NextResponse.json({ success: true, ...shifts })
    } catch (error: unknown) {
        console.error('My shift GET error:', error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to load shift data' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { action } = body as { action?: 'clock_in' | 'clock_out' | 'add_break_minutes' }
        const supabase = createAdminClient()

        if (action === 'clock_in') {
            const existing = await loadShifts(auth.staffId, auth.restaurantId)
            if (existing.currentShift) {
                return NextResponse.json({ success: true, currentShift: existing.currentShift, alreadyActive: true })
            }

            const now = new Date()
            const { data, error } = await supabase
                .from('shifts')
                .insert({
                    staff_id: auth.staffId,
                    restaurant_id: auth.restaurantId,
                    shift_date: todayIsoDate(),
                    start_time: timeFromDate(now),
                    status: 'active',
                    break_minutes: 0,
                    notes: 'Clocked in from My Shift',
                })
                .select('*')
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, currentShift: toShiftResponse(data) })
        }

        if (action === 'clock_out') {
            const existing = await loadShifts(auth.staffId, auth.restaurantId)
            if (!existing.currentShift) {
                return NextResponse.json({ success: false, error: 'No active shift found' }, { status: 404 })
            }

            const { data, error } = await supabase
                .from('shifts')
                .update({
                    end_time: timeFromDate(new Date()),
                    status: 'completed',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.currentShift.id)
                .eq('staff_id', auth.staffId)
                .eq('restaurant_id', auth.restaurantId)
                .select('*')
                .single()

            if (error) throw error
            const shifts = await loadShifts(auth.staffId, auth.restaurantId)
            return NextResponse.json({ success: true, completedShift: toShiftResponse(data), ...shifts })
        }

        if (action === 'add_break_minutes') {
            const minutes = Math.max(1, Math.min(240, Number((body as any).minutes || 0)))
            const existing = await loadShifts(auth.staffId, auth.restaurantId)
            if (!existing.currentShift) {
                return NextResponse.json({ success: false, error: 'No active shift found' }, { status: 404 })
            }

            const { data, error } = await supabase
                .from('shifts')
                .update({
                    break_minutes: Number(existing.currentShift.break_minutes || 0) + minutes,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.currentShift.id)
                .eq('staff_id', auth.staffId)
                .eq('restaurant_id', auth.restaurantId)
                .select('*')
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, currentShift: toShiftResponse(data) })
        }

        return NextResponse.json({ success: false, error: 'Invalid shift action' }, { status: 400 })
    } catch (error: unknown) {
        console.error('My shift POST error:', error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to update shift' },
            { status: 500 }
        )
    }
}
