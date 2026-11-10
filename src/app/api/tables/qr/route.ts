import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireManagerOrOwner, tenantMismatchResponse } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTableQrSecret, issueTableQrToken } from '@/lib/table-qr'

const headers = { 'Cache-Control': 'private, no-store' }
const columns = 'id, table_number, capacity, is_qr_active, qr_order_version'
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

function tableWithLink(table: {
    id: string; table_number: string; capacity?: number; is_qr_active?: boolean; qr_order_version: string
}, restaurant: { id: string; slug: string }, origin: string, secret: string) {
    const { qr_order_version, ...publicTable } = table
    if (table.is_qr_active === false) return { ...publicTable, order_url: null }

    const url = new URL('/order', process.env.NEXT_PUBLIC_APP_URL || origin)
    url.searchParams.set('restaurant', restaurant.slug)
    url.searchParams.set('table', table.table_number)
    url.hash = `qr=${issueTableQrToken(restaurant.id, table.id, qr_order_version, secret)}`
    return { ...publicTable, order_url: url.href }
}

export async function GET(request: NextRequest) {
    try {
        const { auth, response } = await requireManagerOrOwner()(request)
        if (response) return response
        const restaurantId = request.nextUrl.searchParams.get('restaurant_id')
        if (restaurantId !== null && restaurantId !== auth.restaurantId) return tenantMismatchResponse()

        const secret = getTableQrSecret()
        if (!secret) return fail('Table QR credentials are unavailable', 503)
        const supabase = createAdminClient()
        const { data: restaurant, error: restaurantError } = await supabase.from('restaurants')
            .select('id, slug').eq('id', auth.restaurantId).maybeSingle()
        if (restaurantError) throw restaurantError
        if (!restaurant) return fail('Restaurant not found', 404)

        const { data, error } = await supabase.from('tables').select(columns)
            .eq('restaurant_id', auth.restaurantId).order('table_number')
        if (error) throw error
        return NextResponse.json({
            tables: (data ?? []).map(table => tableWithLink(table, restaurant, request.nextUrl.origin, secret)),
        }, { headers })
    } catch (error) {
        console.error('Table QR list failed:', error)
        return fail('Could not load table QR codes', 500)
    }
}

export async function PATCH(request: NextRequest) {
    if (request.headers.get('origin') !== request.nextUrl.origin) return fail('Invalid request origin', 403)
    try {
        const { auth, response } = await requireManagerOrOwner()(request)
        if (response) return response
        const body = await request.json().catch(() => null)
        if (!body || typeof body.tableId !== 'string' || !uuid.test(body.tableId) ||
            (body.action !== 'rotate' && (body.action !== 'set_enabled' || typeof body.enabled !== 'boolean'))) {
            return fail('Invalid table QR action', 400)
        }
        if (body.restaurant_id !== undefined && body.restaurant_id !== auth.restaurantId) return tenantMismatchResponse()

        const secret = getTableQrSecret()
        if (!secret) return fail('Table QR credentials are unavailable', 503)
        const supabase = createAdminClient()
        const { data: restaurant, error: restaurantError } = await supabase.from('restaurants')
            .select('id, slug').eq('id', auth.restaurantId).maybeSingle()
        if (restaurantError) throw restaurantError
        if (!restaurant) return fail('Restaurant not found', 404)

        const update = body.action === 'rotate' ? { qr_order_version: randomUUID() } : { is_qr_active: body.enabled }
        const { data, error } = await supabase.from('tables').update(update)
            .eq('id', body.tableId).eq('restaurant_id', auth.restaurantId).select(columns).maybeSingle()
        if (error) throw error
        if (!data) return fail('Table not found', 404)

        return NextResponse.json({ table: tableWithLink(data, restaurant, request.nextUrl.origin, secret) }, { headers })
    } catch (error) {
        console.error('Table QR update failed:', error)
        return fail('Could not update table QR', 500)
    }
}
