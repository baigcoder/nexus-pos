'use client'

import { useCallback, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Phone, ReceiptText, RefreshCw, Star } from 'lucide-react'
import { GuestMasthead, GuestMessage, ProgressList, readOrderToken, useGuestTracking } from '@/components/service/GuestJourney'
import { money } from '@/components/service/ServiceOrder'
import { formatTime } from '@/lib/format'
import styles from '@/components/service/service-order.module.css'
import journey from '@/components/service/guest-journey.module.css'

type Status = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled'
type Order = {
    id: string; order_number: number; status: Status; order_type?: string; total: number
    table?: { table_number: string | number } | null
    items: { id: string; name: string; quantity: number; subtotal: number; variant?: string | null; special_instructions?: string | null; kitchen_status?: string }[]
    restaurant: { name: string; logo_url?: string | null; phone?: string | null; currency?: string }
}

const steps = ['Received', 'In prep', 'Ready', 'Handoff']
const statusInfo: Record<Status, { title: string; description: string; step: number }> = {
    pending: { title: 'Order received', description: 'Your order is in the kitchen queue.', step: 0 },
    confirmed: { title: 'Order confirmed', description: 'The restaurant has confirmed your order.', step: 0 },
    preparing: { title: 'In prep', description: 'The kitchen is preparing your order.', step: 1 },
    ready: { title: 'Order ready', description: 'Your order is ready at the restaurant.', step: 2 },
    served: { title: 'Order served', description: 'Your order has been handed off.', step: 3 },
    paid: { title: 'Paid', description: 'Payment has been recorded for this order.', step: 3 },
    cancelled: { title: 'Order cancelled', description: 'Contact the restaurant if you have questions about this order.', step: -1 },
}

function final(order: Order) {
    return ['served', 'paid', 'cancelled'].includes(order.status)
}

export default function OrderStatusPage() {
    const { orderId } = useParams<{ orderId: string }>()
    return <OrderTracking key={orderId} orderId={orderId} />
}

function OrderTracking({ orderId }: { orderId: string }) {
    const parse = useCallback((body: unknown) => {
        const order = (body as { order?: Order } | null)?.order
        return order?.id === orderId ? order : null
    }, [orderId])
    const { data: order, error, loading, refreshing, updated, refresh } = useGuestTracking('/api/v1/orders', parse, final, 8000)

    if (loading) return <GuestMessage label="Order status" title="Loading your order" loading />
    if (!order) return <GuestMessage label="Order status" title="Order unavailable" message={error} retry={refresh} />
    const info = statusInfo[order.status]
    const readyNote = order.status === 'ready' && order.order_type === 'takeaway' ? 'Your order is ready for pickup at the counter.' : info?.description
    const currency = order.restaurant?.currency || 'PKR'
    const lines = (order.items ?? []).filter(item => item.kitchen_status !== 'voided')

    return (
        <main className={`${styles.page} ${styles.guestTheme}`}>
            <GuestMasthead title={order.restaurant?.name || 'Your order'} logo={order.restaurant?.logo_url} label="Order status">
                <span className={styles.contextTag}><ReceiptText size={16} aria-hidden="true" /> Order #{order.order_number}{order.table?.table_number != null && ` · Table ${order.table.table_number}`}</span>
            </GuestMasthead>
            <div className={`${styles.wrap} ${journey.content} ${journey.twoColumns}`}>
                <div className={journey.stack}>
                    <section className={`${styles.panel} ${styles.receipt}`}>
                        <div className={journey.statusHead} role="status">
                            <p className={styles.kicker}>Kitchen ticket #{order.order_number}</p>
                            <h2>{info?.title || 'Order status'}</h2>
                            <p>{readyNote || 'The restaurant is updating this order.'}</p>
                        </div>
                        {order.status !== 'cancelled' && info && <div className={styles.panelBody}><ProgressList steps={steps} current={info.step} complete={final(order)} /></div>}
                        <div className={journey.toolbar}>
                            <span>{updated && `Updated ${formatTime(updated)}`}</span>
                            <button type="button" className={styles.secondary} disabled={refreshing} onClick={refresh}><RefreshCw size={16} aria-hidden="true" /> {refreshing ? 'Refreshing…' : 'Refresh'}</button>
                        </div>
                    </section>
                    {error && <p className={styles.notice} role="status">{error} Showing the last update.</p>}
                    <GuestFeedback key={order.id} orderId={order.id} />
                </div>
                <section className={styles.panel}>
                    <header className={styles.panelHead}><div><h2>Order receipt</h2><p>#{order.order_number}</p></div><ReceiptText size={20} aria-hidden="true" /></header>
                    <div className={styles.panelBody}>
                        {lines.length > 0 && <ul>{lines.map(item => <li key={item.id} className={styles.billLine}>
                            <span>{item.quantity}× {item.name || 'Item'}{item.variant && <small className="block">{item.variant}</small>}{item.special_instructions && <small className="block">{item.special_instructions}</small>}</span>
                            <span>{money(Number(item.subtotal), currency)}</span>
                        </li>)}</ul>}
                        <dl className={styles.totals}><div><dt>Order total</dt><dd>{money(Number(order.total), currency)}</dd></div></dl>
                        {order.restaurant?.phone && <div className={journey.actions}><a className={styles.secondary} href={`tel:${order.restaurant.phone}`}><Phone size={16} aria-hidden="true" /> Call restaurant</a></div>}
                    </div>
                </section>
            </div>
        </main>
    )
}

function GuestFeedback({ orderId }: { orderId: string }) {
    const [rating, setRating] = useState(0)
    const [comment, setComment] = useState('')
    const [error, setError] = useState('')
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const busy = useRef(false)

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        if (!rating || busy.current) return
        const token = readOrderToken()
        if (!token) {
            setError('Open your secure order link to send feedback.')
            return
        }
        busy.current = true
        setSending(true)
        setError('')
        try {
            const response = await fetch('/api/v1/feedback', {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ order_id: orderId, overall_rating: rating, comment }),
            })
            if (!response.ok) {
                const body = await response.json().catch(() => null)
                throw new Error(body?.error || 'Could not save your review.')
            }
            setSent(true)
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Could not save your review.')
        } finally {
            busy.current = false
            setSending(false)
        }
    }

    return (
        <section className={styles.panel} aria-labelledby="guest-feedback">
            <header className={styles.panelHead}><div><h2 id="guest-feedback">Rate your visit</h2></div></header>
            <div className={styles.panelBody}>
                {sent ? <p className={styles.success} role="status">Thanks for your feedback.</p> : (
                    <form onSubmit={submit} className={journey.feedback}>
                        <div className={journey.choices} role="group" aria-label="Rating out of five">
                            {[1, 2, 3, 4, 5].map(value => (
                                <button key={value} className={styles.secondary} type="button" aria-pressed={rating === value} aria-label={`${value} out of 5 stars`} disabled={sending} onClick={() => setRating(value)}>
                                    <Star size={15} fill={value <= rating ? 'currentColor' : 'none'} aria-hidden="true" /> {value}
                                </button>
                            ))}
                        </div>
                        <label className={styles.field}>Comment (optional)<textarea value={comment} rows={2} maxLength={1000} disabled={sending} onChange={event => setComment(event.target.value)} /></label>
                        {error && <p className={styles.error} role="alert">{error}</p>}
                        <button className={styles.secondary} type="submit" disabled={!rating || sending}>{sending ? 'Sending…' : 'Send feedback'}</button>
                    </form>
                )}
            </div>
        </section>
    )
}
