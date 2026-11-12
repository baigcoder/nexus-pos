import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCashierOrAbove } from '@/lib/api-auth'
import { sanitizeErrorMessage } from '@/lib/auth'

const VALID_PAYMENT_METHODS = ['cash', 'card', 'mobile', 'split'] as const
type PaymentMethod = typeof VALID_PAYMENT_METHODS[number]

interface PaymentRequest {
    orderId: string
    paymentMethod: PaymentMethod
    cashReceived?: number
    tip?: number
    discount?: number
    splitPayments?: Array<{
        method: PaymentMethod
        amount: number
    }>
}

export async function POST(request: NextRequest) {
    try {
        const { auth, response } = await requireCashierOrAbove()(request)
        if (response) return response

        const supabase = createAdminClient()

        let body: unknown
        try {
            body = await request.json()
        } catch {
            return NextResponse.json(
                { success: false, error: 'Invalid request body' },
                { status: 400 }
            )
        }

        const { orderId, paymentMethod, cashReceived, tip, discount, splitPayments } = body as PaymentRequest

        if (!orderId || typeof orderId !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Order ID is required' },
                { status: 400 }
            )
        }

        if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
            return NextResponse.json(
                { success: false, error: `Payment method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}` },
                { status: 400 }
            )
        }

        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('id, status, total, subtotal, tax, restaurant_id')
            .eq('id', orderId)
            .eq('restaurant_id', auth!.restaurantId)
            .single()

        if (fetchError || !order) {
            return NextResponse.json(
                { success: false, error: 'Order not found' },
                { status: 404 }
            )
        }

        const payableStatuses = ['pending', 'preparing', 'ready', 'served']
        if (!payableStatuses.includes(order.status)) {
            return NextResponse.json(
                { success: false, error: `Order cannot be paid in status: ${order.status}` },
                { status: 400 }
            )
        }

        if (paymentMethod === 'cash' && cashReceived !== undefined && cashReceived < order.total) {
            return NextResponse.json(
                { success: false, error: 'Cash received is less than order total' },
                { status: 400 }
            )
        }

        const updateData: Record<string, unknown> = {
            status: 'paid',
            payment_method: paymentMethod,
            paid_at: new Date().toISOString(),
        }

        if (tip !== undefined && tip > 0) {
            updateData.tip = tip
        }

        if (discount !== undefined && discount > 0) {
            updateData.discount = discount
        }

        if (cashReceived !== undefined) {
            updateData.cash_received = cashReceived
            updateData.change_amount = Math.max(0, cashReceived - order.total - (tip || 0))
        }

        const { data: updatedOrder, error: updateError } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId)
            .in('status', payableStatuses) // guards against a double-tap paying twice
            .select()
            .single()

        if (updateError) {
            console.error('[PROCESS_PAYMENT] Update error:', updateError.message)
            return NextResponse.json(
                { success: false, error: 'Failed to process payment' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            order: {
                id: updatedOrder.id,
                order_number: updatedOrder.order_number,
                status: updatedOrder.status,
                total: updatedOrder.total,
                payment_method: updatedOrder.payment_method,
                paid_at: updatedOrder.paid_at,
                change_amount: updatedOrder.change_amount,
            },
        })
    } catch (error: unknown) {
        console.error('[PROCESS_PAYMENT] Error:', error instanceof Error ? error.message : 'Unknown error')
        return NextResponse.json(
            { success: false, error: sanitizeErrorMessage(error) },
            { status: 500 }
        )
    }
}