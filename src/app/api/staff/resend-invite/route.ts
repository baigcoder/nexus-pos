import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTempPin } from '@/lib/pin-utils'
import { sendStaffInviteEmail } from '@/lib/email'
import { requireOwner } from '@/lib/api-auth'
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

const RESEND_RATE_CONFIG = {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
}

function getAppUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export async function POST(request: NextRequest) {
    try {
        const { auth, response } = await requireOwner()(request)
        if (response) return response

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

        const { staffId, restaurantId } = body as Record<string, unknown>

        if (typeof staffId !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Staff ID is required' },
                { status: 400 }
            )
        }

        if (typeof restaurantId !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Restaurant ID is required' },
                { status: 400 }
            )
        }

        // --- Rate limiting ---
        const clientIp = getClientIp(request)
        const rateResult = checkRateLimit(`staff_resend:${clientIp}`, RESEND_RATE_CONFIG)
        if (!rateResult.allowed) {
            return NextResponse.json(
                { success: false, error: 'Too many resend requests. Please try again later.' },
                { status: 429, headers: getRateLimitHeaders(rateResult, RESEND_RATE_CONFIG) }
            )
        }

        // --- Fetch staff member ---
        const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('id, name, email, role, restaurant_id, needs_setup, is_active, is_archived')
            .eq('id', staffId)
            .eq('restaurant_id', restaurantId)
            .single()

        if (staffError || !staff) {
            return NextResponse.json(
                { success: false, error: 'Staff member not found' },
                { status: 404 }
            )
        }

        if (staff.is_archived) {
            return NextResponse.json(
                { success: false, error: 'Cannot resend invite to archived staff' },
                { status: 400 }
            )
        }

        if (!staff.is_active) {
            return NextResponse.json(
                { success: false, error: 'Cannot resend invite to inactive staff' },
                { status: 400 }
            )
        }

        if (!staff.needs_setup) {
            return NextResponse.json(
                { success: false, error: 'Staff has already completed setup' },
                { status: 400 }
            )
        }

        const email = sanitizeEmail(staff.email)
        if (!email) {
            return NextResponse.json(
                { success: false, error: 'Staff has no valid email address' },
                { status: 400 }
            )
        }

        // --- Get restaurant name ---
        const { data: restaurant } = await supabase
            .from('restaurants')
            .select('id, name')
            .eq('id', restaurantId)
            .single()

        // --- Generate new PIN ---
        const tempPin = generateTempPin()
        const hashedTempPin = await bcrypt.hash(tempPin, AUTH_CONSTANTS.PIN_BCRYPT_ROUNDS)

        // --- Update staff record ---
        const { error: updateError } = await supabase
            .from('staff')
            .update({
                temp_pin: hashedTempPin,
                pin: null,
                invited_at: new Date().toISOString(),
            })
            .eq('id', staffId)

        if (updateError) {
            console.error('[STAFF_RESEND] Update error:', updateError.message)
            return NextResponse.json(
                { success: false, error: 'Failed to update staff record' },
                { status: 500 }
            )
        }

        // --- Send email ---
        let emailSent = false
        try {
            await sendStaffInviteEmail({
                email,
                name: staff.name,
                restaurantName: restaurant?.name || 'Your Restaurant',
                tempPin,
                loginUrl: `${getAppUrl()}/staff-login`,
                role: staff.role,
            })
            emailSent = true
        } catch (err: unknown) {
            console.error('[STAFF_RESEND] Email send failed:', err instanceof Error ? err.message : 'Unknown error')
        }

        await logAuthEvent(createAuditEvent('staff_setup', email, clientIp, {
            action: 'invite_resent',
            staffId: staff.id,
            role: staff.role,
            emailSent,
        }))

        return NextResponse.json({
            success: true,
            message: `Invitation resent to ${staff.name}.${emailSent ? ' Email delivered.' : ' Email failed — share PIN manually.'}`,
            emailSent,
        })

    } catch (error: unknown) {
        console.error('[STAFF_RESEND] Error:', error instanceof Error ? error.message : 'Unknown error')
        return NextResponse.json(
            { success: false, error: sanitizeErrorMessage(error) },
            { status: 500 }
        )
    }
}
