'use client'

import { motion } from 'framer-motion'
import {
    ClipboardList, ChefHat, QrCode, Truck, Users, BarChart3,
    CreditCard, Settings, Bell, Globe, Shield, Zap
} from 'lucide-react'

const features = [
    {
        icon: ClipboardList,
        title: 'Order Management',
        description: 'Unified POS for dine-in, delivery, and takeout. Real-time sync across all devices.',
        color: 'text-brand',
        bg: 'bg-brand-subtle',
    },
    {
        icon: ChefHat,
        title: 'Kitchen Display',
        description: 'Priority-based KDS with elapsed timers, sound alerts, and fullscreen mode.',
        color: 'text-rose-500',
        bg: 'bg-rose-500/10',
    },
    {
        icon: QrCode,
        title: 'QR Ordering',
        description: 'Generate table QR codes for contactless self-ordering by customers.',
        color: 'text-sky-500',
        bg: 'bg-sky-500/10',
    },
    {
        icon: CreditCard,
        title: 'Billing & Payments',
        description: 'Split bills, apply discounts, and accept cash, card, or mobile payments.',
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
    },
    {
        icon: BarChart3,
        title: 'Analytics',
        description: 'Revenue trends, hourly distribution, top items, and staff performance metrics.',
        color: 'text-violet-500',
        bg: 'bg-violet-500/10',
    },
    {
        icon: Truck,
        title: 'Delivery',
        description: 'Rider assignment, route optimization, and real-time delivery tracking.',
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
    },
    {
        icon: Users,
        title: 'Staff & Shifts',
        description: 'Role-based access, shift scheduling, performance tracking, and tip management.',
        color: 'text-pink-500',
        bg: 'bg-pink-500/10',
    },
    {
        icon: Settings,
        title: 'Multi-Location',
        description: 'Manage multiple restaurants from a single dashboard with consolidated reporting.',
        color: 'text-cyan-500',
        bg: 'bg-cyan-500/10',
    },
    {
        icon: Shield,
        title: 'Enterprise Security',
        description: 'SOC-2 compliant infrastructure with role-based access control and audit logs.',
        color: 'text-indigo-500',
        bg: 'bg-indigo-500/10',
    },
    {
        icon: Bell,
        title: 'Notifications',
        description: 'Real-time alerts for new orders, low inventory, and staff actions.',
        color: 'text-orange-500',
        bg: 'bg-orange-500/10',
    },
    {
        icon: Globe,
        title: 'Integrations',
        description: 'Connect with Google Maps, Twilio, Shopify, WordPress, and more.',
        color: 'text-teal-500',
        bg: 'bg-teal-500/10',
    },
    {
        icon: Zap,
        title: 'Lightning Fast',
        description: 'Sub-100ms API responses. Offline-capable PWA for uninterrupted service.',
        color: 'text-yellow-500',
        bg: 'bg-yellow-500/10',
    },
]

export function Features() {
    return (
        <section id="features" className="py-20 lg:py-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-16"
                >
                    <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
                        Everything you need to{' '}
                        <span className="text-brand">run your restaurant</span>
                    </h2>
                    <p className="mt-4 text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
                        From order taking to analytics, NexusPOS covers every aspect of your restaurant operation.
                    </p>
                </motion.div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {features.map((feature, i) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.4, delay: i * 0.05 }}
                            className="group p-6 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all duration-300 hover:-translate-y-0.5"
                        >
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", feature.bg)}>
                                <feature.icon className={cn("w-5 h-5", feature.color)} />
                            </div>
                            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{feature.title}</h3>
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{feature.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function cn(...classes: (string | false | undefined)[]) {
    return classes.filter(Boolean).join(' ')
}
