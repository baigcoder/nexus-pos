'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { ArrowRight, CalendarDays, Check, Phone } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { GuestMasthead, GuestMessage } from '@/components/service/GuestJourney'
import { Quantity } from '@/components/service/ServiceOrder'
import styles from '@/components/service/service-order.module.css'
import journey from '@/components/service/guest-journey.module.css'

const times = [
    '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
    '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM',
]
const seating = ['Main Dining Hall', 'Cozy Booth', 'Windowside', 'Private Alcove']
type Restaurant = { name: string; logo_url?: string | null; phone?: string | null; address?: string | null }

function localDate(date: Date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function dateLabel(date: string) {
    return date ? new Intl.DateTimeFormat('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
        .format(new Date(`${date}T12:00:00`)) : 'Choose a date'
}

export default function BookTablePage() {
    return <Suspense fallback={<GuestMessage label="Reservations" title="Loading reservations" loading />}><BookingLink /></Suspense>
}

function BookingLink() {
    const slug = useSearchParams().get('restaurant')
    return slug ? <Reservation key={slug} slug={slug} /> : (
        <GuestMessage label="Reservations" title="Booking link needed" message="Open the reservation link provided by the restaurant." />
    )
}

function Reservation({ slug }: { slug: string }) {
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [retry, setRetry] = useState(0)
    const [date, setDate] = useState('')
    const [today, setToday] = useState('')
    const [time, setTime] = useState('')
    const [party, setParty] = useState(2)
    const [seat, setSeat] = useState(seating[0])
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [received, setReceived] = useState(false)
    const activeRequest = useRef(false)
    const confirmation = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        const current = new Date()
        setToday(localDate(current))
        current.setDate(current.getDate() + 1)
        setDate(localDate(current))
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        async function load() {
            setLoading(true)
            setLoadError('')
            try {
                const response = await fetch(`/api/v1/menu?restaurant=${encodeURIComponent(slug)}`, { signal: controller.signal })
                const data = await response.json()
                if (!response.ok || !data.restaurant) throw new Error(data.error || 'This restaurant is unavailable.')
                if (!controller.signal.aborted) setRestaurant(data.restaurant)
            } catch (error) {
                if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Could not load the restaurant.')
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }
        void load()
        return () => controller.abort()
    }, [slug, retry])

    useEffect(() => {
        if (received) confirmation.current?.focus()
    }, [received])

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!restaurant || activeRequest.current) return
        if (!name.trim() || !/^[\d\s+()-]{7,20}$/.test(phone.trim()) || !date || date < today || !time) {
            setSubmitError('Choose a date and time, then enter your name and a valid phone number.')
            return
        }
        activeRequest.current = true
        setSubmitting(true)
        setSubmitError('')
        try {
            const response = await fetch('/api/v1/reservations', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurant_slug: slug, customer_name: name.trim(), customer_phone: phone.trim(),
                    customer_email: email.trim() || undefined, date, time, party_size: party,
                    seating_preference: seat, special_requests: notes.trim() || undefined,
                }),
            })
            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data.error || 'Could not send your request.')
            setReceived(true)
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Could not send your request.')
        } finally {
            activeRequest.current = false
            setSubmitting(false)
        }
    }

    if (loading) return <GuestMessage label="Reservations" title="Loading reservations" loading />
    if (loadError || !restaurant) return <GuestMessage label="Reservations" title="Reservations unavailable" message={loadError || 'Restaurant not found.'} retry={() => setRetry(value => value + 1)} />

    const summary = (
        <dl className={journey.details}>
            <div><dt>Date</dt><dd>{dateLabel(date)}</dd></div>
            <div><dt>Time</dt><dd>{time || 'Choose a time'}</dd></div>
            <div><dt>Party</dt><dd>{party} {party === 1 ? 'guest' : 'guests'}</dd></div>
            <div><dt>Seating</dt><dd>{seat}</dd></div>
        </dl>
    )
    const phoneLink = restaurant.phone && <a href={`tel:${restaurant.phone}`} className={styles.secondary}><Phone size={16} aria-hidden="true" /> Call restaurant</a>

    if (received) return (
        <main className={`${styles.page} ${styles.guestTheme} ${styles.messagePage}`}>
            <section className={styles.messageCard} aria-labelledby="booking-received">
                <p className={styles.kicker}>{restaurant.name}</p>
                <h1 id="booking-received" ref={confirmation} tabIndex={-1}>Request received</h1>
                <p className={styles.success}><Check size={19} aria-hidden="true" /> The restaurant will contact you to confirm your table.</p>
                <div className="my-4">{summary}</div>
                {phoneLink && <div className={journey.actions}>{phoneLink}</div>}
            </section>
        </main>
    )

    return (
        <main className={`${styles.page} ${styles.guestTheme}`}>
            <GuestMasthead label="Table reservations" title={restaurant.name} logo={restaurant.logo_url} />
            <div className={`${styles.wrap} ${journey.content} ${journey.twoColumns}`}>
                <form onSubmit={submit} className={`${styles.panel} ${styles.receipt}`}>
                    <header className={styles.panelHead}><div><h2>Request a table</h2><p>Choose a time and leave a number for confirmation.</p></div><CalendarDays size={21} aria-hidden="true" /></header>
                    <div className={`${styles.panelBody} ${journey.stack}`}>
                        <fieldset className={journey.fields} disabled={submitting}>
                            <legend className={journey.sectionLabel}>Your visit</legend>
                            <div className={journey.fieldGrid}>
                                <label className={styles.field}>Date<input type="date" value={date} min={today} required onChange={event => setDate(event.target.value)} /></label>
                                <label className={styles.field}>Preferred time
                                    <select value={time} required onChange={event => setTime(event.target.value)}>
                                        <option value="">Choose a time</option>
                                        {times.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                                    </select>
                                </label>
                            </div>
                            <div className={journey.fieldGrid}>
                                <div className={styles.field}>Guests<div><Quantity name="guest count" value={party} min={1} max={8} onChange={delta => setParty(value => Math.min(8, Math.max(1, value + delta)))} /></div></div>
                                <label className={styles.field}>Seating preference
                                    <select value={seat} onChange={event => setSeat(event.target.value)}>{seating.map(option => <option key={option}>{option}</option>)}</select>
                                </label>
                            </div>
                            <p className={styles.muted}>For parties over eight, contact the restaurant.</p>
                        </fieldset>
                        <fieldset className={journey.fields} disabled={submitting}>
                            <legend className={journey.sectionLabel}>Contact details</legend>
                            <div className={journey.fieldGrid}>
                                <label className={styles.field}>Name<input autoComplete="name" maxLength={255} required value={name} onChange={event => setName(event.target.value)} /></label>
                                <label className={styles.field}>Phone<input type="tel" autoComplete="tel" maxLength={20} required value={phone} onChange={event => setPhone(event.target.value)} /></label>
                            </div>
                            <label className={styles.field}>Email (optional)<input type="email" autoComplete="email" maxLength={255} value={email} onChange={event => setEmail(event.target.value)} /></label>
                            <label className={styles.field}>Special requests (optional)<textarea rows={2} maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} /></label>
                        </fieldset>
                        {submitError && <p className={styles.error} role="alert">{submitError}</p>}
                        <button className={styles.primary} type="submit" disabled={submitting}>{submitting ? 'Sending request…' : 'Send reservation request'} <ArrowRight size={17} aria-hidden="true" /></button>
                    </div>
                </form>
                <aside className={styles.panel} aria-label="Visit summary">
                    <header className={styles.panelHead}><div><h2>Your visit</h2><p>Subject to restaurant confirmation</p></div></header>
                    <div className={styles.panelBody}>
                        {summary}
                        {restaurant.address && <p className={journey.intro}>{restaurant.address}</p>}
                        {phoneLink && <div className={journey.actions}>{phoneLink}</div>}
                    </div>
                </aside>
            </div>
        </main>
    )
}
