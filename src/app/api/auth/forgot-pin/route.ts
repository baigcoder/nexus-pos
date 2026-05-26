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
    checkRateLimit,
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

        const rateResult = checkRateLimit(`forgot_pin:${email}`, FORGOT_RATE_CONFIG)
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

        if (staffError || !staff) {
            return NextResponse.json(
                { success: false, error: 'No active staff account found with this email' },
                { status: 404 }
            )
        }

        if (!staff.is_active || staff.is_archived) {
            return NextResponse.json(
                { success: false, error: 'This account is inactive or archived' },
                { status: 403 }
            )
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

        // Update staff record — clear permanent PIN and set temp PIN
        const { error: updateError } = await supabase
            .from('staff')
            .update({
                temp_pin: hashedTempPin,
                pin: null,
                needs_setup: true,
                invited_at: new Date().toISOString(),
                setup_completed_at: null,
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
            message: emailSent
                ? 'Reset PIN sent to your email. Check your inbox.'
                : 'PIN reset processed. Ask your manager for the new PIN.',
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
