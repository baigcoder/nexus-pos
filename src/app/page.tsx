'use client'

import { Navbar } from './(landing)/sections/Navbar'
import { Hero } from './(landing)/sections/Hero'
import { Features } from './(landing)/sections/Features'
import { HowItWorks } from './(landing)/sections/HowItWorks'
import { Testimonials } from './(landing)/sections/Testimonials'
import { Pricing } from './(landing)/sections/Pricing'
import { CTA } from './(landing)/sections/CTA'
import { Footer } from './(landing)/sections/Footer'

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[var(--background)]">
            <Navbar />
            <Hero />
            <Features />
            <HowItWorks />
            <Testimonials />
            <Pricing />
            <CTA />
            <Footer />
        </div>
    )
}
