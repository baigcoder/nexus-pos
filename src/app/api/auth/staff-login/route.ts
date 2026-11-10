import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import {
    validatePin,
    validateSlug,
    getClientIp,
    sanitizeErrorMessage,
    createAuditEvent,
    logAuthEvent,
    getClientFingerprint,
    checkRateLimitPersistent,
    getRateLimitHeaders,
    resetRateLimitPersistent,
    AUTH_CONSTANTS,
} from '@/lib/auth'
import { jsonWithStaffSession } from '@/lib/staff-session'
import type { UserRole } from '@/types'

const {
    PIN_MAX_ATTEMPTS_PER_IP: MAX_IP_ATTEMPTS,
    PIN_MAX_ATTEMPTS_PER_IDENTIFIER: MAX_RESTAURANT_ATTEMPTS,
    PIN_RATE_LIMIT_WINDOW_MINUTES: RATE_LIMIT_WINDOW_MIN,
} = AUTH_CONSTANTS

const IP_RATE_CONFIG = {
    maxRequests: MAX_IP_ATTEMPTS,
    windowMs: RATE_LIMIT_WINDOW_MIN * 60 * 1000,
    lockoutDurationMs: RATE_LIMIT_WINDOW_MIN * 60 * 1000,
}

const RESTAURANT_RATE_CONFIG = {
    maxRequests: MAX_RESTAURANT_ATTEMPTS,
    windowMs: RATE_LIMIT_WINDOW_MIN * 60 * 1000,
}

function buildSafeStaffResponse(staff: Record<string, unknown>) {
    const { pin, temp_pin, ...safe } = staff
    return safe
}

export async function POST(request: NextRequest) {
    try {
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

        const { restaurantSlug: rawSlug, pin: rawPin } = body as Record<string, unknown>
        const restaurantSlug = validateSlug(rawSlug)
        const pin = validatePin(rawPin as string, 4, 6)

        if (!restaurantSlug) {
            return NextResponse.json(
                { success: false, error: 'Valid facility code is required' },
                { status: 400 }
            )
        }

        if (!pin) {
            return NextResponse.json(
                { success: false, error: 'PIN must be 4-6 digits' },
                { status: 400 }
            )
        }

        const clientIp = getClientIp(request)
        const fingerprint = getClientFingerprint(request)

        const ipRateResult = await checkRateLimitPersistent(`staff_login:ip:${clientIp}`, IP_RATE_CONFIG)
        if (!ipRateResult.allowed) {
            await logAuthEvent(createAuditEvent('rate_limit_exceeded', clientIp, clientIp, { type: 'staff_login_ip' }))
            return NextResponse.json(
                {
                    success: false,
                    error: `Too many login attempts from your network. Please try again in ${Math.ceil(ipRateResult.retryAfterMs / 60000)} minutes.`,
                    retryAfter: Math.ceil(ipRateResult.retryAfterMs / 1000),
                },
                { status: 429, headers: getRateLimitHeaders(ipRateResult, IP_RATE_CONFIG) }
            )
        }

        const restaurantRateResult = await checkRateLimitPersistent(`staff_login:restaurant:${restaurantSlug}`, RESTAURANT_RATE_CONFIG)
        if (!restaurantRateResult.allowed) {
            await logAuthEvent(createAuditEvent('rate_limit_exceeded', restaurantSlug, clientIp, { type: 'staff_login_restaurant' }))
            return NextResponse.json(
                {
                    success: false,
                    error: `Too many login attempts for this facility. Please try again in ${Math.ceil(restaurantRateResult.retryAfterMs / 60000)} minutes.`,
                    retryAfter: Math.ceil(restaurantRateResult.retryAfterMs / 1000),
                },
                { status: 429, headers: getRateLimitHeaders(restaurantRateResult, RESTAURANT_RATE_CONFIG) }
            )
        }

        let dbIpResult: { data?: any; error?: any } | null = null
        try {
            dbIpResult = await supabase.rpc('check_otp_rate_limit', {
                p_identifier: clientIp,
                p_identifier_type: 'ip',
                p_max_requests: MAX_IP_ATTEMPTS,
                p_window_minutes: RATE_LIMIT_WINDOW_MIN,
            })
        } catch {
            dbIpResult = null
        }

        if (dbIpResult?.data?.[0] && !dbIpResult.data[0].allowed) {
            return NextResponse.json(
                { success: false, error: 'Too many attempts. Please try again later.', retryAfter: dbIpResult.data[0].retry_after_seconds },
                { status: 429 }
            )
        }

        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('id, name, slug, logo_url, currency, tax_rate, settings, is_active')
            .eq('slug', restaurantSlug)
            .single()

        if (restaurantError || !restaurant) {
            await logAuthEvent(createAuditEvent('staff_login_failure', restaurantSlug, clientIp, { reason: 'restaurant_not_found' }))
            return NextResponse.json(
                { success: false, error: 'Facility not found. Check the facility code.' },
                { status: 404 }
            )
        }

        if (!restaurant.is_active) {
            await logAuthEvent(createAuditEvent('staff_login_failure', restaurantSlug, clientIp, { reason: 'restaurant_inactive' }))
            return NextResponse.json(
                { success: false, error: 'This facility is currently inactive.' },
                { status: 403 }
            )
        }

        const { data: staffList, error: staffError } = await supabase
            .from('staff')
            .select('id, restaurant_id, user_id, name, email, pin, role, is_active, created_at')
            .eq('restaurant_id', restaurant.id)
            .eq('is_active', true)

        if (staffError || !staffList || staffList.length === 0) {
            await logAuthEvent(createAuditEvent('staff_login_failure', restaurantSlug, clientIp, { reason: 'no_active_staff' }))
            return NextResponse.json(
                { success: false, error: 'No active staff members found for this facility.' },
                { status: 404 }
            )
        }

        let matchedStaff: Record<string, unknown> | null = null

        for (const staff of staffList) {
            if (!staff.pin) continue

            if (staff.pin.startsWith('$2')) {
                try {
                    const isMatch = await bcrypt.compare(pin, staff.pin)
                    if (isMatch) {
                        matchedStaff = staff
                        break
                    }
                } catch {
                    continue
                }
            } else {
                if (staff.pin === pin) {
                    matchedStaff = staff
                    const hashedPin = await bcrypt.hash(pin, AUTH_CONSTANTS.PIN_BCRYPT_ROUNDS)
                    await supabase
                        .from('staff')
                        .update({ pin: hashedPin })
                        .eq('id', staff.id)
                    break
                }
            }
        }

        if (!matchedStaff) {
            await logAuthEvent(createAuditEvent('staff_login_failure', restaurantSlug, clientIp, { reason: 'invalid_pin', fingerprint }))
            const remainingAttempts = Math.min(ipRateResult.remainingRequests, restaurantRateResult.remainingRequests)

            return NextResponse.json(
                { success: false, error: 'Invalid PIN.', remainingAttempts },
                { status: 401 }
            )
        }

        await resetRateLimitPersistent(`staff_login:ip:${clientIp}`)
        await resetRateLimitPersistent(`staff_login:restaurant:${restaurantSlug}`)

        await logAuthEvent(createAuditEvent('staff_login', (matchedStaff as Record<string, unknown>).email as string, clientIp, {
            staffId: matchedStaff.id as string,
            role: matchedStaff.role as string,
            restaurantSlug,
        }))

        const safeStaff = buildSafeStaffResponse(matchedStaff)

        return await jsonWithStaffSession({
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
            },
        }, {
            staffId: matchedStaff.id as string,
            restaurantId: restaurant.id,
            role: matchedStaff.role as UserRole,
        })
    } catch (error: unknown) {
        console.error('[STAFF_LOGIN] Error:', error instanceof Error ? error.message : 'Unknown error')
        return NextResponse.json(
            { success: false, error: sanitizeErrorMessage(error) },
            { status: 500 }
        )
    }
}