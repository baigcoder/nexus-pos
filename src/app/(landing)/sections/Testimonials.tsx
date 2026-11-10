'use client'

import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Star, Quote, Sparkles } from 'lucide-react'

const testimonials = [
    {
        name: 'Ahmed Khan',
        role: 'Owner, Karachi Biryani House',
        content: 'NexusPOS transformed how we operate. The kitchen display alone saved us 15 minutes per order during peak hours. Our staff adapted within a day.',
        rating: 5,
        avatar: 'K',
        bg: 'from-orange-500/10 to-orange-500/5',
        border: 'border-orange-500/20'
    },
    {
        name: 'Sara Malik',
        role: 'Manager, Lahore Cafe Co.',
        content: 'We run 3 locations and the multi-restaurant dashboard is a game changer. I can see all my outlets in real-time from my phone.',
        rating: 5,
        avatar: 'L',
        bg: 'from-violet-500/10 to-violet-500/5',
        border: 'border-violet-500/20'
    },
    {
        name: 'Imran Hussain',
        role: 'Head Chef, Islamabad Grill',
        content: 'The KDS is the best I have used. Sound alerts, priority flags, and the fullscreen mode make rush hours manageable.',
        rating: 5,
        avatar: 'I',
        bg: 'from-emerald-500/10 to-emerald-500/5',
        border: 'border-emerald-500/20'
    },
]

export function Testimonials() {
    const constraintRef = useRef(null)

    return (
        <section className="py-24 lg:py-32 relative overflow-hidden bg-[#050508] border-t border-white/5">
            {/* Background elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand/5 rounded-full blur-[140px]" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[140px]" />
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
                        Success Stories
                    </div>
                    <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-black text-white tracking-tight leading-tight">
                        Loved by restaurant teams
                    </h2>
                    <p className="mt-4 text-base text-[var(--text-secondary)] max-w-2xl mx-auto font-semibold">
                        Discover how restaurateurs and chefs are scaling their dining throughput and streamlining kitchen communications.
                    </p>
                </motion.div>

                {/* Drag-sliding Deck */}
                <div ref={constraintRef} className="overflow-hidden cursor-grab active:cursor-grabbing px-2 py-4">
                    <motion.div 
                        className="grid md:grid-cols-3 gap-6"
                    >
                        {testimonials.map((t, i) => (
                            <motion.div
                                key={t.name}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-50px' }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                className={`p-8 rounded-3xl bg-slate-950/60 border ${t.border} relative hover:border-brand/40 transition-all duration-300 backdrop-blur-md flex flex-col justify-between`}
                            >
                                <Quote className="w-9 h-9 text-brand/10 absolute top-6 right-6" />
                                
                                <div>
                                    <div className="flex gap-1 mb-5">
                                        {Array.from({ length: t.rating }).map((_, j) => (
                                            <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                                        ))}
                                    </div>
                                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-8 font-semibold italic">
                                        &ldquo;{t.content}&rdquo;
                                    </p>
                                </div>

                                <div className="flex items-center gap-3.5">
                                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${t.bg} border ${t.border} flex items-center justify-center font-display font-black text-xs text-white shadow-glow`}>
                                        {t.avatar}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-white">{t.name}</p>
                                        <p className="text-[10px] text-slate-400 font-semibold">{t.role}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
