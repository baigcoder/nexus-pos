'use client'

import { useMemo } from 'react'
import { Clock3, MapPin, Phone, RefreshCw, Truck } from 'lucide-react'
import LiveTrackingMap from '@/components/maps/LiveTrackingMap'
import { GuestMasthead, GuestMessage, ProgressList, useGuestTracking } from '@/components/service/GuestJourney'
import { formatTime } from '@/lib/format'
import styles from '@/components/service/service-order.module.css'
import journey from '@/components/service/guest-journey.module.css'

type Point = { lat: number | null; lng: number | null }
type Tracking = {
    success: boolean
    order: { order_number: number; status: string; raw_status?: string }
    delivery: { pickup?: Point | null; destination?: Point | null; rider?: { name?: string } | null }
    rider_location?: { latitude: number; longitude: number; updated_at: string } | null
    restaurant: { name: string; address?: string; phone?: string }
    eta_minutes?: number | null
}

const statuses = [
    { key: 'pending', label: 'Received', title: 'Order received', description: 'The restaurant has your order.' },
    { key: 'preparing', label: 'In prep', title: 'In prep', description: 'The kitchen is preparing your order.' },
    { key: 'ready', label: 'Ready', title: 'Ready for handoff', description: 'Your order is ready at the restaurant.' },
    { key: 'dispatched', label: 'On the way', title: 'On the way', description: 'Your rider has picked up the order.' },
    { key: 'delivered', label: 'Delivered', title: 'Delivered', description: 'Your delivery is complete.' },
]

function parse(body: unknown) {
    const data = body as Tracking | null
    return data?.success && data.order && data.delivery ? data : null
}

function final(data: Tracking) {
    return ['delivered', 'cancelled'].includes(data.order.status) || data.order.raw_status === 'cancelled'
}

function point(lat: number | null | undefined, lng: number | null | undefined) {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
    return { lat, lng }
}

export default function TrackPage() {
    const { data, loading, error, refreshing, updated, refresh } = useGuestTracking('/api/track', parse, final, 30000)
    const pickupLat = data?.delivery.pickup?.lat
    const pickupLng = data?.delivery.pickup?.lng
    const destinationLat = data?.delivery.destination?.lat
    const destinationLng = data?.delivery.destination?.lng
    const pickup = useMemo(() => point(pickupLat, pickupLng), [pickupLat, pickupLng])
    const destination = useMemo(() => point(destinationLat, destinationLng), [destinationLat, destinationLng])
    const location = data?.rider_location
    const rider = !error && location && Date.now() - new Date(location.updated_at).getTime() < 120_000
        ? point(location.latitude, location.longitude) : null

    if (loading) return <GuestMessage label="Delivery tracking" title="Loading your delivery" loading />
    if (!data) return <GuestMessage label="Delivery tracking" title="Tracking unavailable" message={error} retry={refresh} />

    const index = statuses.findIndex(status => status.key === data.order.status)
    const status = statuses[index]
    const cancelled = data.order.raw_status === 'cancelled' || data.order.status === 'cancelled'
    const inTransit = !cancelled && data.order.status === 'dispatched'
    const estimate = !error && inTransit && data.eta_minutes != null && Number.isFinite(Number(data.eta_minutes)) && Number(data.eta_minutes) >= 0 ? Number(data.eta_minutes) : null
    const canMap = inTransit && pickup && destination && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    return (
        <main className={`${styles.page} ${styles.guestTheme}`}>
            <GuestMasthead title={data.restaurant?.name || 'Your delivery'} label="Delivery tracking">
                <span className={styles.contextTag}><Truck size={17} aria-hidden="true" /> Order #{data.order.order_number}</span>
            </GuestMasthead>
            <div className={`${styles.wrap} ${journey.content} ${journey.twoColumns}`}>
                <div className={journey.stack}>
                    <section className={`${styles.panel} ${styles.receipt}`}>
                        <div className={journey.statusHead} role="status">
                            <p className={styles.kicker}>Delivery #{data.order.order_number}</p>
                            <h2>{cancelled ? 'Order cancelled' : status?.title || 'Delivery update pending'}</h2>
                            <p>{cancelled ? 'Contact the restaurant if you have questions.' : status?.description || 'Check back for an update from the restaurant.'}</p>
                        </div>
                        {!cancelled && <div className={styles.panelBody}><ProgressList steps={statuses.map(step => step.label)} current={index} complete={data.order.status === 'delivered'} /></div>}
                        <div className={journey.toolbar}>
                            <span>{updated && `Updated ${formatTime(updated)}`}</span>
                            <button type="button" className={styles.secondary} disabled={refreshing} onClick={refresh}><RefreshCw size={16} aria-hidden="true" /> {refreshing ? 'Refreshing…' : 'Refresh'}</button>
                        </div>
                    </section>
                    {error && <p className={styles.notice} role="status">{error} Showing the last update.</p>}
                    {canMap && (
                        <section className={styles.panel} aria-label="Delivery map">
                            <header className={styles.panelHead}><div><h2>Delivery map</h2><p>{rider ? 'Rider location available' : 'Showing pickup and drop-off'}</p></div><MapPin size={20} aria-hidden="true" /></header>
                            <LiveTrackingMap restaurantLocation={pickup} customerLocation={destination} riderLocation={rider || undefined} riderName={data.delivery.rider?.name} showRoute className="h-[300px]" />
                        </section>
                    )}
                </div>
                <section className={styles.panel}>
                    <header className={styles.panelHead}><div><h2>Delivery details</h2></div><Clock3 size={20} aria-hidden="true" /></header>
                    <div className={styles.panelBody}>
                        <dl className={journey.details}>
                            {data.delivery.rider?.name && <div><dt>Rider</dt><dd>{data.delivery.rider.name}</dd></div>}
                            {inTransit && <div><dt>Estimated arrival</dt><dd>{estimate == null ? 'Awaiting update' : `About ${Math.max(1, Math.round(estimate))} min`}</dd></div>}
                            <div><dt>Restaurant</dt><dd>{data.restaurant?.name || 'Restaurant'}</dd></div>
                        </dl>
                        {data.restaurant?.address && <p className={journey.intro}>{data.restaurant.address}</p>}
                        {data.restaurant?.phone && <div className={journey.actions}><a className={styles.secondary} href={`tel:${data.restaurant.phone}`}><Phone size={16} aria-hidden="true" /> Call restaurant</a></div>}
                    </div>
                </section>
            </div>
        </main>
    )
}
