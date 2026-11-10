import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@/types'

export const STAFF_SESSION_COOKIE = 'staff_session'
export const STAFF_SESSION_TTL_SECONDS = 12 * 60 * 60

export interface StaffSessionPayload {
    staffId: string
    restaurantId: string
    role: UserRole
    exp: number
}

function getSessionSecret(): string | null {
    return process.env.STAFF_SESSION_SECRET || process.env.ADMIN_SECRET_KEY || null
}

function toBase64Url(bytes: Uint8Array): string {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
}

function utf8Bytes(value: string): Uint8Array {
    return new TextEncoder().encode(value)
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
}

async function signPayload(encodedPayload: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        utf8Bytes(secret) as BufferSource,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, utf8Bytes(encodedPayload) as BufferSource)
    return toBase64Url(new Uint8Array(signature))
}

function cookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: STAFF_SESSION_TTL_SECONDS,
    }
}

export async function createStaffSessionToken(input: Omit<StaffSessionPayload, 'exp'>): Promise<string | null> {
    const secret = getSessionSecret()
    if (!secret) return null

    const payload: StaffSessionPayload = {
        ...input,
        exp: Math.floor(Date.now() / 1000) + STAFF_SESSION_TTL_SECONDS,
    }
    const encoded = toBase64Url(utf8Bytes(JSON.stringify(payload)))
    return `${encoded}.${await signPayload(encoded, secret)}`
}

export async function parseStaffSessionToken(token: string | undefined | null): Promise<StaffSessionPayload | null> {
    if (!token) return null
    const secret = getSessionSecret()
    if (!secret) return null

    const dot = token.lastIndexOf('.')
    if (dot <= 0) return null

    const encoded = token.slice(0, dot)
    const signature = token.slice(dot + 1)
    if (!encoded || !signature) return null

    const expected = await signPayload(encoded, secret)
    if (!timingSafeEqualBytes(utf8Bytes(signature), utf8Bytes(expected))) {
        return null
    }

    try {
        const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as StaffSessionPayload
        if (!payload.staffId || !payload.restaurantId || !payload.role || !payload.exp) return null
        if (payload.exp < Math.floor(Date.now() / 1000)) return null
        return payload
    } catch {
        return null
    }
}

export async function readStaffSession(request: NextRequest): Promise<StaffSessionPayload | null> {
    return parseStaffSessionToken(request.cookies.get(STAFF_SESSION_COOKIE)?.value)
}

export async function attachStaffSessionCookie(
    response: NextResponse,
    session: Omit<StaffSessionPayload, 'exp'>
): Promise<NextResponse> {
    const token = await createStaffSessionToken(session)
    if (!token) return response
    response.cookies.set(STAFF_SESSION_COOKIE, token, cookieOptions())
    return response
}

export function clearStaffSessionCookie(response: NextResponse): NextResponse {
    response.cookies.set(STAFF_SESSION_COOKIE, '', {
        ...cookieOptions(),
        maxAge: 0,
    })
    return response
}

export async function jsonWithStaffSession(
    body: unknown,
    session: Omit<StaffSessionPayload, 'exp'>,
    init?: ResponseInit
): Promise<NextResponse> {
    return attachStaffSessionCookie(NextResponse.json(body, init), session)
}
