import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTempPin } from '@/lib/pin-utils'
import { sendPinResetEmail } from '@/lib/email'
import {
    sanitizeEmail,
    getClientIp,
    sanitizeErrorMessage,
    createAuditEvent,
    logAuthEvent,
    checkRateLimitPersistent,
    getRateLimitHeaders,
    AUTH_CONSTANTS,
} from '@/lib/auth'

const FORGOT_RATE_CONFIG = {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
}

function getAppUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
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

        const { email: rawEmail } = body as Record<string, unknown>
        const email = sanitizeEmail(rawEmail)

        if (!email) {
            return NextResponse.json(
                { success: false, error: 'A valid email address is required' },
                { status: 400 }
            )
        }

        const clientIp = getClientIp(request)

        const rateResult = await checkRateLimitPersistent(`forgot_pin:${email}`, FORGOT_RATE_CONFIG)
        if (!rateResult.allowed) {
            return NextResponse.json(
                { success: false, error: 'Too many reset requests. Please try again later.' },
                { status: 429, headers: getRateLimitHeaders(rateResult, FORGOT_RATE_CONFIG) }
            )
        }

        // Find staff member
        const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('id, name, email, role, restaurant_id, is_active, is_archived')
            .eq('email', email)
            .maybeSingle()

        // Same reply whether or not the email exists, so this endpoint can't be used to list staff emails.
        if (staffError || !staff || !staff.is_active || staff.is_archived) {
            return NextResponse.json({ success: true, message: 'If a staff account exists for this email, a reset PIN has been sent.', emailSent: false })
        }

        // Get restaurant name
        const { data: restaurant } = await supabase
            .from('restaurants')
            .select('id, name')
            .eq('id', staff.restaurant_id)
            .single()

        // Generate new temp PIN
        const tempPin = generateTempPin()
        const hashedTempPin = await bcrypt.hash(tempPin, AUTH_CONSTANTS.PIN_BCRYPT_ROUNDS)

        // Keep the current PIN working until the temp PIN is used: anyone can request a reset for any
        // email, so wiping the PIN here let an attacker lock staff out. Signing in with the old PIN cancels it.
        const { error: updateError } = await supabase
            .from('staff')
            .update({
                temp_pin: hashedTempPin,
                invited_at: new Date().toISOString(),
            })
            .eq('id', staff.id)

        if (updateError) {
            console.error('[FORGOT_PIN] Update error:', updateError.message)
            return NextResponse.json(
                { success: false, error: 'Failed to reset PIN. Please try again.' },
                { status: 500 }
            )
        }

        // Send email
        let emailSent = false
        try {
            await sendPinResetEmail({
                email,
                name: staff.name,
                restaurantName: restaurant?.name || 'Your Restaurant',
                tempPin,
                loginUrl: `${getAppUrl()}/staff-login`,
            })
            emailSent = true
        } catch (err: unknown) {
            console.error('[FORGOT_PIN] Email send failed:', err instanceof Error ? err.message : 'Unknown error')
        }

        await logAuthEvent(createAuditEvent('staff_setup', email, clientIp, {
            action: 'pin_reset_requested',
            staffId: staff.id,
            emailSent,
        }))

        return NextResponse.json({
            success: true,
            message: 'If a staff account exists for this email, a reset PIN has been sent.',
            emailSent,
        })

    } catch (error: unknown) {
        console.error('[FORGOT_PIN] Error:', error instanceof Error ? error.message : 'Unknown error')
        return NextResponse.json(
            { success: false, error: sanitizeErrorMessage(error) },
            { status: 500 }
        )
    }
}
