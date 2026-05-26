import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import {
    secureRandomDigits,
    sanitizeEmail,
    getClientIp,
    sanitizeErrorMessage,
    createAuditEvent,
    logAuthEvent,
    getClientFingerprint,
    checkRateLimit,
    getRateLimitHeaders,
    AUTH_CONSTANTS,
} from '@/lib/auth'

const { OTP_LENGTH, OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS, OTP_MAX_REQUESTS_PER_EMAIL, OTP_MAX_REQUESTS_PER_IP, OTP_RATE_LIMIT_WINDOW_MINUTES } = AUTH_CONSTANTS

const OTP_RATE_CONFIG = {
    maxRequests: OTP_MAX_REQUESTS_PER_EMAIL,
    windowMs: OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    lockoutDurationMs: OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
}

const IP_RATE_CONFIG = {
    maxRequests: OTP_MAX_REQUESTS_PER_IP,
    windowMs: OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    lockoutDurationMs: OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
}

function getSmtpConfig() {
    const user = process.env.SMTP_USER || process.env.SMTP_EMAIL
    const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD
    if (!user || !pass) return null
    return { user, pass }
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

        const rawEmail = (body as Record<string, unknown>).email
        const email = sanitizeEmail(rawEmail)
        if (!email) {
            return NextResponse.json(
                { error: 'A valid email address is required' },
                { status: 400 }
            )
        }

        const clientIp = getClientIp(request)
        const fingerprint = getClientFingerprint(request)
        const emailLimitKey = `otp:email:${email}`
        const ipLimitKey = `otp:ip:${clientIp}`

        const emailRateResult = checkRateLimit(emailLimitKey, OTP_RATE_CONFIG)
        if (!emailRateResult.allowed) {
            await logAuthEvent(createAuditEvent('rate_limit_exceeded', email, clientIp, { type: 'otp_email_limit' }))
            return NextResponse.json(
                {
                    error: `Too many verification requests. Please try again in ${Math.ceil(emailRateResult.retryAfterMs / 60000)} minutes.`,
                    retryAfter: Math.ceil(emailRateResult.retryAfterMs / 1000),
                },
                {
                    status: 429,
                    headers: getRateLimitHeaders(emailRateResult, OTP_RATE_CONFIG),
                }
            )
        }

        const ipRateResult = checkRateLimit(ipLimitKey, IP_RATE_CONFIG)
        if (!ipRateResult.allowed) {
            await logAuthEvent(createAuditEvent('rate_limit_exceeded', clientIp, clientIp, { type: 'otp_ip_limit' }))
            return NextResponse.json(
                {
                    error: 'Too many requests from your network. Please try again later.',
                    retryAfter: Math.ceil(ipRateResult.retryAfterMs / 1000),
                },
                {
                    status: 429,
                    headers: getRateLimitHeaders(ipRateResult, IP_RATE_CONFIG),
                }
            )
        }

        let dbRateCheckEmail: { data?: any; error?: any } | null = null
        try {
            dbRateCheckEmail = await supabase.rpc('check_otp_rate_limit', {
                p_identifier: email,
                p_identifier_type: 'email',
                p_max_requests: OTP_MAX_REQUESTS_PER_EMAIL,
                p_window_minutes: OTP_RATE_LIMIT_WINDOW_MINUTES,
            })
        } catch {
            dbRateCheckEmail = null
        }

        if (dbRateCheckEmail?.data?.[0] && !dbRateCheckEmail.data[0].allowed) {
            return NextResponse.json(
                {
                    error: `Too many verification requests. Please try again in ${Math.ceil(dbRateCheckEmail.data[0].retry_after_seconds / 60)} minutes.`,
                    retryAfter: dbRateCheckEmail.data[0].retry_after_seconds,
                },
                { status: 429 }
            )
        }

        const otp = secureRandomDigits(OTP_LENGTH)
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
        const otpHash = await bcrypt.hash(otp, 12)

        await supabase
            .from('otp_codes')
            .delete()
            .eq('email', email)

        const { error: dbError } = await supabase
            .from('otp_codes')
            .insert({
                email,
                code: otpHash,
                expires_at: expiresAt.toISOString(),
                verified: false,
                attempts: 0,
                request_ip: clientIp,
                fingerprint,
            })

        if (dbError) {
            console.error('[SEND_OTP] Database insert error:', dbError.message)
            return NextResponse.json(
                { error: 'Failed to generate verification code. Please try again.' },
                { status: 500 }
            )
        }

        await logAuthEvent(createAuditEvent('otp_sent', email, clientIp))

        const smtpConfig = getSmtpConfig()
        if (!smtpConfig) {
            if (process.env.NODE_ENV !== 'production') {
                return NextResponse.json({
                    success: true,
                    message: 'Verification code generated in development mode',
                    devMode: true,
                    remainingAttempts: emailRateResult.remainingRequests,
                })
            }
            return NextResponse.json(
                { error: 'Email service is not configured' },
                { status: 503 }
            )
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: smtpConfig.user, pass: smtpConfig.pass },
        })

        await transporter.sendMail({
            from: `"Nexus POS" <${smtpConfig.user}>`,
            to: email,
            subject: 'Your Nexus POS Verification Code',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #f97316; margin: 0; font-size: 28px;">Nexus POS</h1>
                        <p style="color: #64748b; margin-top: 5px; font-size: 14px;">Restaurant Management System</p>
                    </div>
                    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px; padding: 40px; text-align: center;">
                        <h2 style="color: #ffffff; margin: 0 0 10px; font-size: 20px;">Verification Code</h2>
                        <p style="color: #94a3b8; margin: 0 0 30px; font-size: 14px;">Enter this code to verify your email</p>
                        <div style="background: #1e293b; border-radius: 12px; padding: 24px; display: inline-block; border: 1px solid #334155;">
                            <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #f97316; font-family: 'Courier New', monospace;">${otp}</span>
                        </div>
                        <p style="color: #64748b; margin-top: 30px; font-size: 13px;">
                            This code expires in <strong style="color: #f97316;">10 minutes</strong>.
                        </p>
                    </div>
                    <div style="margin-top: 30px; padding: 20px; background: #fef3c7; border-radius: 12px; border-left: 4px solid #f59e0b;">
                        <p style="color: #92400e; font-size: 13px; margin: 0;">
                            <strong>Security Notice:</strong> Never share this code with anyone. Nexus POS staff will never ask for your verification code.
                        </p>
                    </div>
                    <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 30px;">
                        If you didn't request this code, you can safely ignore this email.
                    </p>
                </div>
            `,
        })

        return NextResponse.json({
            success: true,
            message: 'Verification code sent successfully',
            remainingAttempts: emailRateResult.remainingRequests,
        })
    } catch (error: unknown) {
        console.error('[SEND_OTP] Error:', error instanceof Error ? error.message : 'Unknown error')
        return NextResponse.json(
            { error: sanitizeErrorMessage(error) },
            { status: 500 }
        )
    }
}