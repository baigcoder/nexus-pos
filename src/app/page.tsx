import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, ChefHat, Megaphone, Shield, Store } from 'lucide-react'
import { Navbar } from './(landing)/sections/Navbar'
import { Hero } from './(landing)/sections/Hero'
import { ProductExplorer } from './(landing)/sections/ProductExplorer'
import { TableDemo } from './(landing)/sections/TableDemo'
import { Pricing } from './(landing)/sections/Pricing'
import styles from './(landing)/service-pass.module.css'

export const metadata: Metadata = {
    title: 'NexusPOS | Open, Run and Grow Your Restaurant',
    description: 'Build your menu and team, take orders, run the kitchen, manage delivery, and promote your restaurant on digital screens with NexusPOS.',
}

const ownerSteps = [
    { number: '01', title: 'Before you open', body: 'Build your menu and specials, lay out your tables, set up QR ordering, and give each staff member access to their station.', icon: Store },
    { number: '02', title: 'During the rush', body: 'Follow each order from the floor or counter to the kitchen. Manage reservations, hand off pickups, and send deliveries out with a rider.', icon: ChefHat },
    { number: '03', title: 'Between services', body: 'Check sales, expenses and stock, plan staff shifts, and queue your next offer for the storefront screen.', icon: Megaphone },
]

export default function LandingPage() {
    return (
        <div className={styles.site}>
            <a className={styles.skip} href="#main-content">Skip to content</a>
            <Navbar />
            <main id="main-content" tabIndex={-1}>
                <Hero />
                <ProductExplorer />
                <TableDemo />
                <section id="how-it-works" className={styles.shiftSection}>
                    <div className={styles.container}>
                        <div className={styles.sectionHeading}>
                            <p className={styles.eyebrow}><span /> FOR RESTAURANT OWNERS</p>
                            <h2>From opening day to a full house.</h2>
                            <p>For first-time owners setting up a restaurant and operators bringing their floor, kitchen, and back office together.</p>
                        </div>
                        <ol className={styles.stations}>
                            {ownerSteps.map(({ number, title, body, icon: Icon }) => <li key={number}>
                                <div className={styles.stationMeta}><Icon size={25} aria-hidden="true" /><span>{number} / 03</span></div>
                                <h3>{title}</h3><p>{body}</p>
                            </li>)}
                        </ol>
                        <Link href="/register" className={styles.textLink}>Set up your restaurant <ArrowUpRight size={17} aria-hidden="true" /></Link>
                    </div>
                </section>
                <Pricing />
                <section className={styles.closing}>
                    <div className={styles.container}>
                        <p className={styles.eyebrow}><span /> YOUR NEXT SERVICE</p>
                        <h2>Set up your restaurant for its first service.</h2>
                        <Link href="/register" className={styles.primary}>Start free <ArrowRight size={18} aria-hidden="true" /></Link>
                    </div>
                </section>
            </main>
            <footer className={styles.footer}>
                <div className={styles.container}>
                    <Link href="/" className={styles.logo}><span className={styles.logoMark}><Shield size={17} aria-hidden="true" /></span>NexusPOS</Link>
                    <nav aria-label="Footer">
                        <a href="#features">Product</a><a href="#table-demo">QR ordering</a><a href="#how-it-works">For owners</a><a href="#pricing">Plans</a>
                        <Link href="/login">Sign in</Link><Link href="/staff-login">Staff sign-in</Link>
                    </nav>
                    <small>© {new Date().getFullYear()} NexusPOS</small>
                </div>
            </footer>
        </div>
    )
}
