'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Bike, Phone, Plus } from 'lucide-react'
import { DeliveryHeader, DeliveryNotice, LastSync, RefreshDeliveries } from '@/components/service/DeliveryUI'
import { inProgress, locationState, phoneLink, timeLabel, useDeliveries, useRiderRoster } from '@/components/service/delivery-data'
import { ReviewDialog, SearchField } from '@/components/service/ServiceOrder'
import styles from '@/components/service/delivery.module.css'
import work from '@/components/service/service-order.module.css'
import { createClient } from '@/lib/supabase/client'
import { hasPermission, useAuthStore } from '@/stores'

export default function RidersPage() {
    const { restaurant, staff, userRole } = useAuthStore()
    return restaurant?.id
        ? <Roster key={`${restaurant.id}:${staff?.id || ''}:${userRole || ''}`} restaurantId={restaurant.id} canEdit={hasPermission(userRole, 'staff:edit')} />
        : <main className={`${work.page} ${styles.page}`}><DeliveryHeader label="Delivery operations" title="Riders" description="Manage rider accounts and view trip activity." /><p className={styles.empty}>Select a restaurant to view the roster.</p></main>
}

function Roster({ restaurantId, canEdit }: { restaurantId: string; canEdit: boolean }) {
    const roster = useRiderRoster(restaurantId)
    const feed = useDeliveries(restaurantId)
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
    const [review, setReview] = useState<{ id: string; name: string; enabled: boolean }>()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const updating = useRef(false)
    const riders = roster.data?.riders ?? []
    const enabled = riders.filter(rider => rider.is_active).length
    const workload = new Map<string, { active: number; delivered: number }>()
    for (const row of feed.data?.deliveries ?? []) {
        if (!row.rider_id) continue
        const entry = workload.get(row.rider_id) || { active: 0, delivered: 0 }
        if (inProgress(row)) entry.active++
        if (row.status === 'delivered') entry.delivered++
        workload.set(row.rider_id, entry)
    }

    const matching = riders.filter(rider => {
        if (filter !== 'all' && rider.is_active !== (filter === 'enabled')) return false
        const term = query.trim().toLowerCase()
        return rider.name.toLowerCase().includes(term) || Boolean(rider.phone?.includes(term))
    })
    const gpsCount = riders.filter(rider => rider.is_active && locationState(roster.data?.locations.get(rider.id), Date.now()) === 'Recent GPS').length
    const selected = riders.find(rider => rider.id === review?.id)

    async function changeAccess() {
        if (!canEdit || !review || !selected || selected.is_active !== review.enabled || updating.current || roster.error) return
        updating.current = true
        setPending(true)
        setError('')
        setMessage('')
        try {
            const { data, error: failure } = await createClient().from('staff')
                .update({ is_active: !review.enabled }).eq('id', review.id).eq('restaurant_id', restaurantId)
                .in('role', ['rider', 'delivery']).eq('is_active', review.enabled).select('id').maybeSingle()
            if (failure || !data) throw new Error('Rider access could not be updated. Refresh the roster and try again.')
            setMessage(`${review.name}’s rider account was ${review.enabled ? 'disabled' : 'enabled'}.`)
            setReview(undefined)
            await roster.refresh()
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Rider access could not be updated.')
            await roster.refresh()
        } finally {
            updating.current = false
            setPending(false)
        }
    }

    return <main className={`${work.page} ${styles.page}`}>
        <DeliveryHeader label="Delivery operations" title="Rider roster" description="Manage access, check trip workload and see when location was last shared.">
            <LastSync at={roster.syncedAt} />
            <Link className={work.secondary} href="/dashboard/delivery-monitor"><Bike size={16} aria-hidden="true" /> Dispatch</Link>
            {canEdit && <Link className={work.primary} href="/dashboard/staff"><Plus size={17} aria-hidden="true" /> Manage staff</Link>}
            <RefreshDeliveries busy={roster.loading || feed.loading} onClick={() => { void roster.refresh(); void feed.refresh() }} />
        </DeliveryHeader>
        <dl className={`${styles.summary} ${styles.riderSummary}`}>
            <div><dt>Enabled</dt><dd>{roster.data ? enabled : '—'}</dd></div>
            <div><dt>With open work</dt><dd>{feed.data && roster.data ? riders.filter(rider => (workload.get(rider.id)?.active || 0) > 0).length : '—'}</dd></div>
            <div><dt>Recent GPS</dt><dd>{roster.data && !roster.data.locationError && !roster.error ? gpsCount : '—'}</dd></div>
        </dl>
        <div className={styles.stack}>
            <DeliveryNotice {...roster} />
            {feed.error && <p className={styles.alert} role="alert">Trip counts could not be refreshed.{feed.data && ' Showing the last synced counts.'}</p>}
            {roster.data?.locationError && <p className={styles.alert} role="alert">Rider locations could not be loaded.</p>}
            {message && <p className={styles.success} role="status">{message}</p>}
            <section className={work.panel} aria-label="Rider filters">
                <div className={styles.toolbar}>
                    <SearchField value={query} onChange={setQuery} placeholder="Search by rider name or phone number" />
                    <div className={work.filters} aria-label="Account filters">
                        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All accounts</button>
                        <button type="button" aria-pressed={filter === 'enabled'} onClick={() => setFilter('enabled')}>Enabled</button>
                        <button type="button" aria-pressed={filter === 'disabled'} onClick={() => setFilter('disabled')}>Disabled</button>
                    </div>
                </div>
            </section>
            {roster.data && !matching.length && <p className={styles.empty}>{riders.length ? 'No riders match these filters.' : 'There are no rider accounts for this restaurant.'}</p>}
            <div className={styles.roster}>
                {matching.map(rider => {
                    const counts = workload.get(rider.id)
                    const location = roster.data?.locations.get(rider.id)
                    const locationLabel = roster.data?.locationError || roster.error ? 'Unavailable' : locationState(location, Date.now())
                    const phone = phoneLink(rider.phone)
                    return <article key={rider.id} className={`${work.panel} ${styles.rosterCard} ${styles.stack}`}>
                        <header className={styles.rosterHeader}>
                            <span className={styles.tile} aria-hidden="true">{rider.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'R'}</span>
                            <h2>{rider.name}</h2>
                            <span className={styles.badge} data-tone={rider.is_active ? 'green' : 'neutral'}>{rider.is_active ? 'Enabled' : 'Disabled'}</span>
                        </header>
                        <dl className={styles.meta}>
                            <div><dt>Open deliveries</dt><dd>{feed.data ? counts?.active ?? 0 : '—'}</dd></div>
                            <div><dt>Completed deliveries</dt><dd>{feed.data ? counts?.delivered ?? 0 : '—'}</dd></div>
                            <div><dt>Location</dt><dd>{locationLabel}{location && locationLabel !== 'Unavailable' && <time dateTime={location.updated_at} title={new Date(location.updated_at).toLocaleString()}> · {new Date(location.updated_at).toDateString() === new Date().toDateString() ? timeLabel(location.updated_at) : new Date(location.updated_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</time>}</dd></div>
                        </dl>
                        <div className={styles.actions}>
                            {phone && <a className={work.secondary} href={phone}><Phone size={15} aria-hidden="true" /> Call</a>}
                            {canEdit && <button type="button" className={work.secondary} disabled={!!roster.error || pending} onClick={() => {
                                setError('')
                                setReview({ id: rider.id, name: rider.name, enabled: rider.is_active })
                            }}>{rider.is_active ? 'Disable' : 'Enable'} account</button>}
                            {Boolean(counts?.active) && <Link className={work.secondary} href="/dashboard/delivery-monitor">Dispatch <ArrowUpRight size={15} aria-hidden="true" /></Link>}
                        </div>
                    </article>
                })}
            </div>
        </div>
        {review && <ReviewDialog title={review.enabled ? 'Disable rider access' : 'Enable rider access'} subtitle={review.name} busy={pending} onClose={() => setReview(undefined)}>
            <div className={styles.stack}>
                <p>{review.enabled ? 'This rider will lose access and cannot receive new assignments.' : 'This rider will regain access and can receive delivery assignments.'}</p>
                {review.enabled && Boolean(workload.get(review.id)?.active) && <p className={styles.alert}>This rider has open deliveries. Check their handoff in dispatch before continuing.</p>}
                {(!selected || selected.is_active !== review.enabled) && <p className={styles.alert}>This account changed while you were reviewing it. Close this dialog and check the roster.</p>}
                {error && <p className={styles.alert} role="alert">{error}</p>}
                <button type="button" className={work.primary} disabled={pending || !!roster.error || selected?.is_active !== review.enabled}
                    onClick={() => void changeAccess()}>{pending ? 'Saving…' : review.enabled ? 'Disable rider' : 'Enable rider'}</button>
            </div>
        </ReviewDialog>}
    </main>
}
