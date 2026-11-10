'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Check } from 'lucide-react'
import { STARTER_STAFF_CAP } from '@/lib/plan'
import styles from '../service-pass.module.css'

export function Pricing() {
    const [yearly, setYearly] = useState(false)

    return (
        <section id="pricing" className={styles.pricing}>
            <div className={styles.container}>
                <div className={styles.pricingIntro}>
                    <div className={styles.sectionHeading}>
                        <p className={styles.eyebrow}><span /> PLANS</p>
                        <h2>Start with your next shift.</h2>
                    </div>
                    <div className={styles.cycle} role="group" aria-label="Billing cycle">
                        <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
                        <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly</button>
                    </div>
                </div>
                <div className={styles.plans}>
                    <article>
                        <p className={styles.planKicker}>01 / GET STARTED</p>
                        <h3>Starter</h3>
                        <p className={styles.planPrice}>Free to start</p>
                        <p>Set up your restaurant and run your first orders.</p>
                        <ul>
                            <li><Check size={17} aria-hidden="true" /> Up to {STARTER_STAFF_CAP} staff members</li>
                            <li><Check size={17} aria-hidden="true" /> POS and kitchen display</li>
                            <li><Check size={17} aria-hidden="true" /> QR ordering</li>
                        </ul>
                        <Link href="/register" className={styles.outline}>Start free <ArrowUpRight size={17} aria-hidden="true" /></Link>
                    </article>
                    <article className={styles.professional}>
                        <p className={styles.planKicker}>02 / GROW YOUR TEAM</p>
                        <h3>Professional</h3>
                        <p className={styles.planPrice} aria-live="polite">Rs {yearly ? '3,999' : '4,999'} <small>/ month{yearly ? ', billed yearly' : ''}</small></p>
                        <p>For restaurants with more staff and more moving parts.</p>
                        <ul>
                            <li><Check size={17} aria-hidden="true" /> Staff, shifts, and performance</li>
                            <li><Check size={17} aria-hidden="true" /> Analytics and reports</li>
                            <li><Check size={17} aria-hidden="true" /> Delivery and rider management</li>
                        </ul>
                        <Link href="/register" className={styles.primary}>Start free <ArrowUpRight size={17} aria-hidden="true" /></Link>
                    </article>
                </div>
            </div>
        </section>
    )
}
