import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

// Maximum verification attempts before OTP is invalidated
const MAX_OTP_ATTEMPTS = 3

export async function POST(request: NextRequest) {
    try {
        // Initialize Supabase with service role for server-side operations
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { email, code } = await request.json()

        if (!email || !code) {
            return NextResponse.json(
                { error: 'Email and verification code are required' },
                { status: 400 }
            )
        }

        // Validate code format (6 digits)
        if (!/^\d{6}$/.test(code)) {
            return NextResponse.json(
                { error: 'Invalid verification code format' },
                { status: 400 }
            )
        }

        // Find OTP record for this email
        const { data: otpRecord, error: fetchError } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('email', email.toLowerCase())
            .eq('verified', false)
            .single()

        if (fetchError || !otpRecord) {
            return NextResponse.json(
                { error: 'No pending verification code found. Please request a new one.' },
                { status: 400 }
            )
        }

        // Check if expired
        if (new Date(otpRecord.expires_at) < new Date()) {
            // Delete expired OTP
            await supabase.from('otp_codes').delete().eq('id', otpRecord.id)
            return NextResponse.json(
                { error: 'Verification code has expired. Please request a new one.' },
                { status: 400 }
            )
        }

        // Check if too many attempts
        const currentAttempts = otpRecord.attempts || 0
        if (currentAttempts >= MAX_OTP_ATTEMPTS) {
            // Delete the OTP after max attempts
            await supabase.from('otp_codes').delete().eq('id', otpRecord.id)
            return NextResponse.json(
                { error: 'Too many failed attempts. Please request a new verification code.' },
                { status: 400 }
            )
        }

        // Verify the OTP (compare with hash)
        let isValidCode = false

        // Check if stored code is hashed (starts with $2) or plain text (legacy)
        if (otpRecord.code.startsWith('$2')) {
            isValidCode = await bcrypt.compare(code, otpRecord.code)
        } else {
            // Legacy plain text comparison (for existing OTPs before migration)
            isValidCode = otpRecord.code === code
        }

        if (!isValidCode) {
            // Increment attempts
            const newAttempts = currentAttempts + 1
            await supabase
                .from('otp_codes')
                .update({ attempts: newAttempts })
                .eq('id', otpRecord.id)

            const remainingAttempts = MAX_OTP_ATTEMPTS - newAttempts

            if (remainingAttempts <= 0) {
                await supabase.from('otp_codes').delete().eq('id', otpRecord.id)
                return NextResponse.json(
                    { error: 'Too many failed attempts. Please request a new verification code.' },
                    { status: 400 }
                )
            }

            return NextResponse.json(
                {
                    error: 'Invalid verification code',
                    remainingAttempts
                },
                { status: 400 }
            )
        }

        // Mark as verified
        await supabase
            .from('otp_codes')
            .update({ verified: true })
            .eq('id', otpRecord.id)

        // Find the user with this email
        const { data: usersData } = await supabase.auth.admin.listUsers()
        const verifiedUser = usersData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

        // Update user's email confirmation if user exists
        if (verifiedUser) {
            await supabase.auth.admin.updateUserById(verifiedUser.id, {
                email_confirm: true
            })
        }

        // Clean up used OTP
        await supabase.from('otp_codes').delete().eq('email', email.toLowerCase())

        return NextResponse.json({
            success: true,
            message: 'Email verified successfully',
            verified: true,
            userId: verifiedUser?.id || null,
            email: email.toLowerCase()
        })
    } catch (error) {
        console.error('Verify OTP error:', error)
        return NextResponse.json(
            { error: 'Verification failed. Please try again.' },
            { status: 500 }
        )
    }
}
