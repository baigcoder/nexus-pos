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
    const { isAuthenticated, user, restaurant, staff } = useAuthStore()
    const [isHydrated, setIsHydrated] = useState(false)

    useEffect(() => {
        setIsHydrated(true)
    }, [])

    useEffect(() => {
        if (!isHydrated) return
        if (!isAuthenticated) return

        if (!restaurant && !staff && user) {
            router.replace('/setup')
        }
    }, [isHydrated, isAuthenticated, user, restaurant, staff, router, pathname])

    if (!isHydrated) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest">Loading...</p>
                </div>
            </div>
        )
    }

    return <>{children}</>
}