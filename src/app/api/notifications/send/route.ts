import { NextRequest, NextResponse } from 'next/server'
import { sendNotification, generateTrackingUrl, NotificationType } from '@/lib/twilio'

export async function POST(request: NextRequest) {
    try {
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

        // Generate tracking URL
        const trackingUrl = orderNumber ? generateTrackingUrl(orderNumber) : undefined

        // Send notification
        const result = await sendNotification({
            to: phone,
            type: type as NotificationType,
            orderNumber,
            customerName,
            riderName,
            riderPhone,
            trackingUrl,
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
