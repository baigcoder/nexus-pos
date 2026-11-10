'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check, ChefHat, ClipboardList, RotateCcw, TicketCheck } from 'lucide-react'
import styles from '../service-pass.module.css'

const steps = [
    { label: 'Received', station: 'Order entry', action: 'Send to kitchen', icon: ClipboardList },
    { label: 'In prep', station: 'Kitchen', action: 'Mark ready', icon: ChefHat },
    { label: 'Ready', station: 'Handoff', action: 'Replay order', icon: TicketCheck },
]

export function Hero() {
    const [phase, setPhase] = useState(0)
    const step = steps[phase]

    return (
        <section className={styles.hero} aria-labelledby="hero-title">
            <div className={styles.container}>
                <div className={styles.heroGrid}>
                    <div className={styles.heroCopy}>
                        <p className={styles.eyebrow}><span /> BUILT FOR RESTAURANT OWNERS</p>
                        <h1 id="hero-title">Open your restaurant. <em>Run every service.</em></h1>
                        <p className={styles.lead}>Start with your menu and team. Then run orders, kitchen, delivery, and storefront promotions from NexusPOS.</p>
                        <div className={styles.heroActions}>
                            <Link className={styles.primary} href="/register">Start free <ArrowUpRight size={18} aria-hidden="true" /></Link>
                            <a className={styles.demoLink} href="#features">
                                Explore the product <ArrowRight size={16} aria-hidden="true" />
                            </a>
                        </div>
                    </div>

                    <div className={styles.demo} aria-label="Interactive order walkthrough">
                        <div className={styles.demoTop}>
                            <span className={styles.demoTitle}><span /> THE SERVICE PASS</span>
                            <span className={styles.demoLabel}>INTERACTIVE DEMO</span>
                        </div>
                        <div className={styles.demoStage} data-phase={phase}>
                            <div className={styles.rail} aria-label="Order stages">
                                {steps.map(({ label, icon: Icon }, index) => (
                                    <button key={label} type="button" aria-pressed={index === phase} onClick={() => setPhase(index)}>
                                        <Icon size={16} aria-hidden="true" /><span>{label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className={styles.ticket} aria-label="Sample order 1084, table 8">
                                <div className={styles.ticketTop}>
                                    <div><p>TABLE 08</p><strong>#1084</strong></div>
                                    <span className={styles.ticketState}>{phase === 2 && <Check size={13} aria-hidden="true" />}{step.label}</span>
                                </div>
                                <ul className={styles.ticketItems}>
                                    <li><b>2×</b> Chicken biryani</li>
                                    <li><b>1×</b> Mint lemonade</li>
                                </ul>
                                <div className={styles.ticketNote}>NOTE · One biryani mild</div>
                                <div className={styles.ticketBottom}><span>{step.station}</span><span aria-hidden="true">✦</span></div>
                            </div>
                        </div>
                        <div className={styles.demoFoot}>
                            <p><span>0{phase + 1} / 03</span> <span role="status">{step.label}</span></p>
                            <button type="button" onClick={() => setPhase((phase + 1) % steps.length)}>
                                {step.action} {phase === 2 ? <RotateCcw size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
