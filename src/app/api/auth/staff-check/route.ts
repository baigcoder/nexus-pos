import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client for server-side operations (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Check if a staff member exists by email
 * Returns staff info needed for login UI (needs_setup flag)
 */
export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json()

        if (!email) {
            return NextResponse.json(
                { success: false, error: 'Email is required' },
                { status: 400 }
            )
        }

        // Find staff by email (uses admin client to bypass RLS)
        const { data: staff, error: staffError } = await supabaseAdmin
            .from('staff')
            .select('id, name, email, role, needs_setup, restaurants(name, slug)')
            .eq('email', email.toLowerCase().trim())
            .eq('is_active', true)
            .single()

        if (staffError || !staff) {
            return NextResponse.json(
                { success: false, error: 'No active staff account found with this email' },
                { status: 404 }
            )
        }

        // Return staff info (without sensitive data)
        return NextResponse.json({
            success: true,
            staff: {
                id: staff.id,
                name: staff.name,
                email: staff.email,
                role: staff.role,
                needs_setup: staff.needs_setup,
                restaurant: staff.restaurants,
            }
        })

    } catch (error) {
        console.error('Staff check error:', error)
        return NextResponse.json(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        )
    }
}
