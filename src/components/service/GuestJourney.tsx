'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Loader2, RefreshCw, Utensils } from 'lucide-react'
import styles from './service-order.module.css'
import journey from './guest-journey.module.css'

export function GuestMasthead({ title, label, logo, children }: { title: string; label: string; logo?: string | null; children?: ReactNode }) {
    return (
        <header className={styles.guestHero}>
            <div className={styles.wrap}>
                <div className={styles.brandBlock}>
                    <span className={styles.restaurantMark}>{logo ? <img src={logo} alt="" /> : <Utensils size={25} aria-hidden="true" />}</span>
                    <div><p className={styles.kicker}>{label}</p><h1>{title}</h1></div>
                </div>
                {children}
            </div>
        </header>
    )
}

export function GuestMessage({ label, title, message, loading, dark, retry }: {
    label: string; title: string; message?: string; loading?: boolean; dark?: boolean; retry?: () => void
}) {
    return (
        <main className={`${styles.page} ${styles.guestTheme} ${dark === undefined ? '' : dark ? styles.guestDark : styles.guestLight} ${styles.messagePage}`}>
            <section className={styles.messageCard} role={loading ? 'status' : undefined}>
                <p className={styles.kicker}>{label}</p><h1>{title}</h1>
                {loading && <Loader2 size={20} className="motion-safe:animate-spin" aria-hidden="true" />}
                {message && <p className={styles.muted}>{message}</p>}
                {retry && <div className={styles.messageActions}><button type="button" className={styles.secondary} onClick={retry}><RefreshCw size={16} aria-hidden="true" /> Try again</button></div>}
            </section>
        </main>
    )
}

export function ProgressList({ steps, current, complete }: { steps: string[]; current: number; complete?: boolean }) {
    return (
        <ol className={journey.progress} aria-label="Order progress">
            {steps.map((step, index) => {
                const passed = index < current || complete
                const active = index === current && !complete
                return (
                    <li key={step} data-stage={passed ? 'done' : active ? 'current' : 'next'} aria-current={active ? 'step' : undefined}>
                        <span className={journey.stepMark} aria-hidden="true">{passed ? <Check size={14} /> : index + 1}</span>
                        <span>{step}</span>
                        {passed && <span className="sr-only">Complete</span>}
                    </li>
                )
            })}
        </ol>
    )
}

export function readOrderToken() {
    return new URLSearchParams(window.location.hash.slice(1)).get('token')
}

export function useGuestTracking<T>(url: string, parse: (body: unknown) => T | null, isFinal: (data: T) => boolean, interval: number) {
    const [data, setData] = useState<T | null>(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [updated, setUpdated] = useState<Date | null>(null)
    const refreshRef = useRef<() => void>(() => {})
    const refresh = useCallback(() => refreshRef.current(), [])

    useEffect(() => {
        let timer: number | undefined
        let current: AbortController | undefined
        let disposed = false

        async function load(reset = false) {
            window.clearTimeout(timer)
            current?.abort()
            const controller = new AbortController()
            current = controller
            if (reset) {
                setData(null)
                setUpdated(null)
                setLoading(true)
            }
            const token = readOrderToken()
            if (!token) {
                setError('Open the secure link from your order confirmation.')
                setLoading(false)
                setRefreshing(false)
                return
            }
            setRefreshing(true)
            let poll = true
            try {
                const response = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: 'no-store',
                })
                if (controller.signal.aborted || disposed) return
                if ([401, 403, 404].includes(response.status)) {
                    setData(null)
                    setUpdated(null)
                    setError(response.status === 404 ? 'This order could not be found.' : 'This order link is invalid or has expired.')
                    poll = false
                    return
                }
                if (!response.ok) throw new Error('Status unavailable')
                const result = parse(await response.json())
                if (controller.signal.aborted || disposed) return
                if (!result) {
                    setData(null)
                    setUpdated(null)
                    setError('This order could not be found.')
                    poll = false
                    return
                }
                setData(result)
                setError('')
                setUpdated(new Date())
                poll = !isFinal(result)
            } catch {
                if (!controller.signal.aborted && !disposed) setError('Couldn’t refresh the order status. Check your connection and try again.')
            } finally {
                if (!controller.signal.aborted && !disposed) {
                    setLoading(false)
                    setRefreshing(false)
                    if (poll) timer = window.setTimeout(() => { void load() }, interval)
                }
            }
        }

        const reset = () => { void load(true) }
        refreshRef.current = () => { void load() }
        reset()
        window.addEventListener('hashchange', reset)
        return () => {
            disposed = true
            current?.abort()
            window.clearTimeout(timer)
            window.removeEventListener('hashchange', reset)
        }
    }, [url, parse, isFinal, interval])

    return { data, error, loading, refreshing, updated, refresh }
}
