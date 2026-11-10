import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedStaff } from '@/lib/api-auth'

// Get admin client
function getAdminClient() {
    return createAdminClient()
}

// Validate UUID format
function isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
}

export async function PUT(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (auth.role !== 'owner') {
            return NextResponse.json({ error: 'Only the owner can update staff records' }, { status: 403 })
        }

        const body = await request.json()
        const { staffId, name, email, phone, role, restaurantId, shift, emergency_contact, hire_date, admin_notes } = body

        console.log('Staff update API called:', { staffId, name, email, phone, role, restaurantId })

        // Validate required fields
        if (!staffId) {
            return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 })
        }

        if (!isValidUUID(staffId)) {
            return NextResponse.json({ error: 'Invalid staff ID format' }, { status: 400 })
        }

        // Build update object
        const updates: Record<string, unknown> = {}

        if (name !== undefined) {
            if (!name.trim()) {
                return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
            }
            updates.name = name.trim()
        }

        if (email !== undefined) {
            updates.email = typeof email === 'string' && email.trim() ? email.trim() : null
        }

        if (phone !== undefined) {
            updates.phone = typeof phone === 'string' && phone.trim() ? phone.trim() : null
        }

        if (shift !== undefined) {
            const validShifts = ['morning', 'evening', 'night', 'full_time', 'part_time']
            if (shift && !validShifts.includes(shift)) {
                return NextResponse.json({
                    error: `Invalid shift. Must be one of: ${validShifts.join(', ')}`
                }, { status: 400 })
            }
            updates.shift = shift || null
        }

        if (emergency_contact !== undefined) {
            updates.emergency_contact = typeof emergency_contact === 'string' && emergency_contact.trim()
                ? emergency_contact.trim()
                : null
        }

        if (hire_date !== undefined) {
            updates.hire_date = hire_date || null
        }

        if (admin_notes !== undefined) {
            updates.admin_notes = typeof admin_notes === 'string' && admin_notes.trim()
                ? admin_notes.trim()
                : null
        }

        if (role !== undefined) {
            const validRoles = ['owner', 'manager', 'waiter', 'kitchen', 'cashier', 'delivery', 'rider']
            if (!validRoles.includes(role)) {
                return NextResponse.json({
                    error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
                }, { status: 400 })
            }
            updates.role = role
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
        }

        updates.updated_at = new Date().toISOString()

        const supabase = getAdminClient()

        // First verify the staff exists and belongs to the restaurant
        const targetRestaurantId = restaurantId || auth.restaurantId
        if (targetRestaurantId !== auth.restaurantId) {
            return NextResponse.json({ error: 'Cannot update staff from another restaurant' }, { status: 403 })
        }

        if (targetRestaurantId && isValidUUID(targetRestaurantId)) {
            const { data: existingStaff, error: fetchError } = await supabase
                .from('staff')
                .select('id, restaurant_id')
                .eq('id', staffId)
                .single()

            if (fetchError || !existingStaff) {
                return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
            }

            if (existingStaff.restaurant_id !== targetRestaurantId) {
                return NextResponse.json({ error: 'Staff member does not belong to this restaurant' }, { status: 403 })
            }
        }

        // Perform the update
        const { data: updatedStaff, error: updateError } = await supabase
            .from('staff')
            .update(updates)
            .eq('id', staffId)
            .select()
            .single()

        if (updateError) {
            console.error('Staff update error:', updateError)
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        console.log('Staff updated successfully:', updatedStaff)

        return NextResponse.json({
            success: true,
            staff: updatedStaff
        })

    } catch (error: unknown) {
        console.error('Staff update API error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update staff' },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const restaurantId = searchParams.get('restaurantId')

        if (!restaurantId) {
            return NextResponse.json({ error: 'Restaurant ID is required' }, { status: 400 })
        }

        if (!isValidUUID(restaurantId)) {
            return NextResponse.json({ error: 'Invalid restaurant ID format' }, { status: 400 })
        }

        if (restaurantId !== auth.restaurantId) {
            return NextResponse.json({ error: 'Cannot view staff from another restaurant' }, { status: 403 })
        }

        const supabase = getAdminClient()

        const { data: staff, error } = await supabase
            .from('staff')
            .select('id, restaurant_id, user_id, name, email, phone, role, is_active, is_archived, avatar_url, shift, hire_date, last_login_at, created_at, updated_at, emergency_contact, admin_notes, needs_setup')
            .eq('restaurant_id', restaurantId)
            .order('name')

        if (error) {
            console.error('Staff fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const { data: restaurant } = await supabase
            .from('restaurants')
            .select('id, name, owner_id')
            .eq('id', restaurantId)
            .maybeSingle()

        return NextResponse.json({ success: true, staff, restaurant })

    } catch (error: unknown) {
        console.error('Staff fetch API error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch staff' },
            { status: 500 }
        )
    }
}
