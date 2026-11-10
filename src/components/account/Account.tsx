'use client'

import Link from 'next/link'
import { AppearanceControl } from '@/components/AppearanceControl'
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { ArrowRight, Check, Eye, EyeOff, Loader2, Shield, Ticket } from 'lucide-react'
import styles from './account.module.css'

export function Account({ area, title, description, children, wide = false, stepKey }: {
    area: string; title: string; description?: ReactNode; children: ReactNode; wide?: boolean; stepKey?: number | string
}) {
    const heading = useRef<HTMLHeadingElement>(null)
    const previousStep = useRef({ title, stepKey })

    useEffect(() => {
        if (previousStep.current.title !== title || previousStep.current.stepKey !== stepKey) {
            heading.current?.focus({ preventScroll: true })
            heading.current?.scrollIntoView({ block: 'start' })
        }
        previousStep.current = { title, stepKey }
    }, [title, stepKey])

    return (
        <main className={`${styles.page} ${wide ? styles.wide : ''}`}>
            <aside className={styles.rail} aria-label="NexusPOS">
                <Brand />
                <div className={styles.railCopy}>
                    <p className={styles.kicker}>THE SERVICE PASS</p>
                    <p className={styles.statement}>Ready for service.</p>
                    <div className={styles.ticket} aria-hidden="true">
                        <div className={styles.ticketTop}><Ticket size={18} /> <span>SAMPLE TICKET</span></div>
                        <strong>#1084</strong>
                        <div className={styles.ticketLine}><span>Table 08</span><span>In prep</span></div>
                        <div className={styles.ticketLine}><span>2× Chicken biryani</span><span>01</span></div>
                    </div>
                </div>
                <p className={styles.railFoot}>Counter · Kitchen · Floor</p>
            </aside>
            <section className={styles.surface} aria-labelledby="account-title">
                <div className={styles.content}>
                    <div className={styles.accountTools}><div className={styles.mobileBrand}><Brand /></div><AppearanceControl /></div>
                    <header className={styles.heading}>
                        <p className={styles.kicker}>{area}</p>
                        <h1 id="account-title" ref={heading} tabIndex={-1}>{title}</h1>
                        {description && <p className={styles.description}>{description}</p>}
                    </header>
                    {children}
                </div>
            </section>
        </main>
    )
}

function Brand() {
    return <Link href="/" className={styles.brand}><span><Shield size={18} aria-hidden="true" /></span>NexusPOS</Link>
}

export function AccountLoading() {
    return <Account area="NexusPOS" title="One moment"><p className={styles.notice} role="status"><Loader2 size={18} className="motion-safe:animate-spin" aria-hidden="true" /> Loading…</p></Account>
}

export function AccountNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
    return <p role={error ? 'alert' : 'status'} className={error ? styles.error : styles.notice}>{children}</p>
}

export function AccountField({ label, hint, ...props }: ComponentProps<'input'> & { label: string; hint?: string }) {
    return (
        <label className={styles.field}>
            <span>{label}</span>
            <input {...props} />
            {hint && <small>{hint}</small>}
        </label>
    )
}

export function PasswordField({ label, hint, ...props }: Omit<ComponentProps<'input'>, 'type'> & { label: string; hint?: string }) {
    const [visible, setVisible] = useState(false)
    return (
        <div className={styles.password}>
            <AccountField label={label} hint={hint} {...props} type={visible ? 'text' : 'password'} />
            <button type="button" className={styles.show} aria-pressed={visible} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setVisible(!visible)}>
                {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
        </div>
    )
}

export function Submit({ children, busy, disabled }: { children: ReactNode; busy?: boolean; disabled?: boolean }) {
    return <button type="submit" className={styles.primary} disabled={busy || disabled}>{children}{busy ? <Loader2 size={17} className="motion-safe:animate-spin" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}</button>
}

export function AccountSteps({ labels, current }: { labels: string[]; current: number }) {
    return (
        <ol aria-label="Setup progress" className={styles.steps}>
            {labels.map((label, index) => (
                <li key={label} aria-current={index === current ? 'step' : undefined} data-done={index < current}>
                    <span aria-hidden="true">{index < current ? <Check size={13} /> : index + 1}</span>{label}
                </li>
            ))}
        </ol>
    )
}
