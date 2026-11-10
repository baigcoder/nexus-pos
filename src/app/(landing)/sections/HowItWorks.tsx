'use client'

import { motion } from 'framer-motion'
import { Store, Settings, ClipboardList, BarChart3, Sparkles } from 'lucide-react'

const steps = [
    {
        step: '01',
        icon: Store,
        title: 'Set up your restaurant',
        description: 'Create your account, add restaurant locations, and configure menus in under 5 minutes.',
        color: 'text-brand border-brand/20 bg-brand/5'
    },
    {
        step: '02',
        icon: Settings,
        title: 'Configure your team',
        description: 'Invite staff members, assign security roles, and configure PIN-based quick logins.',
        color: 'text-purple-400 border-purple-500/20 bg-purple-500/5'
    },
    {
        step: '03',
        icon: ClipboardList,
        title: 'Start taking orders',
        description: 'Take phone entries, launch table QR self-ordering, and route flows directly to KDS.',
        color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
    },
    {
        step: '04',
        icon: BarChart3,
        title: 'Grow with insights',
        description: 'Monitor kitchen speeds, track margins, and leverage data to optimize floor capacity.',
        color: 'text-sky-400 border-sky-500/20 bg-sky-500/5'
    },
]

export function HowItWorks() {
    return (
        <section id="how-it-works" className="py-24 lg:py-32 relative overflow-hidden bg-[#050508] border-t border-white/5">
            {/* Background ambient glows */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[140px]" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px]" />
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
                    className="text-center mb-20"
                >
                    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-subtle border border-brand/20 text-brand text-xs font-bold mb-4">
                        <Sparkles className="w-3.5 h-3.5" />
                        Simple Journey
                    </div>
                    <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-black text-white tracking-tight leading-tight">
                        Up and running in <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand to-purple-400">minutes</span>
                    </h2>
                    <p className="mt-4 text-base text-[var(--text-secondary)] max-w-2xl mx-auto font-semibold">
                        No complicated hardware. No painful legacy migrations. Just a simple, powerful system that boosts productivity from day one.
                    </p>
                </motion.div>

                {/* Steps Cards Timeline */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch relative">
                    {steps.map((s, i) => (
                        <motion.div
                            key={s.step}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="p-6.5 rounded-3xl bg-slate-950/60 border border-white/5 hover:border-brand/40 shadow-premium relative backdrop-blur-md hover:-translate-y-[2px] transition-all duration-300 group flex flex-col justify-between"
                        >
                            {/* Connector line for large screens */}
                            {i < steps.length - 1 && (
                                <div className="hidden lg:block absolute top-[45px] left-full w-full h-[1px] bg-gradient-to-r from-white/10 to-transparent z-0 pointer-events-none" />
                            )}

                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <div className="text-slate-400 text-xs font-mono font-black tracking-widest">{s.step} / FOUR</div>
                                    <div className="h-2 w-2 rounded-full bg-brand" />
                                </div>
                                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-5 shadow-glow ${s.color}`}>
                                    <s.icon className="w-5 h-5 shrink-0" />
                                </div>
                                <h3 className="text-sm font-bold text-white mb-2 font-display">{s.title}</h3>
                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-semibold">{s.description}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

            </div>
        </section>
    )
}
