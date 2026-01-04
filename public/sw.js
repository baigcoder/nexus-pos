// Nexus POS Service Worker for Push Notifications

const CACHE_NAME = 'nexus-pos-v1'

// Install event
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...')
    self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...')
    event.waitUntil(self.clients.claim())
})

// Push notification received
self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event)

    let data = {
        title: 'Nexus POS',
        body: 'You have a new notification',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'nexus-notification',
        data: {},
    }

    if (event.data) {
        try {
            const payload = event.data.json()
            data = { ...data, ...payload }
        } catch (e) {
            data.body = event.data.text()
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/icon-192.png',
        badge: data.badge || '/badge-72.png',
        tag: data.tag || 'nexus-notification',
        data: data.data,
        vibrate: [200, 100, 200],
        actions: data.actions || [],
        requireInteraction: data.requireInteraction || false,
    }

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event)

    event.notification.close()

    const data = event.notification.data || {}
    let url = '/'

    // Handle different notification types
    if (data.type === 'new_order') {
        url = '/dashboard/orders'
    } else if (data.type === 'order_ready') {
        url = '/dashboard/kitchen'
    } else if (data.type === 'delivery_assigned') {
        url = '/dashboard/delivery-boy'
    } else if (data.orderId) {
        url = `/track?order=${data.orderId}`
    } else if (data.url) {
        url = data.url
    }

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing window if open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url)
                    return client.focus()
                }
            }
            // Open new window
            if (self.clients.openWindow) {
                return self.clients.openWindow(url)
            }
        })
    )
})

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed:', event)
})
