'use client'

import { motion } from 'framer-motion'
import { Store, Settings, ClipboardList, BarChart3 } from 'lucide-react'

const steps = [
    {
        step: '01',
        icon: Store,
        title: 'Set up your restaurant',
        description: 'Create your account, add your restaurant details, and configure your menu in under 5 minutes.',
    },
    {
        step: '02',
        icon: Settings,
        title: 'Configure your team',
        description: 'Invite staff members, assign roles, and set up shift schedules with PIN-based quick login.',
    },
    {
        step: '03',
        icon: ClipboardList,
        title: 'Start taking orders',
        description: 'Use the POS for dine-in, generate QR codes for tables, and accept delivery orders seamlessly.',
    },
    {
        step: '04',
        icon: BarChart3,
        title: 'Grow with insights',
        description: 'Track revenue, monitor kitchen performance, and make data-driven decisions to optimize operations.',
    },
]

export function HowItWorks() {
    return (
        <section id="how-it-works" className="py-20 lg:py-28 border-t border-[var(--border)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-16"
                >
                    <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
                        Up and running in <span className="text-brand">minutes</span>
                    </h2>
                    <p className="mt-4 text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
                        No complex setup. No lengthy onboarding. Just a simple, powerful system that works.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {steps.map((s, i) => (
                        <motion.div
                            key={s.step}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.4, delay: i * 0.1 }}
                            className="relative"
                        >
                            {i < steps.length - 1 && (
                                <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-[var(--border)] to-transparent" />
                            )}
                            <div className="text-[var(--text-muted)] text-xs font-mono font-bold mb-4">{s.step}</div>
                            <div className="w-12 h-12 rounded-xl bg-brand-subtle flex items-center justify-center mb-4">
                                <s.icon className="w-6 h-6 text-brand" />
                            </div>
                            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{s.title}</h3>
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{s.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
