import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import {
    sanitizeEmail,
    validatePin,
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

const EMAIL_RATE_CONFIG = {
    maxRequests: AUTH_CONSTANTS.PIN_MAX_ATTEMPTS_PER_IDENTIFIER,
    windowMs: AUTH_CONSTANTS.PIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    lockoutDurationMs: AUTH_CONSTANTS.LOCKOUT_DURATION_MINUTES * 60 * 1000,
}

const IP_RATE_CONFIG = {
    maxRequests: AUTH_CONSTANTS.PIN_MAX_ATTEMPTS_PER_IP,
    windowMs: AUTH_CONSTANTS.PIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
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

        const { email: rawEmail, pin: rawPin, setupPin, profileData } = body as Record<string, unknown>
        const email = sanitizeEmail(rawEmail)
        const pin = typeof rawPin === 'string' ? rawPin.trim() : ''
        const setupPinStr = typeof setupPin === 'string' ? setupPin.trim() : ''

        if (!email) {
            return NextResponse.json(
                { success: false, error: 'A valid email address is required' },
                { status: 400 }
            )
        }

        if (!pin) {
            return NextResponse.json(
                { success: false, error: 'PIN is required' },
                { status: 400 }
            )
        }

        const clientIp = getClientIp(request)
        const fingerprint = getClientFingerprint(request)

        const emailRateResult = await checkRateLimitPersistent(`staff_email:email:${email}`, EMAIL_RATE_CONFIG)
        if (!emailRateResult.allowed) {
            await logAuthEvent(createAuditEvent('rate_limit_exceeded', email, clientIp, { type: 'staff_email_email' }))
            return NextResponse.json(
                {
                    success: false,
                    error: `Too many login attempts. Please try again in ${Math.ceil(emailRateResult.retryAfterMs / 60000)} minutes.`,
                    retryAfter: Math.ceil(emailRateResult.retryAfterMs / 1000),
                },
                { status: 429, headers: getRateLimitHeaders(emailRateResult, EMAIL_RATE_CONFIG) }
            )
        }

        const ipRateResult = await checkRateLimitPersistent(`staff_email:ip:${clientIp}`, IP_RATE_CONFIG)
        if (!ipRateResult.allowed) {
            await logAuthEvent(createAuditEvent('rate_limit_exceeded', clientIp, clientIp, { type: 'staff_email_ip' }))
            return NextResponse.json(
                { success: false, error: 'Too many requests from your network. Please try again later.' },
                { status: 429, headers: getRateLimitHeaders(ipRateResult, IP_RATE_CONFIG) }
            )
        }

        let { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('id, name, email, role, restaurant_id, is_active, pin, temp_pin, phone, avatar_url, created_at')
            .eq('email', email)
            .maybeSingle()

        if (!staff && !staffError) {
            const result = await supabase
                .from('staff')
                .select('id, name, email, role, restaurant_id, is_active, pin, temp_pin, phone, avatar_url, created_at')
                .ilike('email', email)
                .maybeSingle()
            staff = result.data
        }

        if (!staff) {
            await logAuthEvent(createAuditEvent('staff_login_failure', email, clientIp, { reason: 'not_found', fingerprint }))
            return NextResponse.json(
                { success: false, error: 'No active staff account found with this email' },
                { status: 404 }
            )
        }

        if (staff.is_active === false) {
            await logAuthEvent(createAuditEvent('staff_login_failure', email, clientIp, { reason: 'inactive' }))
            return NextResponse.json(
                { success: false, error: 'This staff account is inactive' },
                { status: 403 }
            )
        }

        // Temp-PIN flow for invites, and for resets when the 6-digit temp PIN is entered; a 4-digit PIN uses the normal path.
        const needsSetup = !!staff.temp_pin && (!staff.pin || String(pin ?? '').length === 6)

        if (needsSetup) {
            const validatedTempPin = validatePin(pin, 6, 6)
            if (!validatedTempPin) {
                return NextResponse.json(
                    { success: false, error: 'Temporary PIN must be exactly 6 digits' },
                    { status: 400 }
                )
            }

            let tempPinValid = false
            if (staff.temp_pin.startsWith('$2')) {
                tempPinValid = await bcrypt.compare(validatedTempPin, staff.temp_pin)
            } else {
                tempPinValid = staff.temp_pin === validatedTempPin
            }

            if (!tempPinValid) {
                await logAuthEvent(createAuditEvent('staff_login_failure', email, clientIp, { reason: 'invalid_temp_pin', fingerprint }))
                return NextResponse.json(
                    { success: false, error: 'Invalid temporary PIN. Check your email for the 6-digit code.' },
                    { status: 401 }
                )
            }

            if (setupPinStr) {
                const validatedSetupPin = validatePin(setupPinStr, 4, 4)
                if (!validatedSetupPin) {
                    return NextResponse.json(
                        { success: false, error: 'Permanent PIN must be exactly 4 digits' },
                        { status: 400 }
                    )
                }

                const hashedPin = await bcrypt.hash(validatedSetupPin, AUTH_CONSTANTS.PIN_BCRYPT_ROUNDS)

                const updateData: Record<string, unknown> = {
                    pin: hashedPin,
                    temp_pin: null,
                    is_active: true,
                    setup_completed_at: new Date().toISOString(),
                }

                if (profileData && typeof profileData === 'object') {
                    const pd = profileData as Record<string, unknown>
                    if (typeof pd.name === 'string' && pd.name.trim()) updateData.name = pd.name.trim()
                    if (typeof pd.phone === 'string' && pd.phone.trim()) {
                        updateData.phone = pd.phone.trim().replace(/\s/g, '').slice(-15)
                    }
                    if (typeof pd.avatar_url === 'string') updateData.avatar_url = pd.avatar_url
                }

                const { error: updateError } = await supabase
                    .from('staff')
                    .update(updateData)
                    .eq('id', staff.id)

                if (updateError) {
                    console.error('[STAFF_EMAIL_LOGIN] Setup update error:', updateError.message)
                    return NextResponse.json(
                        { success: false, error: 'Failed to complete setup. Please try again.' },
                        { status: 500 }
                    )
                }

                const { data: restaurant } = await supabase
                    .from('restaurants')
                    .select('id, name, slug, logo_url, currency, tax_rate, settings')
                    .eq('id', staff.restaurant_id)
                    .single()

                await logAuthEvent(createAuditEvent('staff_login', email, clientIp, {
                    staffId: staff.id,
                    role: staff.role,
                    action: 'setup_completed',
                    fingerprint,
                }))

                const { pin: _, temp_pin: __, ...safeStaff } = staff

                return await jsonWithStaffSession({
                    success: true,
                    needsSetup: false,
                    justSetup: true,
                    profileCompleted: !!profileData,
                    staff: {
                        ...safeStaff,
                        name: (profileData as Record<string, unknown>)?.name || staff.name,
                        phone: (profileData as Record<string, unknown>)?.phone || staff.phone,
                        avatar_url: (profileData as Record<string, unknown>)?.avatar_url || staff.avatar_url,
                    },
                    restaurant,
                }, {
                    staffId: staff.id,
                    restaurantId: staff.restaurant_id,
                    role: staff.role as UserRole,
                })
            }

            await resetRateLimitPersistent(`staff_email:email:${email}`)

            return NextResponse.json({
                success: true,
                needsSetup: true,
                verified: true,
                needsProfileUpdate: !staff.phone || staff.phone === '',
                staff: {
                    id: staff.id,
                    name: staff.name,
                    email: staff.email,
                    role: staff.role,
                    restaurant_id: staff.restaurant_id,
                },
                message: 'Temporary PIN verified. Now set up your 4-digit permanent PIN.',
            })
        }

        const validatedPin = validatePin(pin, 4, 4)
        if (!validatedPin) {
            return NextResponse.json(
                { success: false, error: 'PIN must be exactly 4 digits' },
                { status: 400 }
            )
        }

        let pinValid = false
        if (staff.pin) {
            if (staff.pin.startsWith('$2')) {
                pinValid = await bcrypt.compare(validatedPin, staff.pin)
            } else {
                pinValid = staff.pin === validatedPin
                if (pinValid) {
                    const hashedPin = await bcrypt.hash(validatedPin, AUTH_CONSTANTS.PIN_BCRYPT_ROUNDS)
                    await supabase
                        .from('staff')
                        .update({ pin: hashedPin })
                        .eq('id', staff.id)
                }
            }
        }

        if (!pinValid) {
            await logAuthEvent(createAuditEvent('staff_login_failure', email, clientIp, { reason: 'invalid_pin', fingerprint }))
            return NextResponse.json(
                { success: false, error: 'Invalid PIN. Use your 4-digit permanent code.' },
                { status: 401 }
            )
        }

        await resetRateLimitPersistent(`staff_email:email:${email}`)

        // Update last login timestamp
        // Signing in with the real PIN cancels any pending (possibly attacker-requested) reset.
        await supabase
            .from('staff')
            .update({ last_login_at: new Date().toISOString(), ...(staff.temp_pin ? { temp_pin: null } : {}) })
            .eq('id', staff.id)

        const { data: restaurant } = await supabase
            .from('restaurants')
            .select('id, name, slug, logo_url, currency, tax_rate, settings, owner_id')
            .eq('id', staff.restaurant_id)
            .single()

        let ownerName = 'Owner'
        if (restaurant?.owner_id) {
            const { data: ownerData } = await supabase
                .from('staff')
                .select('name')
                .eq('restaurant_id', staff.restaurant_id)
                .eq('role', 'owner')
                .maybeSingle()
            if (ownerData) ownerName = ownerData.name
        }

        await logAuthEvent(createAuditEvent('staff_login', email, clientIp, {
            staffId: staff.id,
            role: staff.role,
            fingerprint,
        }))

        const { pin: _, temp_pin: __, ...safeStaff } = staff

        return await jsonWithStaffSession({
            success: true,
            needsSetup: false,
            justSetup: false,
            staff: safeStaff,
            restaurant: {
                ...restaurant,
                owner_name: ownerName,
            },
        }, {
            staffId: staff.id,
            restaurantId: staff.restaurant_id,
            role: staff.role as UserRole,
        })
    } catch (error: unknown) {
        console.error('[STAFF_EMAIL_LOGIN] Error:', error instanceof Error ? error.message : 'Unknown error')
        return NextResponse.json(
            { success: false, error: sanitizeErrorMessage(error) },
            { status: 500 }
        )
    }
}