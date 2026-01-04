'use client'

import { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/toast'
import { ThemeProvider } from '@/components/ThemeProvider'

interface ProvidersProps {
    children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
    return (
        <ThemeProvider>
            <ToastProvider>
                {children}
            </ToastProvider>
        </ThemeProvider>
    )
}
