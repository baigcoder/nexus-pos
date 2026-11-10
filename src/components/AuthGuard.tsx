'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores'

interface AuthGuardProps {
    children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
    const router = useRouter()
    const pathname = usePathname()
    const { isAuthenticated, user, restaurant, staff, isHydrated: storeHydrated } = useAuthStore()
    const [isHydrated, setIsHydrated] = useState(false)

    useEffect(() => {
        setIsHydrated(true)
    }, [])

    useEffect(() => {
        if (!isHydrated || !storeHydrated) return

        if (!isAuthenticated) {
            const staffDevicePath =
                pathname.startsWith('/staff') ||
                pathname === '/waiter-order' ||
                pathname === '/kitchen-display'
            router.replace(staffDevicePath ? '/staff-login' : '/login')
            return
        }

        if (!restaurant && !staff && user) {
            router.replace('/setup')
        }
    }, [isHydrated, storeHydrated, isAuthenticated, user, restaurant, staff, router, pathname])

    if (!isHydrated || !storeHydrated) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-widest">Loading...</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        return null
    }

    return <>{children}</>
}
