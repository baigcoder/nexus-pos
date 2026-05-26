'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Menu, X, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', onScroll)
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    const links = [
        { label: 'Features', href: '#features' },
        { label: 'How it Works', href: '#how-it-works' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Docs', href: '#docs' },
    ]

    return (
        <nav
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                scrolled ? "glass border-b border-[var(--border)]" : "bg-transparent"
            )}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-2.5 group">
                        <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shadow-glow">
                            <Shield className="w-4.5 h-4.5 text-white" />
                        </div>
                        <span className="font-display font-bold text-lg text-[var(--text-primary)]">
                            Nexus<span className="text-brand">POS</span>
                        </span>
                    </Link>

                    <div className="hidden md:flex items-center gap-8">
                        {links.map(link => (
                            <a
                                key={link.href}
                                href={link.href}
                                className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>

                    <div className="hidden md:flex items-center gap-3">
                        <Link
                            href="/login"
                            className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-4 py-2"
                        >
                            Sign In
                        </Link>
                        <Link
                            href="/register"
                            className="text-sm font-semibold text-white bg-brand hover:bg-brand-hover px-5 py-2.5 rounded-lg transition-colors shadow-glow"
                        >
                            Start Free Trial
                        </Link>
                    </div>

                    <button
                        className="md:hidden p-2 rounded-lg hover:bg-[var(--surface-hover)]"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle menu"
                    >
                        {mobileOpen ? <X className="w-5 h-5 text-[var(--text-primary)]" /> : <Menu className="w-5 h-5 text-[var(--text-primary)]" />}
                    </button>
                </div>
            </div>

            {mobileOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="md:hidden glass border-b border-[var(--border)] px-4 pb-4"
                >
                    <div className="flex flex-col gap-2 pt-2">
                        {links.map(link => (
                            <a
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                                className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-2 transition-colors"
                            >
                                {link.label}
                            </a>
                        ))}
                        <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border)]">
                            <Link href="/login" className="text-sm font-medium text-[var(--text-secondary)] py-2">Sign In</Link>
                            <Link href="/register" className="text-sm font-semibold text-white bg-brand hover:bg-brand-hover px-4 py-2.5 rounded-lg text-center transition-colors">Start Free Trial</Link>
                        </div>
                    </div>
                </motion.div>
            )}
        </nav>
    )
}
