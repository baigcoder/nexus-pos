/**
 * Push Notifications Library
 * Handles Web Push API for browser notifications
 */

// VAPID public key (generate with web-push library)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Get current notification permission status
 */
export function getPermissionStatus(): NotificationPermission {
    if (!('Notification' in window)) return 'denied'
    return Notification.permission
}

/**
 * Request notification permission
 */
export async function requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported')
        return 'denied'
    }

    const permission = await Notification.requestPermission()
    return permission
}

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        console.warn('Service workers not supported')
        return null
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
        })
        console.log('Service worker registered:', registration.scope)
        return registration
    } catch (error) {
        console.error('Service worker registration failed:', error)
        return null
    }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
    try {
        // Request permission first
        const permission = await requestPermission()
        if (permission !== 'granted') {
            console.log('Notification permission denied')
            return null
        }

        // Get service worker registration
        const registration = await navigator.serviceWorker.ready

        // Check for existing subscription
        let subscription = await registration.pushManager.getSubscription()

        if (!subscription) {
            // Create new subscription
            const serverKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: serverKey,
            })
            console.log('Push subscription created:', subscription.endpoint)
        }

        // Send subscription to server
        await saveSubscription(subscription)

        return subscription
    } catch (error) {
        console.error('Push subscription failed:', error)
        return null
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
    try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
            await subscription.unsubscribe()
            await removeSubscription(subscription)
            console.log('Unsubscribed from push notifications')
            return true
        }
        return false
    } catch (error) {
        console.error('Unsubscribe failed:', error)
        return false
    }
}

/**
 * Send local notification (for testing)
 */
export async function showLocalNotification(
    title: string,
    body: string,
    options?: NotificationOptions
): Promise<void> {
    if (!('Notification' in window)) return

    if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready
        registration.showNotification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            ...options,
        } as NotificationOptions)
    }
}

/**
 * Save subscription to server
 */
async function saveSubscription(subscription: PushSubscription): Promise<void> {
    try {
        await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription.toJSON()),
        })
    } catch (error) {
        console.error('Failed to save subscription:', error)
    }
}

/**
 * Remove subscription from server
 */
async function removeSubscription(subscription: PushSubscription): Promise<void> {
    try {
        await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
    } catch (error) {
        console.error('Failed to remove subscription:', error)
    }
}

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray.buffer as ArrayBuffer
}

/**
 * Notification types for the app
 */
export type NotificationType =
    | 'new_order'
    | 'order_ready'
    | 'order_preparing'
    | 'delivery_assigned'
    | 'delivery_arrived'
    | 'custom'

export interface PushPayload {
    type: NotificationType
    title: string
    body: string
    data?: Record<string, any>
    actions?: { action: string; title: string }[]
}
