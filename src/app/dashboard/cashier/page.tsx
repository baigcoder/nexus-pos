'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Banknote, Check, CreditCard, Loader2, ReceiptText, RefreshCw, Smartphone } from 'lucide-react'
import { useAuthStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import { useOrderSubmission } from '@/hooks/use-order-submission'
import { formatTime, getStartOfDay } from '@/lib/format'
import { money, ReviewDialog } from '@/components/service/ServiceOrder'
import type { Order } from '@/types'
import styles from '@/components/service/service-order.module.css'

const methods = [
    { value: 'cash', label: 'Cash', icon: Banknote },
    { value: 'card', label: 'Card', icon: CreditCard },
    { value: 'mobile', label: 'Mobile', icon: Smartphone },
] as const
type Method = (typeof methods)[number]['value']
type Bill = Order & { amount_paid?: number | string | null }
type Shift = { total: number; count: number; byMethod: Record<Method, number> }
type Payment = { number: number; amount: number; method: Method; remaining: number }

function due(bill: Bill) {
    return Math.max(0, Math.round((Number(bill.total) - Number(bill.amount_paid ?? 0)) * 100) / 100)
}

function billContext(bill: Bill) {
    if (bill.table?.table_number != null) return `Table ${bill.table.table_number}`
    if (bill.customer_name) return bill.customer_name
    return bill.order_type === 'delivery' ? 'Delivery' : bill.order_type === 'takeaway' ? 'Takeaway' : 'No table'
}

export default function CashierPage() {
    const { restaurant, staff } = useAuthStore()
    return restaurant ? (
        <Cashier key={restaurant.id} restaurantId={restaurant.id} restaurantName={restaurant.name} currency={restaurant.currency || 'PKR'} staffName={staff?.name} />
    ) : (
        <section className={styles.page}><h1 className={styles.sectionTitle}>Checkout</h1><p className={styles.empty}>Link a restaurant to view the checkout queue.</p></section>
    )
}

function Cashier({ restaurantId, restaurantName, currency, staffName }: {
    restaurantId: string; restaurantName: string; currency: string; staffName?: string
}) {
    const [bills, setBills] = useState<Bill[]>([])
    const [shift, setShift] = useState<Shift | null>(null)
    const [loading, setLoading] = useState(true)
    const [queueError, setQueueError] = useState('')
    const [shiftError, setShiftError] = useState('')
    const [refresh, setRefresh] = useState(0)
    const [selected, setSelected] = useState<string | null>(null)
    const [method, setMethod] = useState<Method | null>(null)
    const [reviewing, setReviewing] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [paymentError, setPaymentError] = useState('')
    const [confirmation, setConfirmation] = useState<Payment | null>(null)
    const inFlight = useRef(false)
    const queueTitle = useRef<HTMLHeadingElement>(null)
    const { submitOrderRequest, completeOrderRequest } = useOrderSubmission()

    useEffect(() => {
        const controller = new AbortController()
        async function load() {
            setLoading(true)
            setQueueError('')
            setShiftError('')
            try {
                const client = createClient()
                const [orders, payments] = await Promise.all([
                    client.from('orders')
                        .select('*, table:tables(id, table_number), items:order_items(*, menu_item:menu_items(name))')
                        .eq('restaurant_id', restaurantId)
                        .in('status', ['served', 'billing', 'ready'])
                        .or('payment_method.is.null,payment_method.neq.cash_on_delivery')
                        .order('created_at', { ascending: true })
                        .abortSignal(controller.signal),
                    client.from('payments').select('amount, method, order:orders!inner(restaurant_id)')
                        .eq('order.restaurant_id', restaurantId).eq('status', 'completed')
                        .gte('created_at', getStartOfDay().toISOString())
                        .abortSignal(controller.signal),
                ])
                if (controller.signal.aborted) return

                if (orders.error) {
                    setQueueError('Couldn’t refresh the checkout queue. Refresh before recording a payment.')
                } else {
                    setBills((orders.data ?? []) as Bill[])
                }

                if (payments.error) {
                    setShiftError('Today’s payment totals are unavailable.')
                } else {
                    const rows = (payments.data ?? []) as { amount: number | string | null; method: string | null }[]
                    const byMethod = { cash: 0, card: 0, mobile: 0 }
                    let total = 0
                    for (const row of rows) {
                        total += Number(row.amount ?? 0)
                        if (row.method === 'cash' || row.method === 'card' || row.method === 'mobile') byMethod[row.method]++
                    }
                    setShift({ total, count: rows.length, byMethod })
                }
            } catch {
                if (!controller.signal.aborted) {
                    setQueueError('Couldn’t refresh the checkout queue. Try again.')
                    setShiftError('Today’s payment totals are unavailable.')
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }
        void load()
        return () => controller.abort()
    }, [restaurantId, refresh])

    const bill = bills.find(order => order.id === selected)
    const billItems = bill?.items?.filter(item => item.kitchen_status !== 'voided') ?? []

    function selectBill(order: Bill) {
        if (inFlight.current) return
        setSelected(order.id)
        setMethod(null)
        setPaymentError('')
        setConfirmation(null)
        if (!window.matchMedia('(min-width: 1024px)').matches) setReviewing(true)
    }

    async function settle() {
        if (!bill || !method || loading || queueError || inFlight.current) return
        inFlight.current = true
        setProcessing(true)
        setPaymentError('')
        try {
            const response = await submitOrderRequest('/api/billing/process-payment', { orderId: bill.id, paymentMethod: method })
            const result = await response.json()
            if (!response.ok || !result.success) throw new Error(result.error || 'Could not record the payment.')
            completeOrderRequest()
            const remaining = Number(result.payment?.remaining_balance ?? 0)
            setConfirmation({
                number: bill.order_number,
                amount: Number(result.payment?.amount_paid ?? due(bill)),
                method,
                remaining,
            })
            if (remaining <= 0) setBills(previous => previous.filter(order => order.id !== bill.id))
            setSelected(null)
            setReviewing(false)
            setMethod(null)
            setRefresh(previous => previous + 1)
            requestAnimationFrame(() => queueTitle.current?.focus())
        } catch (error) {
            setPaymentError(error instanceof Error ? error.message : 'Could not record the payment.')
        } finally {
            inFlight.current = false
            setProcessing(false)
        }
    }

    const receipt = bill && (
        <>
            {billItems.length ? (
                <ul>
                    {billItems.map(item => (
                        <li className={styles.billLine} key={item.id}>
                            <span>{item.quantity}× {item.item_name_snapshot || item.menu_item?.name || 'Item'}</span>
                            <span>{money(Number(item.subtotal), currency)}</span>
                        </li>
                    ))}
                </ul>
            ) : <p className={styles.muted}>Item details are unavailable.</p>}
            <dl className={styles.totals}>
                <div><dt>Order total</dt><dd>{money(Number(bill.total), currency)}</dd></div>
                {Number(bill.amount_paid) > 0 && <div><dt>Already paid</dt><dd>{money(Number(bill.amount_paid), currency)}</dd></div>}
                <div><dt>Amount due</dt><dd>{money(due(bill), currency)}</dd></div>
            </dl>
            <div className={styles.receiptFoot}>
                <p className={styles.muted}>Choose the method used to collect payment.</p>
                <div className={styles.paymentMethods} role="group" aria-label="Payment method">
                    {methods.map(({ value, label, icon: Icon }) => (
                        <button key={value} type="button" className={styles.secondary} aria-pressed={method === value} disabled={processing} onClick={() => setMethod(value)}>
                            <Icon size={19} aria-hidden="true" /> {label}
                        </button>
                    ))}
                </div>
                {paymentError && <p className={styles.error} role="alert">{paymentError}</p>}
                {queueError && <p className={styles.notice}>Refresh the queue to continue.</p>}
                <button type="button" className={styles.primary} disabled={!method || processing || loading || !!queueError} onClick={() => { void settle() }}>
                    {processing ? 'Recording payment…' : `Record ${money(due(bill), currency)} payment`}
                </button>
            </div>
        </>
    )

    return (
        <section className={styles.page} aria-labelledby="checkout-title">
            <header className={styles.stationHead}>
                <div><p className={styles.kicker}>Counter service</p><h1 id="checkout-title">Checkout</h1><p>{restaurantName}{staffName && ` · ${staffName}`}</p></div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" className={styles.secondary} disabled={loading || processing} onClick={() => setRefresh(previous => previous + 1)}><RefreshCw size={17} aria-hidden="true" /> Refresh</button>
                    <Link className={styles.secondary} href="/dashboard/billing">Detailed billing <ArrowUpRight size={16} aria-hidden="true" /></Link>
                </div>
            </header>
            {confirmation && (
                <p className={`${styles.success} mb-3`} role="status">
                    <Check size={18} aria-hidden="true" />
                    {money(confirmation.amount, currency)} recorded by {confirmation.method} for order #{confirmation.number}.
                    {confirmation.remaining > 0 && ` ${money(confirmation.remaining, currency)} remains due.`}
                </p>
            )}
            {shiftError && <p className={`${styles.notice} mb-3`}>{shiftError}</p>}
            <dl className={styles.shiftStats} aria-label="Today’s payments">
                <div><dt>Collected today</dt><dd>{!shiftError && shift ? money(shift.total, currency) : '—'}</dd></div>
                <div><dt>Payments today</dt><dd>{!shiftError && shift ? shift.count : '—'}</dd></div>
                {methods.map(({ value, label }) => <div key={value}><dt>{label}</dt><dd>{!shiftError && shift ? shift.byMethod[value] : '—'}</dd></div>)}
            </dl>
            <div className={styles.split}>
                <section className={styles.panel} aria-labelledby="unpaid-bills" aria-busy={loading}>
                    <header className={styles.panelHead}>
                        <div><h2 id="unpaid-bills" ref={queueTitle} tabIndex={-1}>Unpaid bills</h2><p>{bills.length} {bills.length === 1 ? 'order' : 'orders'} waiting for checkout</p></div>
                        <ReceiptText size={20} aria-hidden="true" />
                    </header>
                    {queueError && <p className={`${styles.error} m-3`} role="alert">{queueError}</p>}
                    {bills.map(order => (
                        <button key={order.id} type="button" className={styles.queueButton} aria-pressed={selected === order.id} disabled={processing} onClick={() => selectBill(order)}>
                            <span><strong>Order #{order.order_number}</strong><small>{billContext(order)} · {formatTime(order.created_at)}</small></span>
                            <span className={styles.amount}>{money(due(order), currency)} due</span>
                        </button>
                    ))}
                    {!bills.length && (
                        <p className={styles.empty} role={loading ? 'status' : undefined}>
                            {loading ? <><Loader2 size={18} className="motion-safe:animate-spin" aria-hidden="true" /> Loading bills…</> : queueError ? 'Refresh the queue to try again.' : 'The checkout queue is clear.'}
                        </p>
                    )}
                </section>

                <aside className={`${styles.panel} ${styles.receipt} ${styles.desktopReceipt}`} aria-label="Selected bill">
                    <header className={styles.panelHead}><div><h2>{bill ? `Order #${bill.order_number}` : 'Payment receipt'}</h2><p>{bill ? billContext(bill) : 'Select an unpaid bill'}</p></div><ReceiptText size={19} aria-hidden="true" /></header>
                    <div className={styles.panelBody}>{receipt || <p className={styles.empty}>The order and amount due will appear here.</p>}</div>
                </aside>
            </div>
            {reviewing && bill && <ReviewDialog title={`Order #${bill.order_number}`} subtitle={billContext(bill)} busy={processing} onClose={() => setReviewing(false)}>{receipt}</ReviewDialog>}
        </section>
    )
}
