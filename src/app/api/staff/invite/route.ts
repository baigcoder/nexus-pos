import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

// Generate a random 6-digit PIN
function generateTempPin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

// Email validation regex
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

// Simple in-memory rate limiting (per restaurant)
const inviteAttempts = new Map<string, { count: number; lastAttempt: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_INVITES_PER_MINUTE = 5

function checkRateLimit(restaurantId: string): boolean {
    const now = Date.now()
    const attempts = inviteAttempts.get(restaurantId)

    if (!attempts) {
        inviteAttempts.set(restaurantId, { count: 1, lastAttempt: now })
        return true
    }

    if (now - attempts.lastAttempt > RATE_LIMIT_WINDOW) {
        inviteAttempts.set(restaurantId, { count: 1, lastAttempt: now })
        return true
    }

    if (attempts.count >= MAX_INVITES_PER_MINUTE) {
        return false
    }

    attempts.count++
    return true
}

// Create Supabase admin client lazily (not at module level to avoid build-time errors)
function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        throw new Error('Supabase configuration missing')
    }
    return createClient(url, key)
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, email, role, restaurantId, phone, resend } = body

        // Validate required fields
        if (!name || !email || !role || !restaurantId) {
            return NextResponse.json(
                { error: 'Missing required fields: name, email, role, restaurantId' },
                { status: 400 }
            )
        }

        // Validate email format
        if (!isValidEmail(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            )
        }

        // Validate role
        const validRoles = ['manager', 'waiter', 'kitchen', 'cashier', 'delivery', 'rider']
        if (!validRoles.includes(role)) {
            return NextResponse.json(
                { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
                { status: 400 }
            )
        }

        // Rate limiting
        if (!checkRateLimit(restaurantId)) {
            return NextResponse.json(
                { error: 'Too many invitations. Please wait a minute before sending more.' },
                { status: 429 }
            )
        }

        const supabase = getAdminClient()

        // Check if restaurant exists
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('id, name, slug')
            .eq('id', restaurantId)
            .single()

        if (restaurantError || !restaurant) {
            return NextResponse.json(
                { error: 'Restaurant not found' },
                { status: 404 }
            )
        }

        // Check if staff with this email already exists in this restaurant
        const { data: existingStaff } = await supabase
            .from('staff')
            .select('id, needs_setup, name')
            .eq('restaurant_id', restaurantId)
            .eq('email', email.toLowerCase())
            .single()

        let staff = existingStaff
        let tempPin: string

        if (existingStaff) {
            if (resend) {
                // Resend invitation - generate new temp PIN
                tempPin = generateTempPin()

                const { error: updateError } = await supabase
                    .from('staff')
                    .update({
                        temp_pin: tempPin,
                        needs_setup: true,
                        invited_at: new Date().toISOString(),
                    })
                    .eq('id', existingStaff.id)

                if (updateError) {
                    console.error('Staff update error:', updateError)
                    return NextResponse.json(
                        { error: 'Failed to resend invitation' },
                        { status: 500 }
                    )
                }

                staff = existingStaff
            } else if (existingStaff.needs_setup) {
                return NextResponse.json(
                    {
                        error: 'This staff member has a pending invitation. Use resend=true to send again.',
                        canResend: true,
                        staffId: existingStaff.id,
                        staffName: existingStaff.name,
                    },
                    { status: 409 }
                )
            } else {
                return NextResponse.json(
                    { error: 'A staff member with this email already exists and is active' },
                    { status: 409 }
                )
            }
        } else {
            // Generate temporary PIN for new staff
            tempPin = generateTempPin()

            console.log('📝 Creating new staff with data:', {
                restaurant_id: restaurantId,
                name: name.trim(),
                email: email.toLowerCase().trim(),
                role,
                phone: phone?.trim() || null,
            })

            // Create staff record
            const { data: newStaff, error: insertError } = await supabase
                .from('staff')
                .insert({
                    restaurant_id: restaurantId,
                    name: name.trim(),
                    email: email.toLowerCase().trim(),
                    role,
                    phone: phone?.trim() || null,
                    temp_pin: tempPin,
                    needs_setup: true,
                    is_active: true,
                    invited_at: new Date().toISOString(),
                })
                .select()
                .single()

            if (insertError) {
                console.error('❌ Staff insert error:', insertError)
                return NextResponse.json(
                    { error: `Database error: ${insertError.message}` },
                    { status: 500 }
                )
            }

            staff = newStaff
        }

        // Send invitation email
        let emailSent = false
        try {
            // Log SMTP config (without password)
            console.log('📧 Attempting to send email...')
            console.log('   SMTP_EMAIL:', process.env.SMTP_EMAIL ? '✓ Set' : '✗ Not set')
            console.log('   SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '✓ Set' : '✗ Not set')
            console.log('   To:', email)

            if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
                console.warn('⚠️ SMTP credentials not configured. Skipping email.')
            } else {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.SMTP_EMAIL,
                        pass: process.env.SMTP_PASSWORD,
                    },
                })

                const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/staff-login`

                const mailOptions = {
                    from: `"${restaurant.name}" <${process.env.SMTP_EMAIL}>`,
                    to: email,
                    subject: resend
                        ? `🔄 New Invitation PIN for ${restaurant.name}`
                        : `🎉 You're Invited to Join ${restaurant.name}!`,
                    html: `
                        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #f8fafc;">
                            <!-- Header -->
                            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px 30px; text-align: center; border-radius: 0 0 24px 24px;">
                                <h1 style="color: #f97316; margin: 0; font-size: 28px; font-weight: 800;">OrderFlow</h1>
                                <p style="color: #64748b; margin: 8px 0 0; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Staff Portal</p>
                            </div>
                            
                            <!-- Content -->
                            <div style="padding: 40px 30px;">
                                <h2 style="color: #0f172a; margin: 0 0 16px; font-size: 24px;">${resend ? 'New Invitation PIN' : 'Welcome to the Team!'} 🎉</h2>
                                
                                <p style="color: #475569; margin: 0 0 24px; font-size: 16px; line-height: 1.6;">
                                    Hi <strong>${name}</strong>,<br/>
                                    ${resend ? "Here's your new temporary PIN for" : "You've been invited to join"}
                                    <strong style="color: #f97316;">${restaurant.name}</strong> as a <strong style="color: #3b82f6;">${role}</strong>.
                                </p>
                                
                                <!-- PIN Box -->
                                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
                                    <p style="color: #94a3b8; margin: 0 0 12px; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Temporary PIN</p>
                                    <div style="font-size: 48px; font-weight: 800; letter-spacing: 12px; color: #f97316;">${tempPin!}</div>
                                    <p style="color: #64748b; margin: 16px 0 0; font-size: 12px;">This PIN expires after first use</p>
                                </div>
                                
                                <!-- Steps -->
                                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0;">
                                    <h3 style="color: #0f172a; margin: 0 0 16px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">How to Login</h3>
                                    <ol style="color: #475569; margin: 0; padding-left: 20px; font-size: 14px; line-height: 2;">
                                        <li>Go to <a href="${loginUrl}" style="color: #3b82f6; text-decoration: none;">${loginUrl}</a></li>
                                        <li>Enter your email: <strong>${email}</strong></li>
                                        <li>Enter the temporary PIN above</li>
                                        <li>Set up your permanent 4-digit PIN</li>
                                    </ol>
                                </div>
                                
                                <!-- CTA Button -->
                                <div style="text-align: center; margin: 32px 0;">
                                    <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                                        Login Now →
                                    </a>
                                </div>
                            </div>
                            
                            <!-- Footer -->
                            <div style="padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                                    This invitation was sent from <strong>${restaurant.name}</strong>.<br/>
                                    If you didn't expect this, you can safely ignore this email.
                                </p>
                            </div>
                        </div>
                    `,
                }

                await transporter.sendMail(mailOptions)
                emailSent = true
                console.log(`✅ Invitation email ${resend ? 're-sent' : 'sent'} to ${email}`)
            }
        } catch (emailError: any) {
            console.error('❌ Email send error:', emailError.message || emailError)
            // Don't fail the API call if email fails - just log it
        }

        return NextResponse.json({
            success: true,
            staff: {
                id: staff!.id,
                name: name.trim(),
                email: email.toLowerCase().trim(),
                role,
            },
            // Return temp PIN for admin to share (as backup)
            tempPin: tempPin!,
            emailSent,
            resent: resend || false,
            message: emailSent
                ? `Invitation email ${resend ? 're-sent' : 'sent'} to ${email}!`
                : `Staff invited! Email could not be sent. Share this PIN manually: ${tempPin}`,
            restaurant: restaurant.name,
        })

    } catch (error: any) {
        console.error('Staff invite error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to invite staff' },
            { status: 500 }
        )
    }
}
