import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

// Rate limiting constants
const RATE_LIMIT_WINDOW_MINUTES = 15
const MAX_ATTEMPTS = 5

// Create admin client for server-side operations
function getAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase configuration missing')
    }

    return createClient(supabaseUrl, supabaseServiceKey)
}

// Database-backed rate limiting (works with serverless)
async function checkRateLimit(
    supabase: ReturnType<typeof getAdminClient>,
    identifier: string,
    type: 'ip' | 'restaurant'
): Promise<{ allowed: boolean; remainingAttempts: number; retryAfter?: number }> {
    try {
        // Check rate limit using database function
        const { data, error } = await supabase.rpc('check_otp_rate_limit', {
            p_identifier: identifier,
            p_identifier_type: type,
            p_max_requests: MAX_ATTEMPTS,
            p_window_minutes: RATE_LIMIT_WINDOW_MINUTES
        })

        if (error) {
            console.error('Rate limit check error:', error)
            // Fail open but log the error
            return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 }
        }

        if (data && data.length > 0) {
            const result = data[0]
            return {
                allowed: result.allowed,
                remainingAttempts: result.remaining_requests,
                retryAfter: result.retry_after_seconds > 0 ? result.retry_after_seconds : undefined
            }
        }

        return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 }
    } catch (err) {
        console.error('Rate limit error:', err)
        return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 }
    }
}

// Reset rate limit on successful login (optional, could keep for audit)
async function resetRateLimit(
    supabase: ReturnType<typeof getAdminClient>,
    identifier: string,
    type: 'ip' | 'restaurant'
): Promise<void> {
    try {
        await supabase
            .from('otp_rate_limits')
            .delete()
            .eq('identifier', identifier)
            .eq('identifier_type', type)
    } catch (err) {
        // Non-critical, just log
        console.error('Rate limit reset error:', err)
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = getAdminClient()

        const { restaurantSlug, pin } = await request.json()

        if (!restaurantSlug || !pin) {
            return NextResponse.json(
                { success: false, error: 'Restaurant code and PIN are required' },
                { status: 400 }
            )
        }

        // Validate PIN format (4-6 digits)
        if (!/^\d{4,6}$/.test(pin)) {
            return NextResponse.json(
                { success: false, error: 'Invalid PIN format' },
                { status: 400 }
            )
        }

        // Get client IP
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            'unknown'

        // Check rate limit by IP first
        const ipRateCheck = await checkRateLimit(supabase, ip, 'ip')
        if (!ipRateCheck.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Too many login attempts from your network. Please try again in ${Math.ceil((ipRateCheck.retryAfter || 60) / 60)} minutes.`,
                    retryAfter: ipRateCheck.retryAfter
                },
                { status: 429 }
            )
        }

        // Check rate limit by restaurant slug
        const restaurantRateCheck = await checkRateLimit(supabase, restaurantSlug, 'restaurant')
        if (!restaurantRateCheck.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Too many login attempts for this facility. Please try again in ${Math.ceil((restaurantRateCheck.retryAfter || 60) / 60)} minutes.`,
                    retryAfter: restaurantRateCheck.retryAfter
                },
                { status: 429 }
            )
        }

        // Find restaurant by slug
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('id, name, slug, logo_url, currency, tax_rate, settings, is_active')
            .eq('slug', restaurantSlug.toLowerCase())
            .single()

        if (restaurantError || !restaurant) {
            return NextResponse.json(
                { success: false, error: 'Facility not found. Check the facility code.' },
                { status: 404 }
            )
        }

        if (!restaurant.is_active) {
            return NextResponse.json(
                { success: false, error: 'This facility is currently inactive.' },
                { status: 403 }
            )
        }

        // Find all active staff for this restaurant
        const { data: staffList, error: staffError } = await supabase
            .from('staff')
            .select('id, restaurant_id, user_id, name, email, pin, role, is_active, created_at')
            .eq('restaurant_id', restaurant.id)
            .eq('is_active', true)

        if (staffError || !staffList || staffList.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No active staff members found for this facility.' },
                { status: 404 }
            )
        }

        // Try to match PIN with each staff member
        let matchedStaff = null

        for (const staff of staffList) {
            if (!staff.pin) continue

            // Check if PIN is hashed (bcrypt hashes start with $2)
            if (staff.pin.startsWith('$2')) {
                try {
                    const isMatch = await bcrypt.compare(pin, staff.pin)
                    if (isMatch) {
                        matchedStaff = staff
                        break
                    }
                } catch (err) {
                    // Invalid hash format, skip
                    continue
                }
            } else {
                // Plain text comparison (legacy - should be migrated)
                // This is intentionally kept for backward compatibility during migration
                if (staff.pin === pin) {
                    matchedStaff = staff

                    // Auto-migrate: Hash the PIN for future logins
                    const hashedPin = await bcrypt.hash(pin, 10)
                    await supabase
                        .from('staff')
                        .update({ pin: hashedPin })
                        .eq('id', staff.id)

                    break
                }
            }
        }

        if (!matchedStaff) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid PIN.',
                    remainingAttempts: Math.min(ipRateCheck.remainingAttempts, restaurantRateCheck.remainingAttempts)
                },
                { status: 401 }
            )
        }

        // Success - reset rate limits
        await Promise.all([
            resetRateLimit(supabase, ip, 'ip'),
            resetRateLimit(supabase, restaurantSlug, 'restaurant')
        ])

        // Remove sensitive data before returning
        const { pin: _, ...safeStaff } = matchedStaff

        return NextResponse.json({
            success: true,
            staff: safeStaff,
            restaurant: {
                id: restaurant.id,
                name: restaurant.name,
                slug: restaurant.slug,
                logo_url: restaurant.logo_url,
                currency: restaurant.currency,
                tax_rate: restaurant.tax_rate,
                settings: restaurant.settings,
            }
        })

    } catch (error) {
        console.error('Staff login error:', error)
        return NextResponse.json(
            { success: false, error: 'An unexpected error occurred. Please try again.' },
            { status: 500 }
        )
    }
}
