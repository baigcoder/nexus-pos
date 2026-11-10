'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, ChefHat, ClipboardList, LayoutGrid, List, Plus, ReceiptText, RefreshCw, Truck } from 'lucide-react'
import { useAllOrders } from '@/hooks/useRealtimeOrders'
import { hasPermission, useAuthStore, useOrderStore } from '@/stores'
import { formatShortDate, formatTime } from '@/lib/format'
import { money, ReviewDialog, SearchField } from './ServiceOrder'
import type { Order } from '@/types'
import styles from './service-order.module.css'
import ops from './operations.module.css'

const orderStates = {
    pending: 'Received', preparing: 'In prep', ready: 'Ready', served: 'Served', billing: 'At checkout', paid: 'Paid', cancelled: 'Cancelled',
} as const
type State = keyof typeof orderStates
type Filter = State | 'all' | 'active'
type Source = 'website' | 'call' | 'whatsapp' | 'pos' | 'qr' | 'unknown'
const sources: Record<Source, string> = {
    website: 'Website', call: 'Phone', whatsapp: 'WhatsApp', pos: 'Counter', qr: 'Table QR', unknown: 'Unspecified',
}
const activeStates: State[] = ['pending', 'preparing', 'ready', 'served', 'billing']
const transitions = {
    pending: { action: 'kitchen_start', label: 'Start prep', next: 'preparing' },
    preparing: { action: 'kitchen_ready', label: 'Mark ready', next: 'ready' },
    ready: { action: 'serve_order', label: 'Mark served', next: 'served' },
} as const
type Transition = (typeof transitions)[keyof typeof transitions]

function orderSource(order: Order): Source {
    switch (order.source?.toLowerCase()) {
        case 'online_storefront': case 'website': return 'website'
        case 'phone': case 'call': return 'call'
        case 'whatsapp': return 'whatsapp'
        case 'pos': case 'walkin': return 'pos'
        case 'qr': case 'table_qr': case 'qr_ordering': return 'qr'
        default: return 'unknown'
    }
}

function fulfillment(order: Order) {
    if (order.order_type === 'delivery') return 'Delivery'
    if (order.order_type === 'takeaway') return 'Pickup'
    return 'Dine-in'
}

function context(order: Order) {
    return order.table?.table_number != null ? `Table ${order.table.table_number}` : fulfillment(order)
}

function Status({ state }: { state: string }) {
    return <span className={ops.status} data-state={state}>{orderStates[state as State] ?? state}</span>
}

export default function OrderWorkspace({ desk = false }: { desk?: boolean }) {
    const restaurantId = useAuthStore(state => state.restaurant?.id)
    return <Workspace key={restaurantId} desk={desk} />
}

function Workspace({ desk }: { desk: boolean }) {
    const { restaurant, userRole } = useAuthStore()
    const { orders: loadedOrders, isLoading, error: loadError, refresh } = useAllOrders()
    const updateStatus = useOrderStore(state => state.updateOrderStatus)
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState<Filter>(desk ? 'active' : 'all')
    const [channel, setChannel] = useState<Source | 'all'>('all')
    const [orderType, setOrderType] = useState('all')
    const [view, setView] = useState<'list' | 'board'>('list')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [dialog, setDialog] = useState(false)
    const [pendingId, setPendingId] = useState<string | null>(null)
    const [notice, setNotice] = useState('')
    const [error, setError] = useState('')
    const running = useRef(false)
    const currency = restaurant?.currency || 'PKR'

    const orders = loadedOrders.filter(order => order.restaurant_id === restaurant?.id)
    const selected = orders.find(order => order.id === selectedId)
    const needle = query.trim().replace(/^#/, '').toLowerCase()
    const filtered = orders.filter(order => {
        const matchesSearch = !needle || [String(order.order_number), context(order), order.customer_name, order.customer_phone]
            .some(value => value?.toLowerCase().includes(needle))
        const matchesState = filter === 'all' || (filter === 'active' ? activeStates.includes(order.status) : order.status === filter)
        return matchesSearch && matchesState && (orderType === 'all' || fulfillment(order) === orderType)
            && (channel === 'all' || orderSource(order) === channel)
    })
    const counts = [
        { label: 'Received', value: orders.filter(order => order.status === 'pending').length },
        { label: 'In prep', value: orders.filter(order => order.status === 'preparing').length },
        { label: 'Ready', value: orders.filter(order => order.status === 'ready').length },
        { label: 'Orders loaded', value: orders.length },
    ]

    function open(order: Order) {
        setSelectedId(order.id)
        if (!window.matchMedia('(min-width: 1220px)').matches) setDialog(true)
    }

    function close() {
        setDialog(false)
        setSelectedId(null)
    }

    function nextStep(order: Order) {
        if (order.status === 'ready' && order.order_type === 'delivery') return undefined
        const transition = transitions[order.status as keyof typeof transitions]
        if (!transition) return undefined
        return hasPermission(userRole, 'order:kitchen_update') ||
            (transition.action !== 'kitchen_ready' && hasPermission(userRole, 'order:manage')) ? transition : undefined
    }

    async function advance(order: Order, transition: Transition) {
        if (running.current || loadError || !nextStep(order)) return
        running.current = true
        setPendingId(order.id)
        setError('')
        setNotice('')
        try {
            const response = await fetch('/api/order-flow', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: transition.action, data: { order_id: order.id } }),
            })
            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data.error || 'Could not update this order.')
            updateStatus(order.id, transition.next)
            setNotice(`Order #${order.order_number} moved to ${orderStates[transition.next].toLowerCase()}.`)
            void refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not update this order.')
            void refresh()
        } finally {
            running.current = false
            setPendingId(null)
        }
    }

    function action(order: Order) {
        const step = nextStep(order)
        if (step) return <button type="button" className={styles.primary} disabled={!!pendingId || !!loadError}
            aria-label={`${step.label} for order #${order.order_number}`} onClick={() => { void advance(order, step) }}>
            {pendingId === order.id ? 'Updating…' : step.label} <ArrowRight size={15} aria-hidden="true" />
        </button>
        if (order.order_type === 'delivery' && ['ready', 'served', 'billing'].includes(order.status) && hasPermission(userRole, 'page:delivery_monitor')) {
            return <Link className={styles.secondary} href="/dashboard/delivery-monitor">Open dispatch <Truck size={15} aria-hidden="true" /></Link>
        }
        if (['served', 'billing'].includes(order.status) && order.payment_method !== 'cash_on_delivery' && hasPermission(userRole, 'page:billing')) {
            return <Link className={styles.secondary} href="/dashboard/billing">Open billing <ArrowUpRight size={15} aria-hidden="true" /></Link>
        }
        return null
    }

    const detail = selected && (
        <div className={ops.detailBody}>
            <div className={ops.info}><Status state={selected.status} /><small>{context(selected)} · {sources[orderSource(selected)]}</small></div>
            <OrderReceipt order={selected} currency={currency} />
            {error && <p className={styles.error} role="alert">{error}</p>}
            {notice && <p className={styles.success} role="status">{notice}</p>}
            {action(selected)}
        </div>
    )
    const boardStates = (Object.keys(orderStates) as State[]).filter(state =>
        filtered.some(order => order.status === state) || filter === state || (filter === 'active' && activeStates.includes(state)) ||
        (filter === 'all' && activeStates.includes(state) && state !== 'billing')
    )

    return (
        <section className={`${styles.page} ${ops.page}`} aria-labelledby="orders-title">
            <header className={styles.stationHead}>
                <div><p className={styles.kicker}>{desk ? 'Service coordination' : 'Order operations'}</p><h1 id="orders-title">{desk ? 'Order desk' : 'Orders'}</h1>
                    <p>{desk ? 'Find orders by channel and move them through service.' : 'Review orders and follow each kitchen ticket through handoff.'}</p></div>
                <div className={ops.actions}>
                    <button type="button" className={styles.secondary} disabled={isLoading || !!pendingId} onClick={() => { void refresh() }}><RefreshCw size={16} aria-hidden="true" /> {isLoading ? 'Refreshing…' : 'Refresh'}</button>
                    {!desk && hasPermission(userRole, 'page:order_desk') && <Link href="/dashboard/order-desk" className={styles.secondary}>Order desk <ArrowUpRight size={15} aria-hidden="true" /></Link>}
                    {!desk && hasPermission(userRole, 'page:kitchen') && <Link href="/dashboard/kitchen" className={styles.secondary}><ChefHat size={16} aria-hidden="true" /> Kitchen</Link>}
                    {hasPermission(userRole, 'page:take_order') && <Link href="/dashboard/take-order" className={styles.primary}><Plus size={17} aria-hidden="true" /> New order</Link>}
                </div>
            </header>
            <dl className={styles.shiftStats} aria-label="Order summary">
                {counts.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd className={ops.kpi}>{!orders.length && (isLoading || loadError) ? '—' : value}</dd></div>)}
            </dl>
            {loadError && <p className={`${styles.error} mb-3`} role="alert">Couldn’t refresh orders. {orders.length > 0 ? 'Showing the last available orders.' : 'Try refreshing the queue.'}</p>}
            {!dialog && !selected && error && <p className={`${styles.error} mb-3`} role="alert">{error}</p>}
            {!dialog && !selected && notice && <p className={`${styles.success} mb-3`} role="status">{notice}</p>}

            <div className={ops.toolbar}>
                <SearchField value={query} onChange={setQuery} placeholder="Search order, table, or customer" />
                <div className={ops.filters}>
                    <label className={styles.field}>Status
                        <select value={filter} onChange={event => setFilter(event.target.value as Filter)}>
                            <option value="all">All orders</option><option value="active">Open orders</option>
                            {Object.entries(orderStates).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    {desk && <>
                        <label className={styles.field}>Fulfillment
                            <select value={orderType} onChange={event => setOrderType(event.target.value)}>
                                <option value="all">All types</option><option>Dine-in</option><option>Pickup</option><option>Delivery</option>
                            </select>
                        </label>
                        <label className={styles.field}>Source
                            <select value={channel} onChange={event => setChannel(event.target.value as Source | 'all')}>
                                <option value="all">All sources</option>
                                {Object.entries(sources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </label>
                    </>}
                    {!desk && <div className={ops.actions} role="group" aria-label="Order view">
                        <button type="button" className={styles.secondary} aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={16} aria-hidden="true" /> List</button>
                        <button type="button" className={styles.secondary} aria-pressed={view === 'board'} onClick={() => setView('board')}><LayoutGrid size={16} aria-hidden="true" /> Board</button>
                    </div>}
                </div>
            </div>

            <div className={ops.workspace} data-detail={!!selected && !dialog}>
                <section className={styles.panel} aria-labelledby="queue-title" aria-busy={isLoading}>
                    <header className={styles.panelHead}><div><h2 id="queue-title">{view === 'board' ? 'Order board' : 'Order queue'}</h2><p>{filtered.length} {filtered.length === 1 ? 'order' : 'orders'} shown</p></div><ClipboardList size={19} aria-hidden="true" /></header>
                    {filtered.length === 0 && <p className={styles.empty}>{isLoading ? 'Loading orders…' : loadError ? 'Try refreshing the queue.' : 'No orders match these filters.'}</p>}
                    {filtered.length > 0 && (view === 'list' ? <>
                        <div className={ops.queueHead} aria-hidden="true"><span>Order</span><span>Source</span><span>Status</span><span>Time</span><span className="text-right">Total</span></div>
                        <ul className={ops.queueList}>
                            {filtered.map(order => <li key={order.id}><OrderRow order={order} currency={currency} selected={order.id === selectedId} onSelect={() => open(order)} /></li>)}
                        </ul>
                    </> : <div className={`${ops.lanes} ${styles.panelBody}`}>
                        {boardStates.map(state => {
                            const lane = filtered.filter(order => order.status === state)
                            return (
                                <section key={state} className={ops.lane} aria-label={orderStates[state]}>
                                    <header className={ops.laneHead}><Status state={state} /><span>{lane.length}</span></header>
                                    {lane.length ? <ul className={ops.laneList}>{lane.map(order => {
                                        const orderAction = action(order)
                                        return <li className={ops.ticket} key={order.id}>
                                            <OrderRow order={order} currency={currency} selected={order.id === selectedId} onSelect={() => open(order)} compact />
                                            {orderAction && <div className={ops.ticketAction}>{orderAction}</div>}
                                        </li>
                                    })}</ul> : <p className={styles.empty}>No orders</p>}
                                </section>
                            )
                        })}
                    </div>)}
                </section>
                {selected && !dialog && (
                    <aside className={`${styles.panel} ${styles.receipt} ${ops.detail}`} aria-label="Selected order">
                        <header className={styles.panelHead}><div><h2>Order #{selected.order_number}</h2><p>{formatShortDate(selected.created_at)}</p></div>
                            <button type="button" className={styles.secondary} disabled={!!pendingId} onClick={close}>Close</button></header>
                        <div className={styles.panelBody}>{detail}</div>
                    </aside>
                )}
            </div>
            {selected && dialog && <ReviewDialog title={`Order #${selected.order_number}`} subtitle={formatShortDate(selected.created_at)} onClose={close} busy={!!pendingId}>{detail}</ReviewDialog>}
        </section>
    )
}

function OrderRow({ order, currency, selected, onSelect, compact }: {
    order: Order; currency: string; selected: boolean; onSelect: () => void; compact?: boolean
}) {
    const quantity = order.items?.filter(item => item.kitchen_status !== 'voided').reduce((sum, item) => sum + item.quantity, 0)
    return (
        <button type="button" className={ops.queueRow} aria-label={`View order #${order.order_number}`} aria-pressed={selected} onClick={onSelect}>
            <span><strong className={ops.orderId}>#{order.order_number}</strong><small className={ops.orderMeta}>{context(order)}{quantity != null ? ` · ${quantity} ${quantity === 1 ? 'item' : 'items'}` : ''}</small></span>
            {!compact && <span className={ops.channel}>{sources[orderSource(order)]}</span>}
            <span className={ops.orderState}><Status state={order.status} /></span>
            <time className={`${ops.orderTime} ${ops.orderMeta}`} dateTime={order.created_at} title={formatShortDate(order.created_at)}>{formatTime(order.created_at)}</time>
            <span className={`${ops.amount} ${ops.orderTotal}`}>{money(Number(order.total), currency)}</span>
        </button>
    )
}

function OrderReceipt({ order, currency }: { order: Order; currency: string }) {
    const items = order.items?.filter(item => item.kitchen_status !== 'voided') ?? []
    return (
        <>
            {(order.customer_name || order.customer_phone || order.delivery_address) && <dl className={ops.detailMeta}>
                {order.customer_name && <div><dt>Customer</dt><dd>{order.customer_name}</dd></div>}
                {order.customer_phone && <div><dt>Phone</dt><dd><a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></dd></div>}
                {order.delivery_address && <div><dt>Delivery address</dt><dd>{order.delivery_address}</dd></div>}
            </dl>}
            {items.length > 0 ? <ul>{items.map(item => (
                <li key={item.id} className={styles.billLine}>
                    <span>{item.quantity}× {item.item_name_snapshot || item.menu_item?.name || 'Item'}{item.variant_name_snapshot && <small className="block">{item.variant_name_snapshot}</small>}
                        {item.special_instructions && <small className="block">{item.special_instructions}</small>}</span>
                    <span>{money(Number(item.subtotal), currency)}</span>
                </li>
            ))}</ul> : <p className={styles.muted}>Item details are unavailable.</p>}
            {order.notes && <p className={styles.notice}><ReceiptText size={17} aria-hidden="true" /> {order.notes}</p>}
            <dl className={styles.totals}>
                <div><dt>Subtotal</dt><dd>{money(Number(order.subtotal), currency)}</dd></div>
                {Number(order.tax) > 0 && <div><dt>Tax</dt><dd>{money(Number(order.tax), currency)}</dd></div>}
                {Number(order.delivery_fee) > 0 && <div><dt>Delivery fee</dt><dd>{money(Number(order.delivery_fee), currency)}</dd></div>}
                {Number(order.discount) > 0 && <div><dt>Discount</dt><dd>−{money(Number(order.discount), currency)}</dd></div>}
                <div><dt>Order total</dt><dd>{money(Number(order.total), currency)}</dd></div>
            </dl>
        </>
    )
}
