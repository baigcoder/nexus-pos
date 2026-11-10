import { NextRequest, NextResponse } from 'next/server.js'
import { createAdminClient } from './supabase/admin.ts'
import crypto from 'crypto'

export interface IdempotencyResult<T> {
    isReplay: boolean
    status: number
    body: T
}

/**
 * Generates a SHA-256 hash for an idempotency key scoped to the request path
 */
export function hashIdempotencyKey(key: string, path: string): string {
    return crypto
        .createHash('sha256')
        .update(`${path}:${key}`)
        .digest('hex')
}

/**
 * Checks if an idempotent request was already processed.
 * If yes, returns the cached response.
 * If no, executes the operation and caches the response.
 */
export async function withIdempotency(
    request: NextRequest,
    restaurantId: string,
    handler: () => Promise<NextResponse>
): Promise<NextResponse> {
    const rawKey = request.headers.get('idempotency-key') || request.headers.get('x-idempotency-key')

    // If no key is provided, bypass idempotency
    if (!rawKey || !rawKey.trim()) {
        return handler()
    }

    const key = rawKey.trim()
    const path = request.nextUrl.pathname
    const keyHash = hashIdempotencyKey(key, path)
    const supabase = createAdminClient()

    try {
        // 1. Look up existing cached response
        const { data: cached, error: lookupError } = await supabase
            .from('idempotency_keys')
            .select('response_status, response_body, expires_at')
            .eq('restaurant_id', restaurantId)
            .eq('key_hash', keyHash)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle()

        if (!lookupError && cached && cached.response_body) {
            return NextResponse.json(cached.response_body, {
                status: cached.response_status || 200,
                headers: {
                    'X-Idempotency-Replay': 'true',
                    'Access-Control-Allow-Origin': '*',
                },
            })
        }

        // 2. Execute original handler
        const response = await handler()

        // 3. Cache response if it was successful or a controlled client error (< 500)
        if (response.status < 500) {
            try {
                // Clone response to read body without consuming original stream
                const cloned = response.clone()
                const body = await cloned.json()

                await supabase.from('idempotency_keys').upsert({
                    restaurant_id: restaurantId,
                    key_hash: keyHash,
                    request_path: path,
                    response_status: response.status,
                    response_body: body,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                }, { onConflict: 'restaurant_id,key_hash' })
            } catch (cacheErr) {
                console.error('[Idempotency] Failed to cache response:', cacheErr)
            }
        }

        return response
    } catch (err) {
        console.error('[Idempotency] Request failed:', err)
        throw err
    }
}

