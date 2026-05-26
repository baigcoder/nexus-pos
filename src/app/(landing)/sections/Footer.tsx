'use client'

import Link from 'next/link'
import { Shield, Github, Twitter, Linkedin } from 'lucide-react'

export function Footer() {
    return (
        <footer className="border-t border-[var(--border)] py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
                    <div>
                        <Link href="/" className="flex items-center gap-2 mb-4">
                            <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center">
                                <Shield className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-display font-bold text-[var(--text-primary)]">
                                Nexus<span className="text-brand">POS</span>
                            </span>
                        </Link>
                        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                            The complete restaurant operating system. Built for speed, scale, and simplicity.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Product</h4>
                        <ul className="space-y-2">
                            {['Features', 'Pricing', 'Integrations', 'Changelog'].map(item => (
                                <li key={item}>
                                    <a href="#" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">{item}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Company</h4>
                        <ul className="space-y-2">
                            {['About', 'Blog', 'Careers', 'Contact'].map(item => (
                                <li key={item}>
                                    <a href="#" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">{item}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Legal</h4>
                        <ul className="space-y-2">
                            {['Privacy Policy', 'Terms of Service', 'Security'].map(item => (
                                <li key={item}>
                                    <a href="#" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">{item}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-[var(--border)]">
                    <p className="text-xs text-[var(--text-muted)]">
                        &copy; {new Date().getFullYear()} NexusPOS. All rights reserved.
                    </p>
                    <div className="flex items-center gap-4">
                        <a href="#" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors" aria-label="Twitter">
                            <Twitter className="w-4 h-4" />
                        </a>
                        <a href="#" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors" aria-label="LinkedIn">
                            <Linkedin className="w-4 h-4" />
                        </a>
                        <a href="#" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors" aria-label="GitHub">
                            <Github className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    )
}
