'use client'

import { motion } from 'framer-motion'
import { Star, Quote } from 'lucide-react'

const testimonials = [
    {
        name: 'Ahmed Khan',
        role: 'Owner, Karachi Biryani House',
        content: 'NexusPOS transformed how we operate. The kitchen display alone saved us 15 minutes per order during peak hours. Our staff adapted within a day.',
        rating: 5,
    },
    {
        name: 'Sara Malik',
        role: 'Manager, Lahore Cafe Co.',
        content: 'We run 3 locations and the multi-restaurant dashboard is a game changer. I can see all my outlets in real-time from my phone.',
        rating: 5,
    },
    {
        name: 'Imran Hussain',
        role: 'Head Chef, Islamabad Grill',
        content: 'The KDS is the best I have used. Sound alerts, priority flags, and the fullscreen mode make rush hours manageable.',
        rating: 5,
    },
]

export function Testimonials() {
    return (
        <section className="py-20 lg:py-28 border-t border-[var(--border)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-16"
                >
                    <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
                        Loved by restaurant teams
                    </h2>
                    <p className="mt-4 text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
                        Join hundreds of restaurants already using NexusPOS to streamline their operations.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-6">
                    {testimonials.map((t, i) => (
                        <motion.div
                            key={t.name}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.4, delay: i * 0.1 }}
                            className="p-6 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border)] relative"
                        >
                            <Quote className="w-8 h-8 text-brand/20 absolute top-4 right-4" />
                            <div className="flex gap-1 mb-4">
                                {Array.from({ length: t.rating }).map((_, j) => (
                                    <Star key={j} className="w-4 h-4 text-amber-500 fill-amber-500" />
                                ))}
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
                                &ldquo;{t.content}&rdquo;
                            </p>
                            <div>
                                <p className="text-sm font-semibold text-[var(--text-primary)]">{t.name}</p>
                                <p className="text-xs text-[var(--text-muted)]">{t.role}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
