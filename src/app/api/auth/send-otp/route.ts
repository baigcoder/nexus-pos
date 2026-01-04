import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

// Generate 6-digit OTP
function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

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

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            )
        }

        // Generate OTP
        const otp = generateOTP()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

        // Delete any existing OTPs for this email
        await supabase
            .from('otp_codes')
            .delete()
            .eq('email', email)

        // Store new OTP
        const { error: dbError } = await supabase
            .from('otp_codes')
            .insert({
                email,
                code: otp,
                expires_at: expiresAt.toISOString(),
                verified: false,
            })

        if (dbError) {
            console.error('Database error:', dbError)
            return NextResponse.json(
                { error: `Database error: ${dbError.message}` },
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
            from: `"OrderFlow" <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: 'Your OrderFlow Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #f97316; margin: 0;">OrderFlow</h1>
                        <p style="color: #64748b; margin-top: 5px;">Restaurant Management System</p>
                    </div>
                    
                    <div style="background: #0f172a; border-radius: 16px; padding: 40px; text-align: center;">
                        <h2 style="color: #ffffff; margin: 0 0 10px;">Verification Code</h2>
                        <p style="color: #94a3b8; margin: 0 0 30px;">Enter this code to verify your email</p>
                        
                        <div style="background: #1e293b; border-radius: 12px; padding: 20px; display: inline-block;">
                            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #f97316;">${otp}</span>
                        </div>
                        
                        <p style="color: #64748b; margin-top: 30px; font-size: 14px;">
                            This code expires in 10 minutes.
                        </p>
                    </div>
                    
                    <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 30px;">
                        If you didn't request this code, you can safely ignore this email.
                    </p>
                </div>
            `,
        }

        await transporter.sendMail(mailOptions)

        return NextResponse.json({ success: true, message: 'OTP sent successfully' })
    } catch (error: any) {
        console.error('Send OTP error:', error)
        return NextResponse.json(
            { error: error?.message || 'Failed to send OTP' },
            { status: 500 }
        )
    }
}
