import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

// Generate 6-digit OTP
function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

// Rate limiting constants
const MAX_OTP_REQUESTS_PER_EMAIL = 3
const MAX_OTP_REQUESTS_PER_IP = 10
const RATE_LIMIT_WINDOW_MINUTES = 15

export async function POST(request: NextRequest) {
    try {
        // Initialize Supabase with service role
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { email } = await request.json()
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            )
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            )
        }

        // Check rate limit by email
        const { data: emailRateCheck } = await supabase.rpc('check_otp_rate_limit', {
            p_identifier: email.toLowerCase(),
            p_identifier_type: 'email',
            p_max_requests: MAX_OTP_REQUESTS_PER_EMAIL,
            p_window_minutes: RATE_LIMIT_WINDOW_MINUTES
        })

        if (emailRateCheck && emailRateCheck.length > 0 && !emailRateCheck[0].allowed) {
            return NextResponse.json(
                {
                    error: `Too many OTP requests. Please try again in ${Math.ceil(emailRateCheck[0].retry_after_seconds / 60)} minutes.`,
                    retryAfter: emailRateCheck[0].retry_after_seconds
                },
                { status: 429 }
            )
        }

        // Check rate limit by IP
        const { data: ipRateCheck } = await supabase.rpc('check_otp_rate_limit', {
            p_identifier: clientIp,
            p_identifier_type: 'ip',
            p_max_requests: MAX_OTP_REQUESTS_PER_IP,
            p_window_minutes: RATE_LIMIT_WINDOW_MINUTES
        })

        if (ipRateCheck && ipRateCheck.length > 0 && !ipRateCheck[0].allowed) {
            return NextResponse.json(
                {
                    error: 'Too many requests from your network. Please try again later.',
                    retryAfter: ipRateCheck[0].retry_after_seconds
                },
                { status: 429 }
            )
        }

        // Generate OTP
        const otp = generateOTP()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

        // Hash OTP before storing (security improvement)
        const otpHash = await bcrypt.hash(otp, 10)

        // Delete any existing OTPs for this email
        await supabase
            .from('otp_codes')
            .delete()
            .eq('email', email.toLowerCase())

        // Store new OTP (hashed)
        const { error: dbError } = await supabase
            .from('otp_codes')
            .insert({
                email: email.toLowerCase(),
                code: otpHash, // Store hashed OTP
                expires_at: expiresAt.toISOString(),
                verified: false,
                attempts: 0,
                request_ip: clientIp,
            })

        if (dbError) {
            console.error('Database error:', dbError)
            return NextResponse.json(
                { error: 'Failed to generate verification code' },
                { status: 500 }
            )
        }

        // Create transporter for sending email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
            },
        })

        // Send email
        const mailOptions = {
            from: `"Nexus POS" <${process.env.SMTP_EMAIL}>`,
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
                            <strong>⚠️ Security Notice:</strong> Never share this code with anyone. Nexus POS staff will never ask for your verification code.
                        </p>
                    </div>
                    
                    <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 30px;">
                        If you didn't request this code, you can safely ignore this email.
                    </p>
                </div>
            `,
        }

        await transporter.sendMail(mailOptions)

        return NextResponse.json({
            success: true,
            message: 'Verification code sent successfully',
            remainingAttempts: emailRateCheck?.[0]?.remaining_requests ?? (MAX_OTP_REQUESTS_PER_EMAIL - 1)
        })
    } catch (error: unknown) {
        console.error('Send OTP error:', error)
        return NextResponse.json(
            { error: 'Failed to send verification code. Please try again.' },
            { status: 500 }
        )
    }
}
