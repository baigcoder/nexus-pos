import twilio from 'twilio'

// Twilio credentials from environment
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'

// Initialize Twilio client
const client = accountSid && authToken ? twilio(accountSid, authToken) : null

export type NotificationType =
    | 'order_confirmed'
    | 'order_preparing'
    | 'order_ready'
    | 'rider_assigned'
    | 'out_for_delivery'
    | 'delivered'
    | 'custom'

export interface NotificationPayload {
    to: string
    type: NotificationType
    orderNumber?: number
    customerName?: string
    riderName?: string
    riderPhone?: string
    trackingUrl?: string
    estimatedTime?: number
    customMessage?: string
}

// Message templates
const messageTemplates: Record<NotificationType, (payload: NotificationPayload) => string> = {
    order_confirmed: (p) =>
        `🎉 Order Confirmed!\n\nHi ${p.customerName || 'Valued Customer'},\nYour order #${p.orderNumber} has been confirmed.\n\nTrack it here: ${p.trackingUrl}\n\nThank you for ordering!`,

    order_preparing: (p) =>
        `👨‍🍳 Kitchen is Cooking!\n\nOrder #${p.orderNumber} is now being prepared.\nEstimated time: ${p.estimatedTime || 20} minutes`,

    order_ready: (p) =>
        `✅ Order Ready!\n\nOrder #${p.orderNumber} is ready${p.riderName ? ` and ${p.riderName} is on the way!` : '!'}\n\nTrack: ${p.trackingUrl}`,

    rider_assigned: (p) =>
        `🏍️ Rider Assigned!\n\nYour order #${p.orderNumber} will be delivered by ${p.riderName}.\n\n📞 Contact: ${p.riderPhone}\n🔗 Track: ${p.trackingUrl}`,

    out_for_delivery: (p) =>
        `🚀 On the Way!\n\nOrder #${p.orderNumber} is out for delivery!\n\nRider: ${p.riderName}\nETA: ${p.estimatedTime || 15} mins\n\n📍 Live Track: ${p.trackingUrl}`,

    delivered: (p) =>
        `🎊 Delivered!\n\nOrder #${p.orderNumber} has been delivered.\n\nThank you for choosing us! ⭐\nWe'd love your feedback.`,

    custom: (p) => p.customMessage || '',
}

/**
 * Send SMS via Twilio
 */
export async function sendSMS(payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!client) {
        console.warn('Twilio not configured - SMS not sent')
        return { success: false, error: 'Twilio not configured' }
    }

    const message = messageTemplates[payload.type](payload)

    try {
        const result = await client.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: payload.to,
        })

        console.log(`SMS sent: ${result.sid}`)
        return { success: true, messageId: result.sid }
    } catch (error: any) {
        console.error('SMS send error:', error.message)
        return { success: false, error: error.message }
    }
}

/**
 * Send WhatsApp message via Twilio
 */
export async function sendWhatsApp(payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!client) {
        console.warn('Twilio not configured - WhatsApp not sent')
        return { success: false, error: 'Twilio not configured' }
    }

    const message = messageTemplates[payload.type](payload)
    const toWhatsApp = payload.to.startsWith('whatsapp:') ? payload.to : `whatsapp:${payload.to}`

    try {
        const result = await client.messages.create({
            body: message,
            from: twilioWhatsAppNumber,
            to: toWhatsApp,
        })

        console.log(`WhatsApp sent: ${result.sid}`)
        return { success: true, messageId: result.sid }
    } catch (error: any) {
        console.error('WhatsApp send error:', error.message)
        return { success: false, error: error.message }
    }
}

/**
 * Send notification via preferred channel
 */
export async function sendNotification(
    payload: NotificationPayload,
    channel: 'sms' | 'whatsapp' | 'both' = 'whatsapp'
): Promise<{ sms?: { success: boolean }; whatsapp?: { success: boolean } }> {
    const results: { sms?: { success: boolean; messageId?: string }; whatsapp?: { success: boolean; messageId?: string } } = {}

    if (channel === 'sms' || channel === 'both') {
        results.sms = await sendSMS(payload)
    }

    if (channel === 'whatsapp' || channel === 'both') {
        results.whatsapp = await sendWhatsApp(payload)
    }

    return results
}

/**
 * Generate tracking URL
 */
export function generateTrackingUrl(orderNumber: number): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexuspos.com'
    return `${baseUrl}/track?order=${orderNumber}`
}
