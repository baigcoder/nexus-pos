import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
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

const { OTP_MAX_ATTEMPTS, OTP_RATE_LIMIT_WINDOW_MINUTES } = AUTH_CONSTANTS

const VERIFY_RATE_CONFIG = {
    maxRequests: 10,
    windowMs: OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient()

        let body: unknown
        try {
            body = await request.json()
        } catch {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            )
        }

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { email: rawEmail, code: rawCode } = body as Record<string, unknown>
        const email = sanitizeEmail(rawEmail)
        const code = typeof rawCode === 'string' ? rawCode.trim() : ''

        if (!email) {
            return NextResponse.json(
                { error: 'A valid email address is required' },
                { status: 400 }
            )
        }

        if (!/^\d{6}$/.test(code)) {
            return NextResponse.json(
                { error: 'Invalid verification code format' },
                { status: 400 }
            )
        }

        const clientIp = getClientIp(request)
        const rateLimitKey = `otp_verify:${clientIp}`

        const rateResult = await checkRateLimitPersistent(rateLimitKey, VERIFY_RATE_CONFIG)
        if (!rateResult.allowed) {
            return NextResponse.json(
                { error: 'Too many verification attempts. Please try again later.' },
                { status: 429, headers: getRateLimitHeaders(rateResult, VERIFY_RATE_CONFIG) }
            )
        }

        const { data: otpRecord, error: fetchError } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('email', email)
            .eq('verified', false)
            .single()

        if (fetchError || !otpRecord) {
            return NextResponse.json(
                { error: 'No pending verification code found. Please request a new one.' },
                { status: 400 }
            )
        }

        if (new Date(otpRecord.expires_at) < new Date()) {
            await supabase.from('otp_codes').delete().eq('id', otpRecord.id)
            return NextResponse.json(
                { error: 'Verification code has expired. Please request a new one.' },
                { status: 400 }
            )
        }

        const currentAttempts = otpRecord.attempts || 0
        if (currentAttempts >= OTP_MAX_ATTEMPTS) {
            await supabase.from('otp_codes').delete().eq('id', otpRecord.id)
            await logAuthEvent(createAuditEvent('otp_failed', email, clientIp, { reason: 'max_attempts_exceeded' }))
            return NextResponse.json(
                { error: 'Too many failed attempts. Please request a new verification code.' },
                { status: 400 }
            )
        }

        if (typeof otpRecord.code !== 'string' || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(otpRecord.code)) {
            return NextResponse.json({ error: 'Please request a new verification code.' }, { status: 400 })
        }
        const isValidCode = await bcrypt.compare(code, otpRecord.code)

        if (!isValidCode) {
            const newAttempts = currentAttempts + 1
            await supabase
                .from('otp_codes')
                .update({ attempts: newAttempts })
                .eq('id', otpRecord.id)

            const remainingAttempts = OTP_MAX_ATTEMPTS - newAttempts

            await logAuthEvent(createAuditEvent('otp_failed', email, clientIp, {
                reason: 'invalid_code',
                attempts: newAttempts,
                remaining: remainingAttempts,
            }))

            if (remainingAttempts <= 0) {
                await supabase.from('otp_codes').delete().eq('id', otpRecord.id)
                return NextResponse.json(
                    { error: 'Too many failed attempts. Please request a new verification code.' },
                    { status: 400 }
                )
            }

            return NextResponse.json(
                { error: 'Invalid verification code', remainingAttempts },
                { status: 400 }
            )
        }

        const { data: userId, error: lookupError } = await supabase.rpc('find_signup_user_by_email', { p_email: email })
        if (lookupError) throw lookupError
        if (!userId) {
            return NextResponse.json({ error: 'Could not verify this signup. Please register again.' }, { status: 400 })
        }

        const { data: claimed, error: claimError } = await supabase
            .from('otp_codes')
            .update({ verified: true })
            .eq('id', otpRecord.id)
            .eq('verified', false)
            .gt('expires_at', new Date().toISOString())
            .select('id')
            .maybeSingle()
        if (claimError) throw claimError
        if (!claimed) {
            return NextResponse.json({ error: 'Verification code is no longer available.' }, { status: 409 })
        }

        const { error: confirmError } = await supabase.auth.admin.updateUserById(userId, { email_confirm: true })
        if (confirmError) {
            await supabase.from('otp_codes').update({ verified: false }).eq('id', otpRecord.id)
            throw confirmError
        }

        await supabase.from('otp_codes').delete().eq('id', otpRecord.id)
        await logAuthEvent(createAuditEvent('otp_verified', email, clientIp, { userId }))

        return NextResponse.json({
            success: true,
            message: 'Email verified successfully',
            verified: true,
        })
    } catch (error: unknown) {
        console.error('[VERIFY_OTP] Error:', error instanceof Error ? error.message : 'Unknown error')
        return NextResponse.json(
            { error: sanitizeErrorMessage(error) },
            { status: 500 }
        )
    }
}