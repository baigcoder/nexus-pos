import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const SECURITY_HEADERS: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '0',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(self), display-capture=(self), geolocation=(self), payment=()',
    'X-DNS-Prefetch-Control': 'on',
}

const CSP_BASE = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co https://*.googleapis.com wss://*.supabase.co https://maps.googleapis.com",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
]

function isEmbeddablePath(pathname: string): boolean {
    return pathname.startsWith('/embed') || pathname === '/widget.js'
}

export async function middleware(request: NextRequest) {
    const response = await updateSession(request)
    const pathname = request.nextUrl.pathname

    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        response.headers.set(key, value)
    }

    response.headers.set('X-Request-ID', crypto.randomUUID())

    if (isEmbeddablePath(pathname)) {
        response.headers.set('Content-Security-Policy', [...CSP_BASE, "frame-ancestors *"].join('; '))
        response.headers.delete('X-Frame-Options')
    } else {
        response.headers.set('X-Frame-Options', 'DENY')
        response.headers.set('Content-Security-Policy', [...CSP_BASE, "frame-ancestors 'none'"].join('; '))
    }

    if (pathname.startsWith('/api/')) {
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        response.headers.set('Pragma', 'no-cache')
    }

    if (process.env.NODE_ENV === 'production') {
        response.headers.set(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload'
        )
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
