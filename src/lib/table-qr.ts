import { createHmac, timingSafeEqual } from 'node:crypto'
import { getOrderAccessSecret } from './order-access'

export function getTableQrSecret() {
    return process.env.TABLE_QR_SECRET || getOrderAccessSecret()
}

export function issueTableQrToken(restaurantId: string, tableId: string, version: string, secret: string) {
    return createHmac('sha256', secret)
        .update(`nexuspos:table-qr:v1:${restaurantId}:${tableId}:${version}`)
        .digest('base64url')
}

export function verifyTableQrToken(token: unknown, restaurantId: string, tableId: string, version: string, secret: string) {
    if (typeof token !== 'string' || !/^[\w-]{43}$/.test(token)) return false
    const expected = issueTableQrToken(restaurantId, tableId, version, secret)
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}
