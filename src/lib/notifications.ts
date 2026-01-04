import { sendNotification, generateTrackingUrl, NotificationType } from '@/lib/twilio'

/**
 * Notification service for order lifecycle events
 * Automatically sends WhatsApp/SMS based on order status changes
 */

export interface OrderNotificationData {
    orderNumber: number
    customerName: string
    customerPhone: string
    riderName?: string
    riderPhone?: string
    estimatedTime?: number
}

/**
 * Send notification based on order status
 */
export async function notifyOrderStatus(
    status: string,
    data: OrderNotificationData,
    channel: 'sms' | 'whatsapp' | 'both' = 'whatsapp'
) {
    const trackingUrl = generateTrackingUrl(data.orderNumber)

    // Map order status to notification type
    const statusToType: Record<string, NotificationType> = {
        pending: 'order_confirmed',
        preparing: 'order_preparing',
        ready: 'order_ready',
        served: 'out_for_delivery', // For delivery orders
        paid: 'delivered',
    }

    const notificationType = statusToType[status]
    if (!notificationType) {
        console.log(`No notification for status: ${status}`)
        return null
    }

    return sendNotification({
        to: data.customerPhone,
        type: notificationType,
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        riderName: data.riderName,
        riderPhone: data.riderPhone,
        trackingUrl,
        estimatedTime: data.estimatedTime,
    }, channel)
}

/**
 * Notify customer that rider has been assigned
 */
export async function notifyRiderAssigned(data: OrderNotificationData) {
    if (!data.riderName || !data.riderPhone) {
        console.warn('Rider info missing for notification')
        return null
    }

    return sendNotification({
        to: data.customerPhone,
        type: 'rider_assigned',
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        riderName: data.riderName,
        riderPhone: data.riderPhone,
        trackingUrl: generateTrackingUrl(data.orderNumber),
    }, 'whatsapp')
}

/**
 * Send custom notification
 */
export async function notifyCustom(
    phone: string,
    message: string,
    channel: 'sms' | 'whatsapp' = 'whatsapp'
) {
    return sendNotification({
        to: phone,
        type: 'custom',
        customMessage: message,
    }, channel)
}
