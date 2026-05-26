import crypto from 'crypto'

const constTimingSafeEqual = typeof crypto.timingSafeEqual === 'function'
    ? crypto.timingSafeEqual
    : (a: Buffer, b: Buffer) => {
        if (a.length !== b.length) return false
        let result = 0
        for (let i = 0; i < a.length; i++) {
            result |= a[i] ^ b[i]
        }
        return result === 0
    }

export function timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8')
    const bufB = Buffer.from(b, 'utf8')
    if (bufA.length !== bufB.length) {
        const maxLen = Math.max(bufA.length, bufB.length)
        const paddedA = Buffer.alloc(maxLen)
        const paddedB = Buffer.alloc(maxLen)
        bufA.copy(paddedA)
        bufB.copy(paddedB)
        return constTimingSafeEqual(paddedA, paddedB) && bufA.length === bufB.length
    }
    return constTimingSafeEqual(bufA, bufB)
}

export function secureRandomDigits(length: number): string {
    const digits = '0123456789'
    const bytes = crypto.randomBytes(length)
    let result = ''
    for (let i = 0; i < length; i++) {
        result += digits[bytes[i] % digits.length]
    }
    return result
}

export function secureRandomToken(byteLength: number = 32): string {
    return crypto.randomBytes(byteLength).toString('hex')
}

export function sanitizeEmail(email: unknown): string | null {
    if (typeof email !== 'string') return null
    const trimmed = email.trim().toLowerCase()
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(trimmed) || trimmed.length > 254) return null
    return trimmed
}

export function validatePin(pin: unknown, minLength: number = 4, maxLength: number = 6): string | null {
    if (typeof pin !== 'string') return null
    const regex = new RegExp(`^\\d{${minLength},${maxLength}}$`)
    if (!regex.test(pin)) return null
    return pin
}

export function validateSlug(slug: unknown): string | null {
    if (typeof slug !== 'string') return null
    const trimmed = slug.trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(trimmed)) return null
    return trimmed
}

export function getClientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
        const ips = forwarded.split(',').map(s => s.trim()).filter(Boolean)
        if (ips.length > 0) return ips[0]
    }
    return request.headers.get('x-real-ip') || 'unknown'
}

export function sanitizeErrorMessage(error: unknown): string {
    if (process.env.NODE_ENV === 'development') {
        return error instanceof Error ? error.message : 'An unexpected error occurred'
    }
    return 'An unexpected error occurred. Please try again.'
}

export interface AuthAuditEvent {
    eventType: 'login_success' | 'login_failure' | 'otp_sent' | 'otp_verified' | 'otp_failed' | 'staff_login' | 'staff_login_failure' | 'staff_setup' | 'account_lockout' | 'rate_limit_exceeded'
    identifier: string
    ip: string
    metadata?: Record<string, unknown>
    timestamp?: string
}

export function createAuditEvent(
    eventType: AuthAuditEvent['eventType'],
    identifier: string,
    ip: string,
    metadata?: Record<string, unknown>
): AuthAuditEvent {
    return {
        eventType,
        identifier,
        ip,
        metadata,
        timestamp: new Date().toISOString(),
    }
}

export async function logAuthEvent(event: AuthAuditEvent): Promise<void> {
    const logEntry = {
        ...event,
        timestamp: event.timestamp || new Date().toISOString(),
    }

    if (process.env.NODE_ENV === 'production') {
        console.info(JSON.stringify({ type: 'AUTH_AUDIT', ...logEntry }))
    } else {
        console.info(`[AUTH_AUDIT] ${event.eventType} - ${event.identifier} from ${event.ip}${event.metadata ? ` ${JSON.stringify(event.metadata)}` : ''}`)
    }
}

export function getClientFingerprint(request: Request): string {
    const ip = getClientIp(request)
    const ua = request.headers.get('user-agent') || ''
    return crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').slice(0, 16)
}

export function hashForLookup(value: string): string {
    return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex')
}

export const AUTH_CONSTANTS = {
    OTP_LENGTH: 6,
    OTP_EXPIRY_MINUTES: 10,
    OTP_MAX_ATTEMPTS: 3,
    OTP_MAX_REQUESTS_PER_EMAIL: 3,
    OTP_MAX_REQUESTS_PER_IP: 10,
    OTP_RATE_LIMIT_WINDOW_MINUTES: 15,

    PIN_LENGTH: 4,
    TEMP_PIN_LENGTH: 6,
    PIN_BCRYPT_ROUNDS: 10,
    PIN_MAX_ATTEMPTS_PER_IP: 5,
    PIN_MAX_ATTEMPTS_PER_IDENTIFIER: 5,
    PIN_RATE_LIMIT_WINDOW_MINUTES: 15,

    SESSION_TIMEOUT_HOURS: 12,
    SESSION_REFRESH_THRESHOLD_MS: 30 * 60 * 1000,

    MAX_EMAIL_LENGTH: 254,
    MAX_NAME_LENGTH: 100,
    MAX_PHONE_LENGTH: 20,
    MAX_PIN_ATTEMPTS_PER_ACCOUNT: 10,

    LOCKOUT_DURATION_MINUTES: 30,
} as const