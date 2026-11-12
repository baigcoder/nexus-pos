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
    checkRateLimit,
    getRateLimitHeaders,
    resetRateLimit,
    AUTH_CONSTANTS,
} from '@/lib/auth'
import { setStaffSessionCookie } from '@/lib/auth/staff-session'

const SETUP_RATE_CONFIG = {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    lockoutDurationMs: 30 * 60 * 1000,
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

        const { email: rawEmail, tempPin, newPin: rawNewPin, phone: rawPhone } = body as Record<string, unknown>
        const email = sanitizeEmail(rawEmail)
        const newPin = validatePin(rawNewPin as string, 4, 4)

        if (!email) {
            return NextResponse.json(
                { success: false, error: 'A valid email address is required' },
                { status: 400 }
            )
        }

        if (!tempPin || typeof tempPin !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Temporary PIN is required' },
                { status: 400 }
            )
        }

        if (!newPin) {
            return NextResponse.json(
                { success: false, error: 'New PIN must be exactly 4 digits' },
                { status: 400 }
            )
        }

        const clientIp = getClientIp(request)

        const rateResult = checkRateLimit(`staff_setup:${email}`, SETUP_RATE_CONFIG)
        if (!rateResult.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Too many setup attempts. Please try again in ${Math.ceil(rateResult.retryAfterMs / 60000)} minutes.`,
                    retryAfter: Math.ceil(rateResult.retryAfterMs / 1000),
                },
                { status: 429, headers: getRateLimitHeaders(rateResult, SETUP_RATE_CONFIG) }
            )
        }

        const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('*, restaurants(*)')
            .eq('email', email)
            .eq('is_active', true)
            .single()

        if (staffError || !staff) {
            return NextResponse.json(
                { success: false, error: 'Staff member not found' },
                { status: 404 }
            )
        }

        let tempPinValid = false
        if (staff.temp_pin) {
            if (staff.temp_pin.startsWith('$2')) {
                tempPinValid = await bcrypt.compare(tempPin, staff.temp_pin)
            } else if (tempPin === 'CHANGE' && staff.pin) {
                tempPinValid = staff.pin.startsWith('$2')
                    ? await bcrypt.compare(newPin, staff.pin).then(() => false).catch(() => false)
                    : false
                const { data: verifyData } = await supabase
                    .from('staff')
                    .select('pin')
                    .eq('id', staff.id)
                    .single()
                if (verifyData?.pin) {
                    tempPinValid = verifyData.pin.startsWith('$2')
                        ? await bcrypt.compare(tempPin.replace('CHANGE', ''), verifyData.pin).catch(() => false) as boolean
                        : false
                }
            } else {
                tempPinValid = staff.temp_pin === tempPin
            }
        }

        if (!tempPinValid) {
            if (tempPin !== 'CHANGE') {
                await logAuthEvent(createAuditEvent('staff_login_failure', email, clientIp, { reason: 'invalid_temp_pin' }))
            }
            return NextResponse.json(
                { success: false, error: 'Invalid temporary PIN' },
                { status: 401 }
            )
        }

        let cleanPhone: string | null = null
        if (typeof rawPhone === 'string' && rawPhone.trim()) {
            cleanPhone = rawPhone.trim().replace(/\s/g, '')
            if (cleanPhone.length > 20) cleanPhone = cleanPhone.slice(-15)
        }

        const setupCompletedAt = new Date().toISOString()
        const hashedPin = await bcrypt.hash(newPin, AUTH_CONSTANTS.PIN_BCRYPT_ROUNDS)

        let updateError: { message?: string } | null = null

        const hashedUpdate = await supabase
            .from('staff')
            .update({
                pin: hashedPin,
                phone: cleanPhone,
                needs_setup: false,
                temp_pin: null,
                setup_completed_at: setupCompletedAt,
            })
            .eq('id', staff.id)

        updateError = hashedUpdate.error

        if (updateError) {
            console.error('[STAFF_SETUP] Update error:', updateError.message)
            return NextResponse.json(
                { success: false, error: 'Failed to complete setup' },
                { status: 500 }
            )
        }

        resetRateLimit(`staff_setup:${email}`)

        await logAuthEvent(createAuditEvent('staff_setup', email, clientIp, { staffId: staff.id }))

        const { pin, temp_pin, ...safeStaff } = staff

        return setStaffSessionCookie(NextResponse.json({
            success: true,
            staff: {
                ...safeStaff,
                needs_setup: false,
            },
            restaurant: staff.restaurants,
            message: 'Setup completed successfully!',
        }), staff.id)
    } catch (error: unknown) {
        console.error('[STAFF_SETUP] Error:', error instanceof Error ? error.message : 'Unknown error')
        return NextResponse.json(
            { success: false, error: sanitizeErrorMessage(error) },
            { status: 500 }
        )
    }
}