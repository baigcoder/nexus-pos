import { NextRequest, NextResponse } from 'next/server'
import { sendNotification, NotificationType } from '@/lib/twilio'
import { getAuthenticatedStaff } from '@/lib/api-auth'
import { checkRateLimitPersistent } from '@/lib/auth'

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        // Sends SMS/WhatsApp from the restaurant's Twilio number with caller-supplied text: front-of-house only, throttled.
        if (!['owner', 'manager', 'cashier'].includes(auth.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const rate = await checkRateLimitPersistent(`notify:${auth.restaurantId}:${auth.staffId}`, { maxRequests: 30, windowMs: 60 * 60 * 1000 })
        if (!rate.allowed) {
            return NextResponse.json({ error: 'Too many notifications. Try again later.' }, { status: 429 })
        }

        const body = await request.json()
        const {
            phone,
            type,
            channel = 'whatsapp',
            orderNumber,
            customerName,
            riderName,
            riderPhone,
            estimatedTime,
            customMessage,
        } = body

        // Validate required fields
        if (!phone) {
            return NextResponse.json(
                { error: 'phone is required' },
                { status: 400 }
            )
        }

        if (!type) {
            return NextResponse.json(
                { error: 'type is required' },
                { status: 400 }
            )
        }

        // Send notification
        const result = await sendNotification({
            to: phone,
            type: type as NotificationType,
            orderNumber,
            customerName,
            riderName,
            riderPhone,
            estimatedTime,
            customMessage,
        }, channel)

        return NextResponse.json({
            success: true,
            result,
        })

    } catch (error: any) {
        console.error('Notification API error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to send notification' },
            { status: 500 }
        )
    }
}
