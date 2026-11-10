import { ArrowUpRight, MapPin, Phone, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { phoneLink, stage, stages, timeLabel, type Delivery } from './delivery-data'
import work from './service-order.module.css'
import styles from './delivery.module.css'

export function DeliveryHeader({ label, title, description, children }: { label: string; title: string; description: string; children?: ReactNode }) {
    return <header className={styles.header}>
        <div><p className={work.kicker}>{label}</p><h1>{title}</h1><p className={styles.subhead}>{description}</p></div>
        <div className={styles.actions}>{children}</div>
    </header>
}

export function RefreshDeliveries({ busy, onClick }: { busy: boolean; onClick: () => void }) {
    return <button type="button" className={work.secondary} aria-label="Refresh" disabled={busy} onClick={onClick}>
        <RefreshCw size={16} aria-hidden="true" /> Refresh
    </button>
}

export function DeliveryBadge({ delivery }: { delivery: Delivery }) {
    const state = stages[stage(delivery)]
    return <span className={styles.badge} data-tone={state.tone}>{state.label}</span>
}

export function DeliveryNotice({ error, loading, syncedAt }: { error: string; loading: boolean; syncedAt: number }) {
    if (error) return <p className={styles.alert} role="alert">{error}{syncedAt > 0 && ' Showing the last synced data.'}</p>
    if (!syncedAt && loading) return <p className={styles.empty} role="status">Loading the latest information…</p>
    return null
}

export function DropOff({ delivery, directions = false }: { delivery: Delivery; directions?: boolean }) {
    const phone = phoneLink(delivery.customer_phone)
    return <div className={styles.dropoff}>
        <MapPin size={20} aria-hidden="true" />
        <div>
            <p className={styles.label}>Drop-off</p>
            <strong>{delivery.customer_name || 'Customer'}</strong>
            <p>{delivery.delivery_address || 'No address on this delivery'}</p>
            {(phone || (directions && delivery.delivery_address)) && <div className={styles.actions}>
                {phone && <a className={work.secondary} href={phone}><Phone size={15} aria-hidden="true" /> Call customer</a>}
                {directions && delivery.delivery_address && <a className={work.secondary}
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(delivery.delivery_address)}`}
                    target="_blank" rel="noreferrer">Directions <ArrowUpRight size={15} aria-hidden="true" /></a>}
            </div>}
        </div>
    </div>
}

export function LastSync({ at }: { at: number }) {
    return at > 0 ? <p className={styles.sync}><span aria-hidden="true" /> Synced at {timeLabel(new Date(at).toISOString())}</p> : null
}
