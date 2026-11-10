import { NextRequest, NextResponse } from 'next/server'
import { requireCashierOrAbove } from '@/lib/api-auth'
import { sanitizeErrorMessage } from '@/lib/auth'
import { OrderService } from '@/lib/services/order-service'

const VALID_PAYMENT_METHODS = ['cash', 'card', 'mobile', 'split'] as const
type PaymentMethod = typeof VALID_PAYMENT_METHODS[number]

interface PaymentRequest {
    orderId: string
    paymentMethod: PaymentMethod
    amount?: number
    cashReceived?: number
    tip?: number
    discount?: number
    is_split?: boolean
    splitPayments?: Array<{
        split_number?: number
        method: PaymentMethod
        amount: number
        items?: any[]
    }>
}

export async function POST(request: NextRequest) {
    try {
        const { auth, response } = await requireCashierOrAbove()(request)
        if (response) return response
        if (!auth) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        let body: unknown
        try {
            body = await request.json()
        } catch {
            return NextResponse.json(
                { success: false, error: 'Invalid request body' },
                { status: 400 }
            )
        }

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
        }

        const {
            orderId,
            paymentMethod,
            amount,
            cashReceived,
            tip,
            discount,
            is_split,
            splitPayments,
        } = body as PaymentRequest

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

        const payment = await OrderService.settlePaymentAtomic({
            order_id: orderId,
            restaurant_id: auth.restaurantId,
            request_key: request.headers.get('idempotency-key'),
            staff_id: auth.staffId,
            payment_method: paymentMethod,
            amount,
            cash_received: cashReceived,
            tip,
            discount,
            is_split: is_split || paymentMethod === 'split',
            split_payments: splitPayments,
        })

        if (!payment.success) {
            const status = payment.code === 'conflict' ? 409 : payment.code === 'not_found' ? 404 :
                payment.code === 'internal' ? 500 : 400
            return NextResponse.json({ success: false, error: payment.error }, { status })
        }

        return NextResponse.json({ success: true, payment })
    } catch (error: unknown) {
        console.error('[PROCESS_PAYMENT] Error:', error instanceof Error ? error.message : 'Unknown error')
        return NextResponse.json(
            { success: false, error: sanitizeErrorMessage(error) },
            { status: 500 }
        )
    }
}
