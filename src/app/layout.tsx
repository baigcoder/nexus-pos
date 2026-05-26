import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'NexusPOS - Industrial-Grade Restaurant Management',
  description: 'The complete restaurant operating system. Real-time KDS, QR ordering, multi-location management, and intelligent analytics built for scale.',
  keywords: ['restaurant POS', 'kitchen display system', 'restaurant management', 'QR ordering', 'food delivery', 'NexusPOS'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="font-sans" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
