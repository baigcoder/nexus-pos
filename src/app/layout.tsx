import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'OrderFlow - Restaurant Order Management',
  description: 'Modern restaurant order management system with real-time kitchen display, waiter tablets, and customer QR ordering.',
  keywords: ['restaurant', 'order management', 'kitchen display', 'waiter', 'POS'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
