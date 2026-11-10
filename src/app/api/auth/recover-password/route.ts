import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const headers = { 'Cache-Control': 'private, no-store' }
const reply = (status: number, body: object) => NextResponse.json(body, { status, headers })

export async function POST(request: NextRequest) {
    if (request.headers.get('origin') !== request.nextUrl.origin) {
        return reply(403, { error: 'Invalid request origin.' })
    }

    const body = await request.json().catch(() => null)
    const tokenHash = body?.tokenHash
    const password = body?.password
    if (typeof tokenHash !== 'string' || !/^[\w-]{20,512}$/.test(tokenHash)) {
        return reply(400, { error: 'Request a new password reset link.' })
    }
    if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
        return reply(400, { error: 'Use at least 12 characters and no more than 72 bytes.' })
    }

    try {
        const supabase = await createClient()
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        if (error || !data.session) {
            return reply(400, { error: 'This link is invalid, expired, or already used. Request a new link.' })
        }

        let updated = false
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password })
            if (updateError) {
                return reply(400, { error: 'Password could not be changed. Request a new link and try a different password.' })
            }
            updated = true
            return reply(200, { success: true })
        } finally {
            try {
                const { error: signOutError } = await supabase.auth.signOut({ scope: updated ? 'global' : 'local' })
                if (signOutError) console.error('Could not end the recovery session', signOutError.status)
            } catch {
                console.error('Recovery session sign-out failed')
            }
        }
    } catch {
        return reply(500, { error: 'Password recovery is temporarily unavailable.' })
    }
}
