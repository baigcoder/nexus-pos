'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

export function CTA() {
    return (
        <section className="py-24 lg:py-32 relative overflow-hidden bg-[#050508]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 25 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.6 }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand/15 to-purple-600/5 border border-brand/20 p-10 lg:p-16 text-center shadow-2xl shadow-brand/5 backdrop-blur-md"
                >
                    {/* Glowing mesh background indicators */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                    <div className="relative">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-subtle border border-brand/20 text-brand text-[10px] font-black uppercase tracking-wider mb-6 shadow-glow">
                            <Sparkles className="w-3.5 h-3.5" />
                            Immediate Onboarding
                        </div>

                        <h2 className="font-display text-3xl sm:text-4xl font-black text-white leading-tight">
                            Ready to transform your restaurant?
                        </h2>
                        
                        <p className="mt-4 text-base text-[var(--text-secondary)] max-w-xl mx-auto font-semibold">
                            Join hundreds of restaurants using NexusPOS to serve faster, optimize shift operations, and grow revenues.
                        </p>

                        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                            <Link
                                href="/register"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-all shadow-glow hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Start Free Trial
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 hover:border-brand/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Sign In
                            </Link>
                        </div>

                        <p className="mt-6 text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest">
                            No credit card required • 14-day free trial • Cancel anytime
                        </p>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
