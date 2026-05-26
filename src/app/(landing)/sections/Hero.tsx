'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Play, TrendingUp, Clock, Users, Zap } from 'lucide-react'
import { HeroAnimation } from '@/components/landing/HeroAnimation'

export function Hero() {
    return (
        <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-brand/3 rounded-full blur-[100px]" />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                    {/* Text */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-subtle border border-brand/10 text-brand text-xs font-semibold mb-6">
                            <Zap className="w-3.5 h-3.5" />
                            Now with AI-powered analytics
                        </div>

                        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--text-primary)] leading-[1.1] tracking-tight">
                            The complete{' '}
                            <span className="text-brand">restaurant</span>{' '}
                            operating system
                        </h1>

                        <p className="mt-6 text-lg text-[var(--text-secondary)] leading-relaxed max-w-lg">
                            Real-time KDS, QR ordering, multi-location management, and intelligent analytics. Built for restaurants that move fast.
                        </p>

                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            <Link
                                href="/register"
                                className="inline-flex items-center gap-2 px-6 py-3.5 bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl transition-all shadow-glow hover:shadow-glow-lg"
                            >
                                Start Free Trial
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                            <button className="inline-flex items-center gap-2 px-6 py-3.5 bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] font-medium rounded-xl border border-[var(--border)] transition-all">
                                <Play className="w-4 h-4 text-brand" />
                                Watch Demo
                            </button>
                        </div>

                        <div className="mt-10 flex items-center gap-6 text-sm text-[var(--text-muted)]">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                <span>14-day free trial</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-sky-500" />
                                <span>5-min setup</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-violet-500" />
                                <span>Unlimited staff</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Visual */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="relative"
                    >
                        <div className="relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl">
                            <HeroAnimation />
                        </div>
                        {/* Floating stats cards */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6 }}
                            className="absolute -right-4 top-8 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-3 shadow-xl"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-xs text-[var(--text-muted)]">Revenue</p>
                                    <p className="text-sm font-bold text-[var(--text-primary)]">+24.5%</p>
                                </div>
                            </div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.8 }}
                            className="absolute -left-4 bottom-8 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-3 shadow-xl"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                                    <Clock className="w-4 h-4 text-brand" />
                                </div>
                                <div>
                                    <p className="text-xs text-[var(--text-muted)]">Avg Prep</p>
                                    <p className="text-sm font-bold text-[var(--text-primary)]">8.2 min</p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
