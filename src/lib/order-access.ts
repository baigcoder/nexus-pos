import { createHmac, timingSafeEqual } from 'node:crypto'

const tokenLifetimeSeconds = 7 * 24 * 60 * 60
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export function getOrderAccessSecret(): string | undefined {
    return process.env.ORDER_ACCESS_SECRET || process.env.STAFF_SESSION_SECRET || process.env.ADMIN_SECRET_KEY
}

function sign(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(`nexuspos:customer-order:v1:${payload}`).digest('base64url')
}

export function issueOrderAccessToken(orderId: string, secret: string, issuedAt = Math.floor(Date.now() / 1000)): string {
    const expiresAt = issuedAt + tokenLifetimeSeconds
    const payload = `${orderId}.${expiresAt}`
    return `${payload}.${sign(payload, secret)}`
}

export function verifyOrderAccessToken(
    authorization: string | null,
    secret = getOrderAccessSecret(),
    now = Math.floor(Date.now() / 1000),
): string | null {
    if (!secret || !authorization || authorization.length > 110 || !authorization.startsWith('Bearer ')) {
        return null
    }

    const [orderId, expiresAt, signature, ...extra] = authorization.slice(7).split('.')
    if (!uuid.test(orderId) || !/^\d{10}$/.test(expiresAt) || !/^[\w-]{43}$/.test(signature) ||
        Number(expiresAt) <= now || extra.length) {
        return null
    }

    const expected = sign(`${orderId}.${expiresAt}`, secret)
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? orderId : null
}

export const privateOrderHeaders = { 'Cache-Control': 'private, no-store' }
