import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireManagerOrOwner } from '@/lib/api-auth'
import { checkRateLimitPersistent, getClientIp } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const cookie = 'nexus_display_device'
const maxAge = 30 * 24 * 60 * 60
const headers = { 'Cache-Control': 'private, no-store' }
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const slugPattern = /^[a-z0-9][a-z0-9-]{0,99}$/
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const deviceToken = (request: NextRequest) => {
    const token = request.cookies.get(cookie)?.value
    return token && /^[\w-]{43}$/.test(token) ? token : null
}
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

function safeMediaUrl(value: string | null) {
    if (!value) return null
    try {
        const url = new URL(value)
        return url.protocol === 'https:' ? url.href : null
    } catch {
        return null
    }
}

export async function GET(request: NextRequest) {
    try {
        const slug = request.nextUrl.searchParams.get('slug') ?? ''
        if (!slugPattern.test(slug)) return fail('Invalid display slug', 400)

        const supabase = createAdminClient()
        const token = deviceToken(request)
        const preview = request.nextUrl.searchParams.get('preview') === '1'
        let displayQuery = supabase.from('displays')
            .select('id, restaurant_id, name, slug, type, template, settings')
            .eq('slug', slug).eq('is_active', true)

        if (token && !preview) {
            const { data: displayId, error } = await supabase.rpc('active_display_device', { p_session_hash: hash(token) })
            if (error) throw error
            if (!displayId) return fail('Pair this device first', 401)
            displayQuery = displayQuery.eq('id', displayId)
        } else if (preview) {
            const { auth, response } = await requireManagerOrOwner()(request)
            if (response) return response
            displayQuery = displayQuery.eq('restaurant_id', auth.restaurantId)
        } else {
            return fail('Pair this device first', 401)
        }

        const { data: display, error: displayError } = await displayQuery.maybeSingle()
        if (displayError) throw displayError
        if (!display) return fail('Display unavailable', 404)

        const { data: restaurant, error: restaurantError } = await supabase.from('restaurants')
            .select('id, name, slug, logo_url, currency')
            .eq('id', display.restaurant_id).eq('is_active', true).maybeSingle()
        if (restaurantError) throw restaurantError
        if (!restaurant) return fail('Display unavailable', 404)

        let orders: unknown[] = []
        let ads: unknown[] = []
        if (display.type === 'kitchen') {
            const { data, error } = await supabase.from('orders')
                .select('id, order_number, status, created_at, is_priority, items:order_items(quantity, item_name_snapshot, special_instructions, kitchen_status, modifiers:order_item_modifiers(modifier_name_snapshot))')
                .eq('restaurant_id', restaurant.id).in('status', ['pending', 'preparing'])
                .order('created_at', { ascending: true }).limit(100)
            if (error) throw error
            orders = (data ?? []).map(order => ({
                ...order, items: (order.items ?? []).filter((item: { kitchen_status?: string }) => item.kitchen_status !== 'voided'),
            }))
        } else if (display.type === 'advertisement' || display.type === 'waiting') {
            const { data, error } = await supabase.from('ad_content')
                .select('id, title, description, media_url, media_type, duration_seconds, display_order, background_color, text_color, cta_text, cta_url, schedule_start, schedule_end')
                .eq('restaurant_id', restaurant.id).eq('is_active', true)
                .or(`display_id.eq.${display.id},display_id.is.null`)
                .order('display_order').order('id').limit(100)
            if (error) throw error
            const now = Date.now()
            ads = (data ?? []).filter(ad =>
                (!ad.schedule_start || Date.parse(ad.schedule_start) <= now) &&
                (!ad.schedule_end || Date.parse(ad.schedule_end) > now)
            ).map(ad => ({ ...ad, media_url: safeMediaUrl(ad.media_url), cta_url: safeMediaUrl(ad.cta_url) }))
        } else if (display.type === 'counter' || display.type === 'cashier' || display.type === 'bar') {
            const { data, error } = await supabase.from('orders')
                .select('order_number')
                .eq('restaurant_id', restaurant.id).eq('status', 'ready')
                .order('created_at', { ascending: false }).limit(30)
            if (error) throw error
            orders = data ?? []
        }

        return NextResponse.json({
            display, restaurant, orders, ads, canChangeOrders: Boolean(token && !preview && display.type === 'kitchen'),
        }, { headers })
    } catch (error) {
        console.error('Display manifest failed:', error)
        return fail('Could not load display', 500)
    }
}

export async function POST(request: NextRequest) {
    if (request.headers.get('origin') !== request.nextUrl.origin) return fail('Invalid request origin', 403)

    try {
        const body = await request.json().catch(() => null)
        const action = body?.action
        const supabase = createAdminClient()

        if (action === 'redeem') {
            if (typeof body.slug !== 'string' || !slugPattern.test(body.slug) ||
                typeof body.code !== 'string' || !/^[\w-]{22}$/.test(body.code)) {
                return fail('Invalid display slug or pairing code', 400)
            }
            const rate = await checkRateLimitPersistent(`display_pair:${getClientIp(request)}`, {
                maxRequests: 15, windowMs: 60_000,
            })
            if (!rate.allowed) return fail('Too many pairing attempts', 429)

            const token = randomBytes(32).toString('base64url')
            const { data, error } = await supabase.rpc('redeem_display_pairing', {
                p_code_hash: hash(body.code), p_slug: body.slug, p_session_hash: hash(token),
            })
            if (error) throw error
            if (!data) return fail('Pairing code is invalid, expired, or already used', 401)
            const response = NextResponse.json(data, { headers })
            response.cookies.set(cookie, token, {
                httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
                path: '/api/display/device', maxAge,
            })
            return response
        }

        if (action === 'transition') {
            const token = deviceToken(request)
            if (!token) return fail('Pair this device first', 401)
            if (typeof body.slug !== 'string' || !slugPattern.test(body.slug) ||
                typeof body.orderId !== 'string' || !uuid.test(body.orderId) ||
                !['preparing', 'ready'].includes(body.status)) return fail('Invalid kitchen command', 400)

            const { data, error } = await supabase.rpc('display_device_order_transition', {
                p_session_hash: hash(token), p_slug: body.slug, p_order_id: body.orderId, p_target: body.status,
            })
            if (error) throw error
            if (!data.success) {
                const status = data.code === 'unauthorized' ? 401 : data.code === 'forbidden' ? 403 :
                    data.code === 'not_found' ? 404 : 409
                return fail(data.error || 'Could not update order', status)
            }
            return NextResponse.json(data, { headers })
        }

        if (action !== 'issue' && action !== 'revoke') return fail('Invalid display action', 400)
        const { auth, response } = await requireManagerOrOwner()(request)
        if (response) return response
        if (typeof body.displayId !== 'string' || !uuid.test(body.displayId)) return fail('Invalid display ID', 400)

        const { data: display, error: displayError } = await supabase.from('displays')
            .select('id, slug, is_active')
            .eq('id', body.displayId).eq('restaurant_id', auth.restaurantId).maybeSingle()
        if (displayError) throw displayError
        if (!display) return fail('Display not found', 404)

        if (action === 'revoke') {
            const { error } = await supabase.from('display_device_sessions').update({ revoked_at: new Date().toISOString() })
                .eq('display_id', display.id).is('revoked_at', null)
            if (error) throw error
            return NextResponse.json({ success: true }, { headers })
        }
        if (!display.is_active) return fail('Enable this display before pairing', 409)

        const code = randomBytes(16).toString('base64url')
        const { data: issued, error } = await supabase.rpc('issue_display_pairing', {
            p_restaurant_id: auth.restaurantId, p_display_id: display.id,
            p_staff_id: auth.staffId, p_code_hash: hash(code),
        })
        if (error) throw error
        if (!issued) return fail('Display is unavailable for pairing', 409)
        return NextResponse.json({ code, slug: display.slug }, { status: 201, headers })
    } catch (error) {
        console.error('Display device command failed:', error)
        return fail('Could not complete display action', 500)
    }
}
