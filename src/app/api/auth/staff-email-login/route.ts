import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

// Create admin client for server-side operations (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const { email, pin } = await request.json()

        if (!email || !pin) {
            return NextResponse.json(
                { success: false, error: 'Email and PIN are required' },
                { status: 400 }
            )
        }

        // Find staff by email (uses admin client to bypass RLS)
        const { data: staff, error: staffError } = await supabaseAdmin
            .from('staff')
            .select('*, restaurants(*)')
            .eq('email', email.toLowerCase().trim())
            .eq('is_active', true)
            .single()

        if (staffError || !staff) {
            console.error('Staff lookup error:', staffError)
            return NextResponse.json(
                { success: false, error: 'No active staff account found with this email' },
                { status: 404 }
            )
        }

        const restaurant = staff.restaurants

        // Check if staff needs setup (has temp_pin)
        if (staff.needs_setup && staff.temp_pin) {
            // Verify temp PIN
            if (staff.temp_pin !== pin) {
                return NextResponse.json(
                    { success: false, error: 'Invalid temporary PIN', needsSetup: true },
                    { status: 401 }
                )
            }

            // Return success with needs_setup flag
            const { pin: _, temp_pin: __, ...safeStaff } = staff
            return NextResponse.json({
                success: true,
                needsSetup: true,
                staff: safeStaff,
                restaurant,
                setupUrl: `/staff-setup?email=${encodeURIComponent(staff.email)}&token=${staff.temp_pin}`
            })
        }

        // Regular PIN login (hashed or plain)
        let pinValid = false

        if (staff.pin) {
            if (staff.pin.startsWith('$2')) {
                pinValid = await bcrypt.compare(pin, staff.pin)
            } else {
                pinValid = staff.pin === pin
            }
        }

        if (!pinValid) {
            return NextResponse.json(
                { success: false, error: 'Invalid PIN', needsSetup: false },
                { status: 401 }
            )
        }

        // Remove sensitive data before returning
        const { pin: _, temp_pin: __, ...safeStaff } = staff

        return NextResponse.json({
            success: true,
            needsSetup: false,
            staff: safeStaff,
            restaurant
        })

    } catch (error) {
        console.error('Staff email login error:', error)
        return NextResponse.json(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        )
    }
}
