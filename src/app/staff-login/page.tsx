'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChefHat,
    ArrowLeft,
    Delete,
    Building2,
    Utensils
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signInWithPin } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { Button, Input, Card, Badge } from '@/components/ui/common'
import { cn } from '@/lib/utils'

export default function StaffLoginPage() {
    const router = useRouter()
    const { loginAsStaff } = useAuthStore()
    const { success, error: showError } = useToast()

    const [step, setStep] = useState<'restaurant' | 'pin'>('restaurant')
    const [restaurantSlug, setRestaurantSlug] = useState('')
    const [pin, setPin] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const pinPadNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']

    const handlePinPress = (value: string) => {
        if (value === 'delete') {
            setPin(pin.slice(0, -1))
        } else if (value && pin.length < 4) {
            const newPin = pin + value
            setPin(newPin)

            if (newPin.length === 4) {
                handlePinSubmit(newPin)
            }
        }
    }

    const handleRestaurantSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (restaurantSlug.trim()) {
            setError(null)
            setStep('pin')
        }
    }

    const handlePinSubmit = async (pinCode: string) => {
        setIsLoading(true)
        setError(null)

        const result = await signInWithPin(restaurantSlug.toLowerCase().trim(), pinCode)

        if (result.success && result.staff && result.restaurant) {
            loginAsStaff(result.staff, result.restaurant)
            success('Nexus Synchronization Complete', `${result.staff.name} identity verified.`)

            if (result.staff.role === 'kitchen') {
                router.push('/dashboard/kitchen')
            } else if (result.staff.role === 'waiter') {
                router.push('/dashboard/orders')
            } else {
                router.push('/dashboard')
            }
        } else {
            setError(result.error || 'INVALID AUTH CIPHER')
            // Add a slight shake animation state if possible, but keeping it simple for now
            setPin('')
        }

        setIsLoading(false)
    }

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 overflow-hidden relative font-sans selection:bg-orange-500/30">
            {/* Tactical Grid Background */}
            <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ backgroundImage: `radial-gradient(circle at 2px 2px, #333 1px, transparent 0)`, backgroundSize: '40px 40px' }} />

            {/* Background Ambience */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.2, 0.1]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[-10%] left-[-10%] w-full h-full bg-orange-600/10 blur-[180px] rounded-full"
                />
                <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] bg-neutral-900/40 blur-[150px] rounded-full" />
            </div>

            <div className="w-full max-w-[460px] relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-6 mb-12"
                >
                    <div className="inline-flex relative group">
                        <div className="absolute inset-0 bg-orange-600/20 blur-2xl rounded-full group-hover:bg-orange-600/40 transition-all animate-pulse" />
                        <div className="relative w-24 h-24 rounded-[2.5rem] bg-neutral-900 border-2 border-orange-600/50 flex items-center justify-center text-orange-500 shadow-2xl transition-all group-hover:border-orange-600 group-hover:scale-105">
                            <ChefHat className="w-10 h-10 group-hover:rotate-12 transition-transform duration-500" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-5xl font-black tracking-tighter uppercase italic">
                            Staff <span className="text-orange-600">Terminal</span>
                        </h1>
                        <div className="flex items-center justify-center gap-3 mt-4">
                            <Badge variant="outline" className="bg-orange-600/10 text-orange-600 border-orange-600/20 px-4 py-1.5 font-black uppercase text-[10px] tracking-[0.3em] italic">
                                SECURE_LINK v2.0
                            </Badge>
                        </div>
                    </div>
                </motion.div>

                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-b from-orange-600/20 to-transparent rounded-[3rem] blur opacity-25 group-hover:opacity-40 transition-opacity" />
                    <Card className="bg-neutral-950/80 backdrop-blur-3xl border-2 border-neutral-900 rounded-[3rem] p-10 lg:p-14 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-orange-600/[0.03] rounded-bl-full pointer-events-none" />

                        <AnimatePresence mode="wait">
                            {step === 'restaurant' ? (
                                <motion.form
                                    key="restaurant"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    onSubmit={handleRestaurantSubmit}
                                    className="space-y-10 min-h-[440px] flex flex-col justify-center"
                                >
                                    <div className="space-y-4 text-center">
                                        <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.5em] italic">Access Point Identity</h3>
                                        <p className="text-lg font-medium text-neutral-400">Initialize <span className="text-white font-black italic uppercase">Terminal Sync</span></p>
                                    </div>

                                    <div className="relative group">
                                        <Building2 className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-neutral-700 group-focus-within:text-orange-600 transition-colors" />
                                        <input
                                            placeholder="e.g. CORE-MATRIX-01"
                                            value={restaurantSlug}
                                            onChange={(e: any) => setRestaurantSlug(e.target.value)}
                                            className="w-full h-20 bg-black border-2 border-neutral-900 rounded-3xl pl-20 pr-10 text-xl font-black italic tracking-widest text-white placeholder:text-neutral-800 focus:border-orange-600 transition-all outline-none"
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        className="h-20 rounded-3xl text-sm font-black uppercase tracking-[0.4em] bg-orange-600 hover:bg-orange-500 text-white shadow-2xl shadow-orange-600/30 font-black italic border-none group transition-all"
                                        disabled={!restaurantSlug.trim()}
                                    >
                                        Establish Link
                                    </Button>

                                    <div className="text-center">
                                        <Link href="/login" className="text-[10px] font-black text-neutral-600 hover:text-white transition-colors uppercase tracking-[0.4em] flex items-center justify-center gap-3 italic group">
                                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                            Return to Central Hub
                                        </Link>
                                    </div>
                                </motion.form>
                            ) : (
                                <motion.div
                                    key="pin"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="space-y-10"
                                >
                                    <div className="flex items-center justify-between">
                                        <button
                                            onClick={() => { setStep('restaurant'); setPin(''); setError(null); }}
                                            className="text-[10px] font-black text-neutral-600 hover:text-white uppercase tracking-[0.3em] transition-colors flex items-center gap-2 italic group"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                                            {restaurantSlug.toUpperCase()}
                                        </button>
                                        <Badge variant="outline" className="border-orange-600/30 text-orange-500 font-black text-[9px] uppercase tracking-widest italic animate-pulse">
                                            Waiting for Cipher
                                        </Badge>
                                    </div>

                                    {/* PIN Display */}
                                    <div className="flex justify-center gap-6 py-10 relative">
                                        <div className="absolute inset-0 bg-white/[0.02] blur-xl rounded-full pointer-events-none" />
                                        {[0, 1, 2, 3].map((i) => (
                                            <motion.div
                                                key={i}
                                                initial={false}
                                                animate={{
                                                    scale: pin.length > i ? 1.4 : 1,
                                                    boxShadow: pin.length > i ? '0 0 30px rgba(249,115,22,0.4)' : 'none'
                                                }}
                                                className={cn(
                                                    "w-6 h-6 rounded-lg rotate-45 border-2 transition-all duration-300",
                                                    pin.length > i
                                                        ? "bg-orange-600 border-orange-600"
                                                        : "bg-neutral-900 border-neutral-800"
                                                )}
                                            />
                                        ))}
                                    </div>

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-5 bg-rose-600/10 border-2 border-rose-600/20 rounded-2xl"
                                        >
                                            <p className="text-center text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] italic">
                                                ERROR: {error}
                                            </p>
                                        </motion.div>
                                    )}

                                    {/* PIN Pad */}
                                    <div className="grid grid-cols-3 gap-4">
                                        {pinPadNumbers.map((num, i) => (
                                            <button
                                                key={i}
                                                onClick={() => num && handlePinPress(num)}
                                                disabled={isLoading || !num}
                                                className={cn(
                                                    "h-20 rounded-3xl text-2xl font-black transition-all flex items-center justify-center active:scale-95 group relative",
                                                    num === 'delete'
                                                        ? "bg-neutral-900/50 text-neutral-600 hover:text-rose-500 hover:border-rose-600 animate-in"
                                                        : num
                                                            ? "bg-neutral-900 border-2 border-neutral-900 hover:border-orange-600/50 hover:bg-neutral-800 text-white shadow-xl italic"
                                                            : "invisible pointer-events-none",
                                                    isLoading && "opacity-50 pointer-events-none"
                                                )}
                                            >
                                                {num === 'delete' ? (
                                                    <Delete className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                                ) : (
                                                    num
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Card>
                </div>

                {/* Footer Metadata */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-12 text-center"
                >
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.5em] italic">
                        Node Identity: <span className="text-white/40">{typeof window !== 'undefined' ? window.location.hostname : 'SERVER'}</span> • Signal Strength: Optimal
                    </p>
                </motion.div>
            </div>
        </div>
    )
}
