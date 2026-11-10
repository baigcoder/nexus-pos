import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTempPin } from '@/lib/pin-utils'
import { sendStaffInviteEmail } from '@/lib/email'
import { requireOwner } from '@/lib/api-auth'
import { STARTER_STAFF_CAP, isPaidPlan } from '@/lib/plan'
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

const INVITE_RATE_CONFIG = {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
}

function getAppUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

async function sendInviteEmail(params: {
    email: string
    name: string
    restaurantName: string
    tempPin: string
    role: string
}): Promise<boolean> {
    try {
        await sendStaffInviteEmail({
            ...params,
            loginUrl: `${getAppUrl()}/staff-login`,
        })
        return true
    } catch (err: unknown) {
        console.error('[STAFF_INVITE] Email send failed:', err instanceof Error ? err.message : 'Unknown error')
        return false
    }
}

// Validate UUID format
function isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
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

        const {
            name: rawName,
            email: rawEmail,
            phone: rawPhone,
            role: rawRole,
            restaurantId,
        } = body as Record<string, unknown>

        // --- Validate inputs ---
        const name = typeof rawName === 'string' ? rawName.trim() : ''
        const email = sanitizeEmail(rawEmail)
        const phone = typeof rawPhone === 'string' ? rawPhone.trim() : ''
        const role = typeof rawRole === 'string' ? rawRole.trim() : ''

        if (!name) {
            return NextResponse.json(
                { success: false, error: 'Staff name is required' },
                { status: 400 }
            )
        }

        if (name.length > AUTH_CONSTANTS.MAX_NAME_LENGTH) {
            return NextResponse.json(
                { success: false, error: 'Name is too long' },
                { status: 400 }
            )
        }

        if (!email) {
            return NextResponse.json(
                { success: false, error: 'A valid email address is required' },
                { status: 400 }
            )
        }

        const validRoles = ['manager', 'waiter', 'kitchen', 'cashier', 'delivery', 'rider']
        if (!validRoles.includes(role)) {
            return NextResponse.json(
                { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
                { status: 400 }
            )
        }

        if (typeof restaurantId !== 'string' || !isValidUUID(restaurantId)) {
            return NextResponse.json(
                { success: false, error: 'Valid restaurant ID is required' },
                { status: 400 }
            )
        }

        // --- Rate limiting ---
        const clientIp = getClientIp(request)
        const rateResult = checkRateLimit(`staff_invite:${clientIp}`, INVITE_RATE_CONFIG)
        if (!rateResult.allowed) {
            return NextResponse.json(
                { success: false, error: 'Too many requests. Please try again later.' },
                { status: 429, headers: getRateLimitHeaders(rateResult, INVITE_RATE_CONFIG) }
            )
        }

        // --- Verify restaurant exists ---
        const { data: restaurant, error: restError } = await supabase
            .from('restaurants')
            .select('id, name, plan, trial_ends_at')
            .eq('id', restaurantId)
            .eq('id', auth.restaurantId)
            .single()

        if (restError || !restaurant) {
            return NextResponse.json(
                { success: false, error: 'Restaurant not found' },
                { status: 404 }
            )
        }

        if (restaurantId !== auth.restaurantId) {
            return NextResponse.json({ success: false, error: 'Access denied for this restaurant' }, { status: 403 })
        }

        if (!isPaidPlan(restaurant.plan) && restaurant.trial_ends_at) {
            const { count } = await supabase
                .from('staff')
                .select('id', { count: 'exact', head: true })
                .eq('restaurant_id', restaurantId)
                .eq('is_active', true)

            if ((count || 0) >= STARTER_STAFF_CAP) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Starter plan allows up to ${STARTER_STAFF_CAP} staff members. Upgrade to invite more.`,
                    },
                    { status: 403 }
                )
            }
        }

        // --- Check for duplicate email within same restaurant ---
        const { data: existingStaff } = await supabase
            .from('staff')
            .select('id, name, email, is_active')
            .eq('restaurant_id', restaurantId)
            .eq('email', email)
            .maybeSingle()

        if (existingStaff) {
            // If staff exists but is inactive, reactivate and re-invite
            if (!existingStaff.is_active) {
                const tempPin = generateTempPin()
                const hashedTempPin = await bcrypt.hash(tempPin, AUTH_CONSTANTS.PIN_BCRYPT_ROUNDS)

                const { error: updateError } = await supabase
                    .from('staff')
                    .update({
                        name,
                        role,
                        phone: phone || null,
                        is_active: true,
                        temp_pin: hashedTempPin,
                        pin: null,
                        needs_setup: true,
                        invited_at: new Date().toISOString(),
                        setup_completed_at: null,
                    })
                    .eq('id', existingStaff.id)

                if (updateError) {
                    console.error('[STAFF_INVITE] Reactivation error:', updateError.message)
                    return NextResponse.json(
                        { success: false, error: 'Failed to reactivate staff member' },
                        { status: 500 }
                    )
                }

                await logAuthEvent(createAuditEvent('staff_setup', email, clientIp, {
                    action: 'staff_reactivated',
                    staffId: existingStaff.id,
                    role,
                }))

                const emailSent = await sendInviteEmail({
                    email,
                    name,
                    restaurantName: restaurant.name,
                    tempPin,
                    role,
                })

                return NextResponse.json({
                    success: true,
                    staffId: existingStaff.id,
                    message: `Staff member ${name} has been reactivated with a new PIN.${emailSent ? ' Invitation email sent.' : ' Email failed — please share the PIN manually.'}`,
                    reactivated: true,
                    emailSent,
                })
            }

            return NextResponse.json(
                { success: false, error: `A staff member with email "${email}" already exists in this restaurant.` },
                { status: 409 }
            )
        }

        // --- Also check global email to prevent cross-restaurant conflicts ---
        const { data: globalExisting } = await supabase
            .from('staff')
            .select('id, restaurant_id')
            .eq('email', email)
            .eq('is_active', true)
            .maybeSingle()

        if (globalExisting) {
            return NextResponse.json(
                { success: false, error: 'This email is already registered with another restaurant.' },
                { status: 409 }
            )
        }

        // --- Generate temporary 6-digit PIN ---
        const tempPin = generateTempPin()
        const hashedTempPin = await bcrypt.hash(tempPin, AUTH_CONSTANTS.PIN_BCRYPT_ROUNDS)

        // --- Create staff record ---
        const { data: newStaff, error: insertError } = await supabase
            .from('staff')
            .insert({
                name,
                email,
                phone: phone || null,
                role,
                restaurant_id: restaurantId,
                is_active: true,
                temp_pin: hashedTempPin,
                pin: null,
                needs_setup: true,
                invited_at: new Date().toISOString(),
            })
            .select('id, name, email, role')
            .single()

        if (insertError) {
            console.error('[STAFF_INVITE] Insert error:', insertError.message)
            return NextResponse.json(
                { success: false, error: 'Failed to create staff member. ' + insertError.message },
                { status: 500 }
            )
        }

        await logAuthEvent(createAuditEvent('staff_setup', email, clientIp, {
            action: 'staff_invited',
            staffId: newStaff.id,
            role,
            restaurantName: restaurant.name,
        }))

        const emailSent = await sendInviteEmail({
            email,
            name,
            restaurantName: restaurant.name,
            tempPin,
            role,
        })

        console.log(`[STAFF_INVITE] Staff "${name}" (${role}) invited to "${restaurant.name}" — Temp PIN: ${tempPin} — Email sent: ${emailSent}`)

        return NextResponse.json({
            success: true,
            staffId: newStaff.id,
            message: `Staff member ${name} has been invited successfully.${emailSent ? ' Invitation email sent.' : ' Email failed — please share the PIN manually.'}`,
            staff: newStaff,
            emailSent,
        })

    } catch (error: unknown) {
        console.error('[STAFF_INVITE] Error:', error instanceof Error ? error.message : 'Unknown error')
        return NextResponse.json(
            { success: false, error: sanitizeErrorMessage(error) },
            { status: 500 }
        )
    }
}
