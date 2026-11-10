'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Navigation, Package } from 'lucide-react'
import LiveTrackingMap from '@/components/maps/LiveTrackingMap'
import { DeliveryBadge, DeliveryHeader, DeliveryNotice, DropOff, LastSync, RefreshDeliveries } from '@/components/service/DeliveryUI'
import { cashDue, deliveryAction, inProgress, lineItems, orderLabel, point, stage, useDeliveries, type Delivery } from '@/components/service/delivery-data'
import { money, ReviewDialog } from '@/components/service/ServiceOrder'
import styles from '@/components/service/delivery.module.css'
import work from '@/components/service/service-order.module.css'
import { withStaffAuthHeaders } from '@/lib/staff-api'
import { useAuthStore } from '@/stores'

const priorities = ['arrived', 'route', 'picked', 'pickup', 'kitchen']
const nextActions = {
    pickup: { status: 'picked_up', label: 'Confirm pickup' },
    picked: { status: 'en_route', label: 'Start delivery' },
    route: { status: 'delivered', label: 'Confirm delivery' },
    arrived: { status: 'delivered', label: 'Confirm delivery' },
} as const
type Action = 'picked_up' | 'en_route' | 'delivered' | 'dispatch_exception'

export default function DeliveryBoyPage() {
    const { restaurant, userRole, staff } = useAuthStore()
    return restaurant?.id
        ? <RiderRun key={`${restaurant.id}:${staff?.id || ''}:${userRole || ''}`} restaurantId={restaurant.id} currency={restaurant.currency || 'PKR'} />
        : <main className={`${work.page} ${styles.page}`}><DeliveryHeader label="Rider station" title="Delivery run" description="Your pickups and drop-offs." /><p className={styles.empty}>Select a restaurant to view deliveries.</p></main>
}

function RiderRun({ restaurantId, currency }: { restaurantId: string; currency: string }) {
    const feed = useDeliveries(restaurantId)
    const gps = useDeliveryLocation()
    const [selectedId, setSelectedId] = useState<string>()
    const [showMap, setShowMap] = useState(false)
    const [review, setDialog] = useState<{ type: 'cash' | 'issue'; id: string }>()
    const [reason, setReason] = useState('')
    const [pending, setPending] = useState(false)
    const [actionError, setActionError] = useState('')
    const [message, setMessage] = useState('')
    const [history, setHistory] = useState<'delivered' | 'exception'>('delivered')
    const updating = useRef(false)
    const focusCard = useRef<HTMLElement>(null)
    const deliveries = feed.data?.deliveries ?? []
    const open = deliveries.filter(inProgress).sort((a, b) => priority(a) - priority(b) || Date.parse(a.created_at) - Date.parse(b.created_at))
    const completed = deliveries.filter(row => stage(row) === 'delivered')
    const issues = deliveries.filter(row => stage(row) === 'exception')
    const dialog = review && open.some(row => row.id === review.id) ? review : undefined
    const current = open.find(row => row.id === (dialog?.id || selectedId)) ?? open[0]
    const currentStage = current ? stage(current) : undefined
    const action = currentStage && currentStage in nextActions ? nextActions[currentStage as keyof typeof nextActions] : undefined
    const scope = feed.data?.scope
    const ownTrip = scope === 'mine' && current?.rider_id === feed.data?.staffId
    const canWork = Boolean((scope === 'mine' && ownTrip) || ['owner', 'manager'].includes(feed.data?.role || ''))
    const canTrack = ownTrip && (currentStage === 'route' || currentStage === 'arrived')
    const cash = current ? cashDue(current) : 0
    const items = current ? lineItems(current) : []
    const pickupLat = current?.pickup_lat
    const pickupLng = current?.pickup_lng
    const pickup = useMemo(() => point(pickupLat, pickupLng), [pickupLat, pickupLng])
    const dropLat = current?.delivery_lat
    const dropLng = current?.delivery_lng
    const dropoff = useMemo(() => point(dropLat, dropLng), [dropLat, dropLng])
    const canMap = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && pickup && dropoff)
    const activeOrder = gps.orderId
    const stop = gps.stop

    useEffect(() => {
        const data = feed.data
        if (activeOrder && data && !data.deliveries.some(row =>
            row.order_id === activeOrder && row.rider_id === data.staffId && ['route', 'arrived'].includes(stage(row))
        )) stop()
    }, [activeOrder, feed.data, stop])

    function select(row: Delivery) {
        setSelectedId(row.id)
        setShowMap(false)
        setActionError('')
        requestAnimationFrame(() => focusCard.current?.focus())
    }

    async function update(status: Action) {
        if (!current || !canWork || updating.current || feed.error) return
        if (dialog && dialog.id !== current.id) return
        if (status === 'dispatch_exception' ? !reason.trim() : action?.status !== status) return
        updating.current = true
        setPending(true)
        setActionError('')
        setMessage('')
        try {
            await deliveryAction(current.id, status, {
                ...(status === 'delivered' && cash > 0 ? { cashCollected: cash } : {}),
                ...(status === 'dispatch_exception' ? { reason: reason.trim() } : {}),
            })
            if ((status === 'delivered' || status === 'dispatch_exception') && activeOrder === current.order_id) stop()
            setMessage(status === 'dispatch_exception' ? 'Issue sent to dispatch.'
                : status === 'delivered' ? `${orderLabel(current)} marked delivered.`
                    : status === 'picked_up' ? 'Pickup confirmed. Start the delivery when you leave.' : 'Delivery started.')
            setDialog(undefined)
            setReason('')

            if (status === 'delivered' || status === 'dispatch_exception') {
                setSelectedId(undefined)
                setShowMap(false)
                setHistory(status === 'delivered' ? 'delivered' : 'exception')
            }
            const updated = await feed.refresh()
            if (status === 'en_route' && ownTrip && updated?.staffId && updated.deliveries.some(
                row => row.id === current.id && row.rider_id === updated.staffId && ['route', 'arrived'].includes(stage(row))
            )) gps.start(current.order_id, updated.staffId)
        } catch (failure) {
            setActionError(failure instanceof Error ? failure.message : 'Could not update this delivery.')
            await feed.refresh()
        } finally {
            setPending(false)
            updating.current = false
        }
    }

    function next() {
        if (!action) return
        setActionError('')
        if (action.status === 'delivered' && cash > 0 && current) setDialog({ type: 'cash', id: current.id })
        else void update(action.status)
    }

    const stepIndex = currentStage === 'picked' ? 1 : currentStage === 'route' || currentStage === 'arrived' ? 2 : 0
    const gpsOnThisOrder = current && activeOrder === current.order_id

    return <main className={`${work.page} ${styles.page}`}>
        <DeliveryHeader label="Rider station" title={scope === 'restaurant' ? 'Delivery runs' : 'My delivery run'}
            description={scope === 'restaurant' ? 'Review pickups and drop-offs across the restaurant.' : 'Pick up the order, head out, and confirm the drop-off.'}>
            <LastSync at={feed.syncedAt} />
            <RefreshDeliveries busy={feed.loading} onClick={() => void feed.refresh()} />
        </DeliveryHeader>
        <dl className={`${styles.summary} ${styles.riderSummary}`}>
            <div><dt>Open stops</dt><dd>{feed.data ? open.length : '—'}</dd></div>
            <div><dt>Delivered</dt><dd>{feed.data ? completed.length : '—'}</dd></div>
            <div><dt>Issues</dt><dd>{feed.data ? issues.length : '—'}</dd></div>
        </dl>
        <div className={styles.stack}>
            <DeliveryNotice {...feed} />
            {message && <p className={styles.success} role="status">{message}</p>}
            <div className={styles.split}>
                <div className={styles.stack}>
                    {current ? <section key={current.id} ref={focusCard} tabIndex={-1} aria-label={orderLabel(current)}
                        className={`${work.panel} ${styles.focus} ${styles.stack} ${styles.enter}`}>
                        <div className={styles.focusHead}><div><p className={styles.label}>Current stop</p><h2>{orderLabel(current)}</h2></div><DeliveryBadge delivery={current} /></div>
                        <ol className={styles.steps} aria-label="Delivery progress">
                            {['Pickup', 'Depart', 'Drop-off'].map((label, index) => <li key={label}
                                aria-current={index === stepIndex ? 'step' : undefined} data-done={index < stepIndex}>{index + 1}. {label}</li>)}
                        </ol>
                        {currentStage === 'kitchen' && <p className={styles.empty}>The kitchen is preparing this order. Pickup becomes available when the order is ready.</p>}
                        <DropOff delivery={current} directions />
                        {cash > 0 && <div className={styles.cash}><span>Collect at the door</span><strong>{money(cash, currency)}</strong></div>}
                        {canWork && action && <button type="button" className={`${work.primary} ${styles.riderAction}`} disabled={pending || !!feed.error} onClick={next}>
                            {pending ? 'Updating…' : action.label} <ArrowRight size={18} aria-hidden="true" />
                        </button>}
                        {items.length > 0 && <details><summary>Order items ({items.reduce((sum, item) => sum + item.quantity, 0)})</summary>
                            <ul className={work.lines}>{items.map((item, index) => <li key={index}>{item.quantity} × {item.name}</li>)}</ul>
                        </details>}
                        {canTrack && <div className={styles.stack}>
                            {gpsOnThisOrder && <p className={gps.error ? styles.alert : styles.empty} role={gps.error ? 'alert' : 'status'}>
                                {gps.error || (gps.sent ? 'Location shared with dispatch. Keep this page open during the trip.' : 'Waiting for a location update…')}
                            </p>}
                            <button type="button" className={work.secondary} disabled={!!feed.error} onClick={() => {
                                if (gpsOnThisOrder && !gps.error) stop()
                                else if (feed.data?.staffId) gps.start(current.order_id, feed.data.staffId)
                            }}><Navigation size={16} aria-hidden="true" /> {gpsOnThisOrder && !gps.error ? 'Stop sharing location' : gpsOnThisOrder ? 'Retry location sharing' : 'Share trip location'}</button>
                        </div>}
                        {activeOrder && !gpsOnThisOrder && <p className={styles.empty}>Location sharing is running for another stop. <button type="button" className={work.secondary} onClick={stop}>Stop sharing</button></p>}
                        {actionError && !dialog && <p className={styles.alert} role="alert">{actionError}</p>}
                        <div className={styles.actions}>
                            {canWork && current.rider_id && ['pickup', 'kitchen', 'picked', 'route', 'arrived'].includes(currentStage || '') &&
                                <button type="button" className={work.secondary} disabled={pending || !!feed.error} onClick={() => { setActionError(''); setReason(''); setDialog({ type: 'issue', id: current.id }) }}>Report an issue</button>}
                            {canMap && <button type="button" className={work.secondary} aria-expanded={showMap} onClick={() => setShowMap(!showMap)}>Route map</button>}
                        </div>
                        {showMap && canMap && pickup && dropoff && <LiveTrackingMap restaurantLocation={pickup} customerLocation={dropoff} riderLocation={gpsOnThisOrder && !gps.error ? gps.sent : undefined} className={styles.map} />}
                    </section> : feed.data && <p className={styles.empty}>No open deliveries. New assignments will appear here.</p>}
                </div>
                <div className={styles.stack}>
                    <section className={work.panel} aria-label="Open stops">
                        <div className={work.panelHead}><div><h2>Open stops</h2><p>Trips in progress appear first.</p></div></div>
                        {open.length > 0 && <ul className={styles.rows}>
                            {open.map(row => <li key={row.id}><button type="button" className={styles.row} disabled={pending} aria-pressed={current?.id === row.id} onClick={() => select(row)}>
                                <span className={styles.tile}><Package size={17} aria-hidden="true" /></span>
                                <span className={styles.rowText}><strong>{orderLabel(row)}</strong><small>{row.delivery_address || 'Address unavailable'}</small></span>
                                <DeliveryBadge delivery={row} />
                            </button></li>)}
                        </ul>}
                        {!open.length && feed.data && <p className={styles.empty}>No stops in the queue.</p>}
                    </section>
                    <section className={work.panel} aria-label="Delivery history">
                        <div className={work.panelHead}><div><h2>Delivery history</h2></div></div>
                        <div className={styles.toolbar}><div className={work.filters} aria-label="History filters">
                            <button type="button" aria-pressed={history === 'delivered'} onClick={() => setHistory('delivered')}>Delivered {completed.length}</button>
                            <button type="button" aria-pressed={history === 'exception'} onClick={() => setHistory('exception')}>Issues {issues.length}</button>
                        </div></div>
                        <ul className={styles.rows}>{(history === 'delivered' ? completed : issues).map(row => <li key={row.id}>
                            <div className={`${work.panelBody} ${styles.rowText}`}><strong>{orderLabel(row)}</strong>
                                <small>{row.cancel_reason || row.delivery_address || 'Address unavailable'}</small></div>
                        </li>)}</ul>
                        {feed.data && !(history === 'delivered' ? completed : issues).length && <p className={styles.empty}>{history === 'delivered' ? 'No completed deliveries yet.' : 'No issues reported.'}</p>}
                    </section>
                </div>
            </div>
        </div>
        {dialog && current?.id === dialog.id && <ReviewDialog title={dialog.type === 'cash' ? 'Confirm cash collected' : 'Report a delivery issue'} subtitle={orderLabel(current)}
            busy={pending} onClose={() => { setDialog(undefined); setActionError('') }}>
            <form className={styles.stack} onSubmit={event => { event.preventDefault(); void update(dialog.type === 'cash' ? 'delivered' : 'dispatch_exception') }}>
                {dialog.type === 'cash' ? <>
                    <p>Confirm the exact cash amount you received at the door.</p>
                    <div className={styles.cash}><span>Cash collected</span><strong>{money(cash, currency)}</strong></div>
                </> : <label className={work.field}>What happened?
                    <textarea rows={4} maxLength={500} required value={reason} disabled={pending} onChange={event => setReason(event.target.value)} placeholder="For example, the customer could not be reached" />
                </label>}
                {actionError && <p className={styles.alert} role="alert">{actionError}</p>}
                <button type="submit" className={work.primary} disabled={pending || !!feed.error || (dialog.type === 'issue' ? !reason.trim() : cash <= 0 || action?.status !== 'delivered')}>
                    {pending ? 'Saving…' : dialog.type === 'cash' ? 'Confirm cash and delivery' : 'Send issue to dispatch'}
                </button>
            </form>
        </ReviewDialog>}
    </main>
}

function priority(row: Delivery) {
    const index = priorities.indexOf(stage(row))
    return index < 0 ? priorities.length : index
}

function useDeliveryLocation() {
    const watch = useRef<number | null>(null)
    const controller = useRef<AbortController | null>(null)
    const generation = useRef(0)
    const mounted = useRef(false)
    const [orderId, setOrderId] = useState<string>()
    const [sent, setSent] = useState<{ lat: number; lng: number }>()
    const [error, setError] = useState('')
    const expiry = useRef<number | undefined>(undefined)

    const clear = useCallback(() => {
        generation.current++
        if (watch.current !== null) navigator.geolocation.clearWatch(watch.current)
        watch.current = null
        controller.current?.abort()
        controller.current = null
        window.clearTimeout(expiry.current)
    }, [])

    const stop = useCallback(() => {
        clear()
        setOrderId(undefined)
        setSent(undefined)
        setError('')
    }, [clear])

    useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false; clear() }
    }, [clear])

    function start(order: string, rider: string) {
        if (!mounted.current || !order) return
        stop()
        setOrderId(order)
        if (!navigator.geolocation) {
            setError('Location sharing is unavailable on this device.')
            return
        }

        const current = generation.current
        let lastAttempt = 0
        function expire() {
            window.clearTimeout(expiry.current)
            expiry.current = window.setTimeout(() => {
                if (generation.current === current) setError('No recent location update. Keep this page open or retry.')
            }, 45_000)
        }
        expire()
        try {
            watch.current = navigator.geolocation.watchPosition(async ({ coords }) => {
                if (generation.current !== current || controller.current || Date.now() - lastAttempt < 8_000) return
                lastAttempt = Date.now()
                const request = new AbortController()
                controller.current = request
                const position = { lat: coords.latitude, lng: coords.longitude }
                try {
                    const response = await fetch('/api/delivery/location', {
                        method: 'POST',
                        headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
                        signal: request.signal,
                        body: JSON.stringify({
                            rider_id: rider, order_id: order, latitude: position.lat, longitude: position.lng,
                            accuracy: coords.accuracy, heading: coords.heading, speed: coords.speed == null ? null : coords.speed * 3.6,
                        }),
                    })
                    const data = await response.json().catch(() => null)
                    if (!response.ok || !data?.success) throw new Error('Location update failed')
                    if (generation.current === current) {
                        setSent(position)
                        setError('')
                        expire()
                    }
                } catch {
                    if (generation.current === current) setError('Dispatch could not receive your location. Check your connection or retry.')
                } finally {
                    if (controller.current === request) controller.current = null
                }
            }, failure => {
                if (generation.current !== current) return
                if (failure.code === 1) clear()
                setError(failure.code === 1 ? 'Allow location access in your browser, then retry.' : 'Your device could not get a location. Move outside or retry.')
            }, { enableHighAccuracy: true, maximumAge: 5_000, timeout: 12_000 })
        } catch {
            clear()
            setError('Location sharing could not start. Check your browser permissions.')
        }
    }

    return { start, stop, orderId, sent, error }
}
