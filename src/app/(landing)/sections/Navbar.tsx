'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AppearanceControl } from '@/components/AppearanceControl'
import { ArrowUpRight, Menu, Shield, X } from 'lucide-react'
import styles from '../service-pass.module.css'

export function Navbar() {
    const [open, setOpen] = useState(false)

    return (
        <header className={styles.navbar}>
            <div className={styles.container}>
                <Link href="/" className={styles.logo}><span className={styles.logoMark}><Shield size={17} aria-hidden="true" /></span>NexusPOS</Link>
                <div className={styles.mobileActions}>
                    <AppearanceControl />
                    <button
                        type="button"
                        className={styles.menuToggle}
                        aria-label={open ? 'Close navigation' : 'Open navigation'}
                        aria-expanded={open}
                        aria-controls="site-navigation"
                        onClick={() => setOpen(!open)}
                    >
                        {open ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
                <nav id="site-navigation" aria-label="Main navigation" className={styles.navigation} data-open={open}>
                    <div className={styles.navLinks}>
                        <a href="#features" onClick={() => setOpen(false)}>Product</a>
                        <a href="#table-demo" onClick={() => setOpen(false)}>QR ordering</a>
                        <a href="#how-it-works" onClick={() => setOpen(false)}>For owners</a>
                        <a href="#pricing" onClick={() => setOpen(false)}>Plans</a>
                    </div>
                    <div className={styles.navActions}>
                        <div className={styles.desktopAppearance}><AppearanceControl /></div>
                        <Link href="/login" onClick={() => setOpen(false)}>Sign in</Link>
                        <Link href="/register" className={styles.navTrial} onClick={() => setOpen(false)}>Start free <ArrowUpRight size={15} aria-hidden="true" /></Link>
                    </div>
                </nav>
            </div>
        </header>
    )
}
