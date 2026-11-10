'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ClipboardList, ChefHat, QrCode, Truck, Users, BarChart3,
    CreditCard, Settings, Shield, Bell, Globe, Zap, Sparkles,
    CheckCircle2, ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

const categories = [
    {
        id: 'operations',
        title: 'Floor Operations',
        description: 'Supercharge order entries, kitchen routing, and tables.',
        features: [
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
        ],
        visual: {
            title: 'Interactive Order Pipeline',
            stats: [
                { label: 'Active orders', value: '42' },
                { label: 'Kitchen speed', value: '8.2 min' },
            ],
            badge: 'Operations Hub'
        }
    },
    {
        id: 'staff',
        title: 'Staff & Scheduling',
        description: 'Empower your crew with smart logins and shift trackers.',
        features: [
            {
                icon: Users,
                title: 'Staff & Shifts',
                description: 'Role-based access, shift scheduling, performance tracking, and tip management.',
                color: 'text-pink-500',
                bg: 'bg-pink-500/10',
            },
            {
                icon: Bell,
                title: 'Notifications',
                description: 'Real-time alerts for new orders, low inventory, and staff actions.',
                color: 'text-orange-500',
                bg: 'bg-orange-500/10',
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
        ],
        visual: {
            title: 'Team Attendance & Activity',
            stats: [
                { label: 'On Shift Now', value: '8 Staff' },
                { label: 'Tip Pool Today', value: 'Rs 12,400' },
            ],
            badge: 'Crew Control'
        }
    },
    {
        id: 'insights',
        title: 'Advanced Analytics',
        description: 'Make informed decisions with real-time sales reporting.',
        features: [
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
        ],
        visual: {
            title: 'Predictive Sales Analysis',
            stats: [
                { label: 'Weekly Revenue', value: '+18.4%' },
                { label: 'Top Category', value: 'Main Course' },
            ],
            badge: 'Insights Engine'
        }
    }
]

export function Features() {
    const [activeTab, setActiveTab] = useState('operations')
    const currentCategory = categories.find(c => c.id === activeTab)!

    return (
        <section id="features" className="py-24 lg:py-32 relative overflow-hidden bg-[#050508]">
            {/* Background elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-brand/5 rounded-full blur-[140px]" />
                <div className="absolute bottom-1/3 right-1/4 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[160px]" />
            </div>

            {/* Glowing dot grid overlay */}
            <div className="absolute inset-0 pointer-events-none bg-dot-grid opacity-[0.3]" />

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
                
                {/* Title */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-subtle border border-brand/20 text-brand text-xs font-bold mb-4">
                        <Sparkles className="w-3.5 h-3.5" />
                        Next-Gen Features
                    </div>
                    <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-black text-white tracking-tight leading-tight">
                        Everything you need to{' '}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand to-purple-400">run your restaurant</span>
                    </h2>
                    <p className="mt-4 text-base text-[var(--text-secondary)] max-w-2xl mx-auto font-semibold">
                        From order entry to cloud analytics, NexusPOS provides hardware-grade performance for modern fast-casual and fine-dining establishments.
                    </p>
                </motion.div>

                {/* Tab Selector */}
                <div className="flex flex-wrap justify-center gap-3 mb-12">
                    {categories.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setActiveTab(c.id)}
                            className={cn(
                                "px-6 py-3 rounded-xl text-sm font-bold border transition-all cursor-pointer",
                                activeTab === c.id
                                    ? "bg-brand text-white border-brand shadow-glow"
                                    : "bg-white/5 text-slate-400 border-white/5 hover:text-white hover:bg-white/10"
                            )}
                        >
                            {c.title}
                        </button>
                    ))}
                </div>

                {/* Grid Showcase */}
                <div className="grid lg:grid-cols-12 gap-8 items-center">
                    
                    {/* Features list (left side) - takes 7 columns */}
                    <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
                        <AnimatePresence mode="wait">
                            {currentCategory.features.map((feature, i) => (
                                <motion.div
                                    key={feature.title}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.4, delay: i * 0.05 }}
                                    className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-brand/40 shadow-premium hover:shadow-lg transition-all duration-300 group hover:-translate-y-[2px] backdrop-blur-md"
                                >
                                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-105 shadow-md", feature.bg)}>
                                        <feature.icon className={cn("w-4.5 h-4.5", feature.color)} />
                                    </div>
                                    <h3 className="text-sm font-bold text-white mb-2 font-display">{feature.title}</h3>
                                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-semibold">{feature.description}</p>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {/* Rich Interactive Visual Widget (right side) - takes 5 columns */}
                    <div className="lg:col-span-5 relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-brand to-purple-600 rounded-3xl blur opacity-20" />
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={{ duration: 0.4 }}
                                className="relative bg-slate-950 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl"
                            >
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-subtle border border-brand/20 text-brand text-[10px] font-bold mb-4">
                                    <Sparkles className="w-3 h-3" />
                                    {currentCategory.visual.badge}
                                </div>
                                <h3 className="text-lg font-black font-display text-white mb-2">{currentCategory.visual.title}</h3>
                                <p className="text-xs text-[var(--text-secondary)] font-semibold mb-6 leading-relaxed">
                                    {currentCategory.description} Experience zero-lag processing and automated queue synchronization.
                                </p>

                                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-5">
                                    {currentCategory.visual.stats.map((s, idx) => (
                                        <div key={idx} className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.label}</p>
                                            <p className="text-base font-black text-brand font-display mt-1">{s.value}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 flex items-center gap-2 text-xs font-bold text-brand hover:text-brand-hover cursor-pointer group">
                                    <span>Learn more about this suite</span>
                                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                </div>

            </div>
        </section>
    )
}
