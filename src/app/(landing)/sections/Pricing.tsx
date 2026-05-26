'use client'

import { motion } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'
import Link from 'next/link'

const plans = [
    {
        name: 'Starter',
        price: 'Free',
        period: 'forever',
        description: 'Perfect for single-location restaurants getting started.',
        features: [
            'Up to 3 staff members',
            'Basic POS & order management',
            'Kitchen display system',
            'QR code ordering',
            'Email support',
        ],
        cta: 'Get Started',
        href: '/register',
        highlight: false,
    },
    {
        name: 'Professional',
        price: 'Rs 4,999',
        period: '/month',
        description: 'For growing restaurants with multiple staff and locations.',
        features: [
            'Unlimited staff members',
            'Multi-location management',
            'Advanced analytics & reports',
            'Delivery & rider management',
            'Staff performance tracking',
            'Priority support',
            'Custom integrations',
        ],
        cta: 'Start Free Trial',
        href: '/register',
        highlight: true,
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        period: 'pricing',
        description: 'For large chains with custom requirements.',
        features: [
            'Everything in Professional',
            'Dedicated account manager',
            'Custom feature development',
            'SLA & uptime guarantee',
            'On-premise deployment option',
            'Advanced security & audit logs',
        ],
        cta: 'Contact Sales',
        href: '#',
        highlight: false,
    },
]

export function Pricing() {
    return (
        <section id="pricing" className="py-20 lg:py-28 border-t border-[var(--border)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-16"
                >
                    <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
                        Simple, transparent pricing
                    </h2>
                    <p className="mt-4 text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
                        Start free, upgrade when you are ready. No hidden fees, no surprises.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {plans.map((plan, i) => (
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.4, delay: i * 0.1 }}
                            className={`
                                relative p-6 rounded-2xl border transition-all
                                ${plan.highlight
                                    ? 'bg-brand-subtle border-brand/20 shadow-glow'
                                    : 'bg-[var(--surface-raised)] border-[var(--border)] hover:border-[var(--border-strong)]'
                                }
                            `}
                        >
                            {plan.highlight && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand text-white text-xs font-semibold">
                                        <Sparkles className="w-3 h-3" />
                                        Most Popular
                                    </div>
                                </div>
                            )}
                            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{plan.name}</h3>
                            <div className="mt-4 mb-2">
                                <span className="text-3xl font-bold text-[var(--text-primary)]">{plan.price}</span>
                                <span className="text-sm text-[var(--text-muted)] ml-1">{plan.period}</span>
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] mb-6">{plan.description}</p>
                            <ul className="space-y-3 mb-6">
                                {plan.features.map(f => (
                                    <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                href={plan.href}
                                className={`
                                    block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-all
                                    ${plan.highlight
                                        ? 'bg-brand hover:bg-brand-hover text-white shadow-glow'
                                        : 'bg-[var(--surface-hover)] hover:bg-[var(--surface-active)] text-[var(--text-primary)]'
                                    }
                                `}
                            >
                                {plan.cta}
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
