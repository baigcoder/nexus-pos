'use client'

import { Shield, ArrowLeft, Home, LogOut } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'

interface AccessDeniedPageProps {
    className?: string
}

export function AccessDeniedPage({ className }: AccessDeniedPageProps) {
    const router = useRouter()
    const { userRole, logout } = useAuthStore()

    const roleRedirects: Record<string, string> = {
        owner: '/dashboard',
        manager: '/dashboard',
        waiter: '/waiter',
        kitchen: '/dashboard/kitchen-view',
        cashier: '/dashboard/cashier',
        delivery: '/dashboard/delivery-boy',
        rider: '/dashboard/delivery-boy',
    }

    const goHome = () => {
        const path = roleRedirects[userRole || ''] || '/staff-login'
        router.push(path)
    }

    return (
        <div className={cn('min-h-screen bg-[#030303] flex items-center justify-center p-4', className)}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center max-w-md"
            >
                <div className="w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
                    <Shield className="w-10 h-10 text-rose-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
                <p className="text-neutral-500 mb-6">
                    Your role <span className="text-white font-semibold capitalize">{userRole || 'Unknown'}</span> does not have permission to access this page.
                </p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={goHome}
                        className="h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Home className="w-4 h-4" />
                        Go to My Dashboard
                    </button>
                    <button
                        onClick={() => router.back()}
                        className="h-12 rounded-xl border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go Back
                    </button>
                    <button
                        onClick={() => { logout(); router.push('/staff-login') }}
                        className="h-12 rounded-xl text-neutral-500 hover:text-rose-400 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        Log Out
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
