import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase with service role for server-side operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const { email, code } = await request.json()

        if (!email || !code) {
            return NextResponse.json(
                { error: 'Email and code are required' },
                { status: 400 }
            )
        }

        // Find matching OTP
        const { data: otpRecord, error: fetchError } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('email', email)
            .eq('code', code)
            .eq('verified', false)
            .single()

        if (fetchError || !otpRecord) {
            return NextResponse.json(
                { error: 'Invalid verification code' },
                { status: 400 }
            )
        }

        // Check if expired
        if (new Date(otpRecord.expires_at) < new Date()) {
            // Delete expired OTP
            await supabase.from('otp_codes').delete().eq('id', otpRecord.id)
            return NextResponse.json(
                { error: 'Verification code has expired' },
                { status: 400 }
            )
        }

        // Mark as verified
        await supabase
            .from('otp_codes')
            .update({ verified: true })
            .eq('id', otpRecord.id)

        // Update user's email confirmation in auth.users
        // Note: This requires the user to already exist from signUp
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id || '',
            { email_confirm: true }
        )
        // Find the user ID for the verified email
        const { data: usersData } = await supabase.auth.admin.listUsers()
        const verifiedUser = usersData?.users?.find(u => u.email === email)

        if (updateError) {
            console.error('Error confirming email:', updateError)
            // Continue anyway - OTP was valid
        }

        // Clean up used OTP
        await supabase.from('otp_codes').delete().eq('email', email)

        return NextResponse.json({
            success: true,
            message: 'Email verified successfully',
            verified: true,
            userId: verifiedUser?.id || null,
            email: email
        })
    } catch (error) {
        console.error('Verify OTP error:', error)
        return NextResponse.json(
            { error: 'Verification failed' },
            { status: 500 }
        )
    }
}
