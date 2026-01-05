import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

// Create admin client for server-side operations (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Complete staff setup - set permanent PIN
 */
export async function POST(request: NextRequest) {
    try {
        const { email, tempPin, newPin, phone } = await request.json()

        if (!email || !tempPin || !newPin) {
            return NextResponse.json(
                { success: false, error: 'Email, temporary PIN, and new PIN are required' },
                { status: 400 }
            )
        }

        if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
            return NextResponse.json(
                { success: false, error: 'New PIN must be exactly 4 digits' },
                { status: 400 }
            )
        }

        // Find staff by email and verify temp PIN
        const { data: staff, error: staffError } = await supabaseAdmin
            .from('staff')
            .select('*, restaurants(*)')
            .eq('email', email.toLowerCase().trim())
            .eq('is_active', true)
            .single()

        if (staffError || !staff) {
            return NextResponse.json(
                { success: false, error: 'Staff member not found' },
                { status: 404 }
            )
        }

        // Verify temp PIN
        if (staff.temp_pin !== tempPin) {
            return NextResponse.json(
                { success: false, error: 'Invalid temporary PIN' },
                { status: 401 }
            )
        }

        // Clean phone number (max 10 chars to match DB column, remove spaces)
        let cleanPhone = phone?.trim()?.replace(/\s/g, '') || null
        if (cleanPhone && cleanPhone.length > 10) {
            // Take last 10 digits (usually the main number without country code)
            cleanPhone = cleanPhone.slice(-10)
        }

        // Update staff record
        // Note: PIN is stored as plain text (4 digits) due to DB column size constraint
        const { error: updateError } = await supabaseAdmin
            .from('staff')
            .update({
                pin: newPin, // Store plain PIN (DB column is varchar(10))
                phone: cleanPhone,
                needs_setup: false,
                temp_pin: null, // Clear temp PIN
                setup_completed_at: new Date().toISOString(),
            })
            .eq('id', staff.id)

        if (updateError) {
            console.error('Staff setup update error:', updateError)
            return NextResponse.json(
                { success: false, error: 'Failed to complete setup' },
                { status: 500 }
            )
        }

        // Return updated staff data (without sensitive fields)
        const { pin: _, temp_pin: __, ...safeStaff } = staff

        return NextResponse.json({
            success: true,
            staff: {
                ...safeStaff,
                needs_setup: false,
            },
            restaurant: staff.restaurants,
            message: 'Setup completed successfully!'
        })

    } catch (error) {
        console.error('Staff setup error:', error)
        return NextResponse.json(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        )
    }
}
