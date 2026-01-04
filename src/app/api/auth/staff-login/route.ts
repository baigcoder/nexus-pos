import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

// Simple in-memory rate limiting
// In production, consider using Redis for distributed rate limiting
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>()
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 5

function checkRateLimit(key: string): { allowed: boolean; remainingAttempts: number; retryAfter?: number } {
    const now = Date.now()
    const attempt = loginAttempts.get(key)

    if (!attempt) {
        loginAttempts.set(key, { count: 1, firstAttempt: now })
        return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 }
    }

    // Reset if window has passed
    if (now - attempt.firstAttempt > RATE_LIMIT_WINDOW) {
        loginAttempts.set(key, { count: 1, firstAttempt: now })
        return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 }
    }

    // Check if exceeded
    if (attempt.count >= MAX_ATTEMPTS) {
        const retryAfter = Math.ceil((RATE_LIMIT_WINDOW - (now - attempt.firstAttempt)) / 1000)
        return { allowed: false, remainingAttempts: 0, retryAfter }
    }

    // Increment count
    attempt.count++
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - attempt.count }
}

function resetRateLimit(key: string) {
    loginAttempts.delete(key)
}

// Create admin client for server-side operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const { restaurantSlug, pin } = await request.json()

        if (!restaurantSlug || !pin) {
            return NextResponse.json(
                { success: false, error: 'Restaurant slug and PIN are required' },
                { status: 400 }
            )
        }

        // Rate limit by restaurant slug + IP
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const rateLimitKey = `${restaurantSlug}:${ip}`
        const rateCheck = checkRateLimit(rateLimitKey)

        if (!rateCheck.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Too many login attempts. Please try again in ${rateCheck.retryAfter} seconds.`,
                    retryAfter: rateCheck.retryAfter
                },
                { status: 429 }
            )
        }

        // Find restaurant by slug
        const { data: restaurant, error: restaurantError } = await supabaseAdmin
            .from('restaurants')
            .select('*')
            .eq('slug', restaurantSlug)
            .single()

        if (restaurantError || !restaurant) {
            return NextResponse.json(
                { success: false, error: 'Restaurant not found. Check the facility code.' },
                { status: 404 }
            )
        }

        // Find all active staff for this restaurant
        const { data: staffList, error: staffError } = await supabaseAdmin
            .from('staff')
            .select('*')
            .eq('restaurant_id', restaurant.id)
            .eq('is_active', true)

        if (staffError || !staffList || staffList.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No active staff found.' },
                { status: 404 }
            )
        }

        // Try to match PIN with each staff member
        // First try bcrypt comparison (hashed PINs)
        // Then fallback to plain text (for migration period)
        let matchedStaff = null

        for (const staff of staffList) {
            // Check if PIN is hashed (starts with $2)
            if (staff.pin.startsWith('$2')) {
                const isMatch = await bcrypt.compare(pin, staff.pin)
                if (isMatch) {
                    matchedStaff = staff
                    break
                }
            } else {
                // Plain text comparison (legacy, should be migrated)
                if (staff.pin === pin) {
                    matchedStaff = staff
                    break
                }
            }
        }

        if (!matchedStaff) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid PIN or inactive operative.',
                    remainingAttempts: rateCheck.remainingAttempts
                },
                { status: 401 }
            )
        }

        // Success - reset rate limit
        resetRateLimit(rateLimitKey)

        // Remove sensitive data before returning
        const { pin: _, ...safeStaff } = matchedStaff

        return NextResponse.json({
            success: true,
            staff: safeStaff,
            restaurant
        })

    } catch (error) {
        console.error('Staff login error:', error)
        return NextResponse.json(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        )
    }
}
