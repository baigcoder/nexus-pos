import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

const CHECK_RATE_CONFIG = {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
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

        const rateResult = await checkRateLimitPersistent(`staff_check:${clientIp}`, CHECK_RATE_CONFIG)
        if (!rateResult.allowed) {
            return NextResponse.json(
                { success: false, error: 'Too many requests. Please try again later.' },
                { status: 429, headers: getRateLimitHeaders(rateResult, CHECK_RATE_CONFIG) }
            )
        }

        let { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('id, name, email, role, is_active, temp_pin, pin')
            .eq('email', email)
            .maybeSingle()

        if (!staff && !staffError) {
            const result = await supabase
                .from('staff')
                .select('id, name, email, role, is_active, temp_pin, pin')
                .ilike('email', email)
                .maybeSingle()
            staff = result.data
        }

        if (!staff || staff.is_active === false) {
            return NextResponse.json(
                { success: false, error: 'No active staff account found with this email' },
                { status: 404 }
            )
        }

        // A pending temp PIN (invite or reset) routes to the temp-PIN step; has_pin lets a reset user keep their old PIN.
        const needsSetup = !!staff.temp_pin
        const pinLength = needsSetup ? AUTH_CONSTANTS.TEMP_PIN_LENGTH : AUTH_CONSTANTS.PIN_LENGTH

        await logAuthEvent(createAuditEvent('login_success', email, clientIp, {
            action: 'staff_check',
            needsSetup,
        }))

        return NextResponse.json({
            success: true,
            staff: {
                id: staff.id,
                name: staff.name,
                email: staff.email,
                role: staff.role,
                needs_setup: needsSetup,
                has_pin: !!staff.pin,
                pin_length: pinLength,
            },
            message: needsSetup
                ? 'First-time login: Enter 6-digit temporary PIN from your email'
                : 'Enter your 4-digit permanent PIN',
        })
    } catch (error: unknown) {
        console.error('[STAFF_CHECK] Error:', error instanceof Error ? error.message : 'Unknown error')
        return NextResponse.json(
            { success: false, error: sanitizeErrorMessage(error) },
            { status: 500 }
        )
    }
}