import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
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

        const rateResult = checkRateLimit(rateLimitKey, VERIFY_RATE_CONFIG)
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

        let isValidCode = false
        if (otpRecord.code.startsWith('$2')) {
            isValidCode = await bcrypt.compare(code, otpRecord.code)
        } else {
            const hashedLegacy = await bcrypt.hash(code, 12)
            isValidCode = await bcrypt.compare(code, hashedLegacy) || otpRecord.code === code
            if (isValidCode && !otpRecord.code.startsWith('$2')) {
                console.warn(`[VERIFY_OTP] Legacy plain-text OTP detected for ${email.slice(0, 3)}*** - auto-migrating to bcrypt`)
                await supabase
                    .from('otp_codes')
                    .update({ code: await bcrypt.hash(code, 12) })
                    .eq('id', otpRecord.id)
            }
        }

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

        await supabase
            .from('otp_codes')
            .update({ verified: true })
            .eq('id', otpRecord.id)

        const { data: usersData } = await supabase.auth.admin.listUsers()
        const verifiedUser = usersData?.users?.find(u => u.email?.toLowerCase() === email)

        if (verifiedUser) {
            await supabase.auth.admin.updateUserById(verifiedUser.id, {
                email_confirm: true,
            })
        }

        await supabase.from('otp_codes').delete().eq('email', email)

        await logAuthEvent(createAuditEvent('otp_verified', email, clientIp, { userId: verifiedUser?.id }))

        return NextResponse.json({
            success: true,
            message: 'Email verified successfully',
            verified: true,
            userId: verifiedUser?.id || null,
            email,
        })
    } catch (error: unknown) {
        console.error('[VERIFY_OTP] Error:', error instanceof Error ? error.message : 'Unknown error')
        return NextResponse.json(
            { error: sanitizeErrorMessage(error) },
            { status: 500 }
        )
    }
}