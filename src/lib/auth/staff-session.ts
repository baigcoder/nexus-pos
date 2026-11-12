import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextResponse } from 'next/server'

// Signed, httpOnly session for PIN/email-logged-in staff (they have no Supabase session).
export const STAFF_SESSION_COOKIE = 'staff_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function getSecret(): string {
    const secret = process.env.STAFF_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!secret) throw new Error('STAFF_SESSION_SECRET is not configured')
    return secret
}

function sign(payload: string): string {
    return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function createStaffSessionToken(staffId: string, now = Date.now()): string {
    const payload = Buffer.from(JSON.stringify({ sid: staffId, exp: now + MAX_AGE_SECONDS * 1000 })).toString('base64url')
    return `${payload}.${sign(payload)}`
}

/** Returns the staff id if the token is authentic and unexpired, else null. */
export function verifyStaffSessionToken(token: string | undefined | null, now = Date.now()): string | null {
    if (!token) return null
    const [payload, signature, extra] = token.split('.')
    if (!payload || !signature || extra !== undefined) return null

    const expected = Buffer.from(sign(payload))
    const actual = Buffer.from(signature)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

    try {
        const { sid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
        if (typeof sid !== 'string' || typeof exp !== 'number' || exp < now) return null
        return sid
    } catch {
        return null
    }
}

export function setStaffSessionCookie<T extends NextResponse>(response: T, staffId: string): T {
    response.cookies.set(STAFF_SESSION_COOKIE, createStaffSessionToken(staffId), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: MAX_AGE_SECONDS,
    })
    return response
}

export function clearStaffSessionCookie<T extends NextResponse>(response: T): T {
    response.cookies.set(STAFF_SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
    return response
}
