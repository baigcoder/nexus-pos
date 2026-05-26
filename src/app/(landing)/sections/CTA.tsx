'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function CTA() {
    return (
        <section className="py-20 lg:py-28">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.5 }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/10 p-10 lg:p-16 text-center"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand/5 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2" />

                    <div className="relative">
                        <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
                            Ready to transform your restaurant?
                        </h2>
                        <p className="mt-4 text-lg text-[var(--text-secondary)] max-w-xl mx-auto">
                            Join hundreds of restaurants using NexusPOS to serve faster, smarter, and better.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                            <Link
                                href="/register"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl transition-all shadow-glow hover:shadow-glow-lg"
                            >
                                Start Free Trial
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] font-medium rounded-xl border border-[var(--border)] transition-all"
                            >
                                Sign In
                            </Link>
                        </div>
                        <p className="mt-4 text-xs text-[var(--text-muted)]">
                            No credit card required. 14-day free trial. Cancel anytime.
                        </p>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
