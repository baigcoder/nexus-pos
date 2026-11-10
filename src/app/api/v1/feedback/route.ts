import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimitPersistent, getClientIp } from '@/lib/auth'
import { verifyOrderAccessToken } from '@/lib/order-access'

export async function POST(request: NextRequest) {
    const authorizedOrderId = verifyOrderAccessToken(request.headers.get('authorization'))
    if (!authorizedOrderId) {
        return NextResponse.json({ error: 'A valid order link is required' }, { status: 401 })
    }

    const rate = await checkRateLimitPersistent(`feedback:${getClientIp(request)}`, { maxRequests: 10, windowMs: 60 * 60 * 1000 })
    if (!rate.allowed) {
        return NextResponse.json({ error: 'Too many reviews. Try again later.' }, { status: 429 })
    }

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const orderId = typeof body.order_id === 'string' ? body.order_id : ''
    const rating = Number(body.overall_rating)
    const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : null
    const customerName = typeof body.customer_name === 'string' ? body.customer_name.trim().slice(0, 80) : null

    if (orderId !== authorizedOrderId) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'order_id and a 1-5 rating are required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: order } = await supabase
        .from('orders')
        .select('id, restaurant_id, order_number')
        .eq('id', orderId)
        .maybeSingle()

    if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { error } = await supabase.from('feedback').insert({
        restaurant_id: order.restaurant_id,
        order_id: order.id,
        order_number: order.order_number,
        overall_rating: rating,
        comment,
        customer_name: customerName,
    })

    if (error) {
        return NextResponse.json({ error: 'Unable to save feedback' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
