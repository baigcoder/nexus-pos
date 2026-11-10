import { NextRequest, NextResponse } from 'next/server'
import { sendNotification, NotificationType } from '@/lib/twilio'
import { getAuthenticatedStaff } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
