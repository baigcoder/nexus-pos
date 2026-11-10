'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bike, Map, Package, Phone } from 'lucide-react'
import FleetMap from '@/components/maps/FleetMap'
import LiveTrackingMap from '@/components/maps/LiveTrackingMap'
import { DeliveryBadge, DeliveryHeader, DeliveryNotice, DropOff, LastSync, RefreshDeliveries } from '@/components/service/DeliveryUI'
import {
    cashToSettle, deliveryAction, inProgress, lineItems, locationState, onTrip, orderLabel, phoneLink, point,
    stage, timeLabel, useDeliveries, useRiderRoster, type Delivery,
} from '@/components/service/delivery-data'
import { money, ReviewDialog, SearchField } from '@/components/service/ServiceOrder'
import styles from '@/components/service/delivery.module.css'
import work from '@/components/service/service-order.module.css'
import { useAuthStore } from '@/stores'

const views = [
    { id: 'work', label: 'Open', includes: inProgress },
    { id: 'dispatch', label: 'Needs a rider', includes: (row: Delivery) => stage(row) === 'unassigned' },
    { id: 'route', label: 'On the way', includes: onTrip },
    { id: 'exception', label: 'Issues', includes: (row: Delivery) => stage(row) === 'exception' },
    { id: 'cash', label: 'Cash', includes: (row: Delivery) => cashToSettle(row) > 0 },
    { id: 'delivered', label: 'Delivered', includes: (row: Delivery) => stage(row) === 'delivered' },
] as const

export default function DeliveryMonitorPage() {
    const { restaurant, staff, userRole } = useAuthStore()
    return restaurant?.id
        ? <Dispatch key={`${restaurant.id}:${staff?.id || ''}:${userRole || ''}`} restaurantId={restaurant.id} address={restaurant.address} currency={restaurant.currency || 'PKR'} />
        : <main className={`${work.page} ${styles.page}`}><DeliveryHeader label="Delivery operations" title="Dispatch" description="Pickup, drop-off and cash handoffs." /><p className={styles.empty}>Select a restaurant to view dispatch.</p></main>
}

function Dispatch({ restaurantId, address, currency }: { restaurantId: string; address?: string | null; currency: string }) {
    const feed = useDeliveries(restaurantId)
    const roster = useRiderRoster(restaurantId)
    const [view, setView] = useState<(typeof views)[number]['id']>('work')
    const [query, setQuery] = useState('')
    const [selectedId, setSelectedId] = useState<string>()
    const [riderId, setRiderId] = useState('')
    const [map, setMap] = useState<'fleet' | 'route'>()
    const [restaurantPoint, setRestaurantPoint] = useState<ReturnType<typeof point>>()
    const [dropPoint, setDropPoint] = useState<ReturnType<typeof point>>()
    const [reconciling, setReconciling] = useState(false)
    const [pending, setPending] = useState(false)
    const [actionError, setActionError] = useState('')
    const [success, setSuccess] = useState('')
    const updating = useRef(false)
    const detail = useRef<HTMLElement>(null)
    const deliveries = feed.data?.deliveries ?? []
    const riders = roster.data?.riders ?? []
    const active = deliveries.filter(inProgress)
    const busyRiders = new Set(active.map(row => row.rider_id))
    const available = riders.filter(rider => rider.is_active && !busyRiders.has(rider.id))
    const recentPositions = riders.flatMap(rider => {
        const location = roster.data?.locations.get(rider.id)
        if (!location || !rider.is_active || roster.error || locationState(location, Date.now()) !== 'Recent GPS') return []
        const position = point(location.latitude, location.longitude)
        return position ? [{ id: rider.id, name: rider.name, position, status: busyRiders.has(rider.id) ? 'busy' as const : 'available' as const }] : []
    })
    const filtered = deliveries.filter(views.find(item => item.id === view)!.includes).filter(row => {
        const rider = riders.find(item => item.id === row.rider_id)
        return [orderLabel(row), row.customer_name, row.delivery_address, rider?.name].some(value => value?.toLowerCase().includes(query.trim().toLowerCase()))
    })
    const selected = deliveries.find(row => row.id === selectedId)
    const assigned = riders.find(rider => rider.id === selected?.rider_id)
    const canManage = ['owner', 'manager'].includes(feed.data?.role || '')
    const canReconcile = canManage || feed.data?.role === 'cashier'
    const riderPhone = phoneLink(assigned?.phone)
    const cashTotal = deliveries.reduce((sum, row) => sum + cashToSettle(row), 0)
    const canMap = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
    const mapAddress = map && canMap && (map === 'fleet' || !point(selected?.pickup_lat, selected?.pickup_lng)) ? address : undefined
    const dropAddress = map === 'route' && canMap && !point(selected?.delivery_lat, selected?.delivery_lng) ? selected?.delivery_address : undefined

    useEffect(() => {
        if (!mapAddress) return
        const request = new AbortController()
        void geocode(mapAddress, request.signal).then(position => { if (!request.signal.aborted) setRestaurantPoint(position) })
        return () => { request.abort(); setRestaurantPoint(undefined) }
    }, [mapAddress])

    useEffect(() => {
        if (!dropAddress) return
        const request = new AbortController()
        void geocode(dropAddress, request.signal).then(position => { if (!request.signal.aborted) setDropPoint(position) })
        return () => { request.abort(); setDropPoint(undefined) }
    }, [dropAddress])

    const pickupLat = selected?.pickup_lat
    const pickupLng = selected?.pickup_lng
    const pickup = useMemo(() => point(pickupLat, pickupLng) || restaurantPoint, [pickupLat, pickupLng, restaurantPoint])
    const dropLat = selected?.delivery_lat
    const dropLng = selected?.delivery_lng
    const destination = useMemo(() => point(dropLat, dropLng) || dropPoint, [dropLat, dropLng, dropPoint])
    const fleetCenter = restaurantPoint
    const riderPosition = recentPositions.find(rider => rider.id === selected?.rider_id)?.position

    function select(row: Delivery) {
        setSelectedId(row.id)
        setRiderId('')
        setActionError('')
        setMap(current => current === 'route' ? undefined : current)
        requestAnimationFrame(() => {
            if (window.matchMedia('(max-width: 959px)').matches) detail.current?.focus()
        })
    }

    async function update(status: 'assigned' | 'reconcile_cash') {
        if (!selected || updating.current || feed.error) return
        if (status === 'assigned' && (roster.error || !available.some(rider => rider.id === riderId))) return
        updating.current = true
        setPending(true)
        setActionError('')
        setSuccess('')
        try {
            await deliveryAction(selected.id, status, status === 'assigned' ? { riderId } : undefined)
            setSuccess(status === 'assigned' ? `${orderLabel(selected)} assigned.` : `Cash handoff recorded for ${orderLabel(selected)}.`)
            setReconciling(false)
            setRiderId('')
            await feed.refresh()
        } catch (failure) {
            setActionError(failure instanceof Error ? failure.message : 'Could not save the handoff.')
            await feed.refresh()
        } finally {
            updating.current = false
            setPending(false)
        }
    }

    return <main className={`${work.page} ${styles.page}`}>
        <DeliveryHeader label="Delivery operations" title="Dispatch" description="Assign pickups, follow drop-offs and reconcile cash.">
            <LastSync at={feed.syncedAt} />
            <Link className={work.secondary} href="/dashboard/riders"><Bike size={16} aria-hidden="true" /> Riders</Link>
            {canMap && <button type="button" className={work.secondary} aria-pressed={map === 'fleet'} onClick={() => setMap(map === 'fleet' ? undefined : 'fleet')}><Map size={16} aria-hidden="true" /> Fleet map</button>}
            <RefreshDeliveries busy={feed.loading || roster.loading} onClick={() => { void feed.refresh(); void roster.refresh() }} />
        </DeliveryHeader>
        <dl className={styles.summary}>
            <div><dt>Needs a rider</dt><dd>{feed.data ? deliveries.filter(views[1].includes).length : '—'}</dd></div>
            <div><dt>On the way</dt><dd>{feed.data ? deliveries.filter(onTrip).length : '—'}</dd></div>
            <div><dt>Issues reported</dt><dd>{feed.data ? deliveries.filter(views[3].includes).length : '—'}</dd></div>
            <div><dt>Cash to reconcile</dt><dd>{feed.data ? money(cashTotal, currency) : '—'}</dd></div>
        </dl>
        <div className={styles.stack}>
            <DeliveryNotice {...feed} />
            {roster.error && <p className={styles.alert} role="alert">{roster.error} Rider assignment is paused until the roster refreshes.</p>}
            {success && <p className={styles.success} role="status">{success}</p>}
            {map === 'fleet' && <section className={work.panel} aria-label="Fleet map">
                <div className={work.panelHead}><div><h2>Fleet map</h2><p>{recentPositions.length} riders with recent GPS</p></div></div>
                {fleetCenter ? <FleetMap restaurantLocation={fleetCenter} riders={recentPositions} className={styles.map} />
                    : <p className={styles.empty}>{roster.data?.locationError ? 'Rider locations could not be loaded.' : 'A confirmed restaurant location is required to show the fleet map.'}</p>}
            </section>}
            <div className={styles.split}>
                <section className={work.panel} aria-label="Dispatch queue">
                    <div className={work.panelHead}><div><h2>Delivery queue</h2><p>Choose an order to review the handoff.</p></div></div>
                    <div className={styles.toolbar}>
                        <SearchField value={query} onChange={setQuery} placeholder="Search by order, customer, address or rider" />
                        <div className={work.filters} aria-label="Delivery filters">
                            {views.map(item => <button key={item.id} type="button" disabled={pending} aria-pressed={view === item.id} onClick={() => setView(item.id)}>
                                {item.label}{feed.data && <span className={work.countBadge}>{deliveries.filter(item.includes).length}</span>}
                            </button>)}
                        </div>
                    </div>
                    <ul className={styles.rows}>
                        {filtered.map(row => <li key={row.id}><button type="button" className={styles.row} aria-pressed={selectedId === row.id} disabled={pending} onClick={() => select(row)}>
                            <span className={styles.tile}><Package size={17} aria-hidden="true" /></span>
                            <span className={styles.rowText}><strong>{orderLabel(row)} · {row.customer_name || 'Customer'}</strong>
                                <small>{row.delivery_address || 'Address unavailable'}</small></span>
                            <span className={styles.rowEnd}><DeliveryBadge delivery={row} /><small>{timeLabel(row.created_at)}</small></span>
                        </button></li>)}
                    </ul>
                    {feed.data && !filtered.length && <p className={styles.empty}>{query.trim() ? 'No deliveries match your search.' : 'No deliveries in this view.'}</p>}
                </section>
                {selected ? <section key={selected.id} ref={detail} tabIndex={-1} className={`${work.panel} ${work.receipt} ${styles.detail}`} aria-label={orderLabel(selected)}>
                    <div className={work.panelHead}><div><p className={styles.label}>Dispatch ticket</p><h2>{orderLabel(selected)}</h2></div><DeliveryBadge delivery={selected} /></div>
                    <div className={`${work.panelBody} ${styles.stack}`}>
                        <DropOff delivery={selected} />
                        <dl className={styles.meta}>
                            <div><dt>Rider</dt><dd>{assigned?.name || (selected.rider_id ? 'Assigned rider' : 'Unassigned')}</dd></div>
                            {selected.order && <div><dt>Order total</dt><dd>{money(Number(selected.order.total), currency)}</dd></div>}
                            {selected.cod_collected_at && <div><dt>{selected.cod_settled ? 'Cash reconciled' : 'Cash held by rider'}</dt><dd>{money(Number(selected.cod_amount_collected || 0), currency)}</dd></div>}
                        </dl>
                        {lineItems(selected).length > 0 && <details><summary>Order items</summary><ul className={work.lines}>{lineItems(selected).map((item, index) => <li key={index}>{item.quantity} × {item.name}</li>)}</ul></details>}
                        {selected.cancel_reason && <p className={styles.alert}>{selected.cancel_reason}</p>}
                        {actionError && !reconciling && <p className={styles.alert} role="alert">{actionError}</p>}
                        {canManage && selected.status === 'pending_dispatch' && stage(selected) === 'unassigned' && <>
                            <label className={work.field}>Assign a rider
                                <select value={riderId} onChange={event => setRiderId(event.target.value)} disabled={pending || !!roster.error || !available.length}>
                                    <option value="">{available.length ? 'Choose an available rider' : 'No enabled riders free'}</option>
                                    {available.map(rider => <option key={rider.id} value={rider.id}>{rider.name} · {roster.data?.locationError ? 'GPS unavailable' : locationState(roster.data?.locations.get(rider.id), Date.now())}</option>)}
                                </select>
                            </label>
                            <button type="button" className={work.primary} disabled={pending || !!feed.error || !!roster.error || !available.some(rider => rider.id === riderId)} onClick={() => void update('assigned')}>{pending ? 'Assigning…' : 'Assign rider'}</button>
                        </>}
                        <div className={styles.actions}>
                            {riderPhone && <a href={riderPhone} className={work.secondary}><Phone size={15} aria-hidden="true" /> Call rider</a>}
                            {canMap && <button type="button" className={work.secondary} aria-expanded={map === 'route'} onClick={() => setMap(map === 'route' ? undefined : 'route')}>Route map</button>}
                            {canReconcile && cashToSettle(selected) > 0 && <button type="button" className={work.primary} disabled={pending || !!feed.error} onClick={() => { setActionError(''); setReconciling(true) }}>Reconcile cash</button>}
                        </div>
                        {map === 'route' && (pickup && destination
                            ? <LiveTrackingMap key={selected.id} restaurantLocation={pickup} customerLocation={destination} riderLocation={riderPosition} riderName={assigned?.name} className={styles.map} />
                            : <p className={styles.empty}>The route map needs a confirmed pickup and drop-off location.</p>)}
                    </div>
                </section> : <aside className={styles.empty}>Select a delivery to see its address, rider and cash details.</aside>}
            </div>
        </div>
        {reconciling && selected && <ReviewDialog title="Record the cash handoff" subtitle={orderLabel(selected)} busy={pending} onClose={() => setReconciling(false)}>
            <div className={styles.stack}>
                <p>Confirm only after you have received this cash from {assigned?.name || 'the rider'}.</p>
                <div className={styles.cash}><span>Cash received</span><strong>{money(cashToSettle(selected), currency)}</strong></div>
                {actionError && <p className={styles.alert} role="alert">{actionError}</p>}
                <button type="button" className={work.primary} disabled={pending || !!feed.error || cashToSettle(selected) <= 0} onClick={() => void update('reconcile_cash')}>{pending ? 'Recording…' : 'Confirm cash received'}</button>
            </div>
        </ReviewDialog>}
    </main>
}

async function geocode(address: string, signal: AbortSignal) {
    try {
        const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`, { signal })
        if (!response.ok) return
        const data = await response.json()
        return point(data.lat, data.lng)
    } catch { return undefined }
}
