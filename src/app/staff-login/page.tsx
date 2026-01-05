'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChefHat,
    ArrowLeft,
    Delete,
    Mail,
    Fingerprint,
    ShieldCheck,
    Loader2,
    Zap,
    Wifi,
    KeyRound,
    User
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/common'
import { cn } from '@/lib/utils'

export default function StaffLoginPage() {
    const router = useRouter()
    const { loginAsStaff } = useAuthStore()
    const { success, error: showError } = useToast()

    const [step, setStep] = useState<'email' | 'pin'>('email')
    const [email, setEmail] = useState('')
    const [pin, setPin] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [staffPreview, setStaffPreview] = useState<any>(null)

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    const pinPadNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']

    const handlePinPress = (value: string) => {
        if (value === 'delete') {
            setPin(pin.slice(0, -1))
        } else if (value && pin.length < 6) {
            const newPin = pin + value
            setPin(newPin)
            // Auto-submit when PIN is complete (4 for regular, 6 for temp)
            if (newPin.length === 6 || (newPin.length === 4 && !staffPreview?.needs_setup)) {
                handlePinSubmit(newPin)
            }
        }
    }

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim()) return

        setIsLoading(true)
        setError(null)

        try {
            // Use dedicated endpoint to check if staff exists
            const response = await fetch('/api/auth/staff-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.toLowerCase().trim() }),
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                setError(result.error || 'No active staff account found with this email')
                return
            }

            // Staff found - set preview with their info and move to PIN step
            setStaffPreview({
                ...result.staff,
                email: email.toLowerCase().trim(),
            })
            setStep('pin')
        } catch (err) {
            setError('Failed to verify email. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const handlePinSubmit = async (pinCode: string) => {
        if (!staffPreview?.email) return

        setIsLoading(true)
        setError(null)

        try {
            // Use server-side API to verify PIN
            const response = await fetch('/api/auth/staff-email-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: staffPreview.email, pin: pinCode }),
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                setError(result.error || 'Invalid PIN')
                setPin('')
                setIsLoading(false)
                return
            }

            // Check if needs setup
            if (result.needsSetup) {
                success('PIN Verified!', 'Let\'s set up your account')
                router.push(result.setupUrl)
                return
            }

            // Regular login
            loginAsStaff(result.staff, result.restaurant)
            success('Welcome Back!', `Logged in as ${result.staff.name}`)

            // Redirect based on role
            const roleRoutes: Record<string, string> = {
                kitchen: '/dashboard/kitchen',
                waiter: '/dashboard/orders',
                cashier: '/dashboard/cashier',
                delivery: '/dashboard/delivery-boy',
                manager: '/dashboard',
                owner: '/dashboard',
            }
            router.push(roleRoutes[result.staff.role] || '/dashboard')
        } catch (err) {
            setError('Failed to verify PIN')
            setPin('')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#030303] text-white flex items-center justify-center p-4 overflow-hidden relative font-sans selection:bg-orange-500/30">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_rgba(234,88,12,0.08)_0%,_transparent_50%)]" />
                <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_right,_rgba(234,88,12,0.05)_0%,_transparent_50%)]" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] brightness-50 mix-blend-overlay" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Header Section */}
                <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-10"
                >
                    {/* Logo */}
                    <div className="inline-flex relative mb-8 group">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute inset-0 -m-4 bg-orange-500/20 blur-3xl rounded-full"
                        />
                        <div className="relative w-20 h-20 rounded-[1.75rem] bg-gradient-to-br from-neutral-900 to-neutral-950 border border-white/10 flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform duration-500">
                            <ChefHat className="w-9 h-9 text-orange-500" />
                        </div>
                    </div>

                    <h1 className="text-4xl font-black tracking-tighter mb-3">
                        Staff <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-500">Portal</span>
                    </h1>
                    <p className="text-sm text-neutral-500 font-medium">Secure access for team members</p>
                </motion.div>

                {/* Main Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="relative"
                >
                    <div className="absolute -inset-px bg-gradient-to-b from-white/10 to-transparent rounded-[2.5rem] pointer-events-none" />
                    <div className="bg-neutral-950/80 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-8 lg:p-10 shadow-[0_30px_60px_rgba(0,0,0,0.5)] relative overflow-hidden">

                        {/* Status Bar */}
                        <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                    <motion.div
                                        animate={{ opacity: [1, 0.5, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                                    />
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Online</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-neutral-600">
                                    <Wifi className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Secure</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-lg font-black tabular-nums tracking-tight text-white">
                                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </span>
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            {step === 'email' ? (
                                <motion.form
                                    key="email"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.3 }}
                                    onSubmit={handleEmailSubmit}
                                    className="space-y-6"
                                >
                                    <div className="text-center space-y-2">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/5 mb-4">
                                            <Mail className="w-4 h-4 text-orange-500" />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Step 1 of 2</span>
                                        </div>
                                        <h2 className="text-xl font-bold text-white">Enter Your Email</h2>
                                        <p className="text-sm text-neutral-500">The email your manager used to invite you</p>
                                    </div>

                                    <div className="relative group">
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                        <div className="relative">
                                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-orange-500 transition-colors" />
                                            <input
                                                type="email"
                                                placeholder="your@email.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full h-16 bg-neutral-900/50 border border-white/10 rounded-2xl pl-14 pr-5 text-lg font-bold text-white placeholder:text-neutral-700 focus:border-orange-500/50 focus:bg-neutral-900 transition-all outline-none"
                                                required
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center"
                                        >
                                            <p className="text-sm font-semibold text-rose-400">{error}</p>
                                        </motion.div>
                                    )}

                                    {/* Info Cards */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                                    <span className="text-[10px] font-bold text-emerald-400">6</span>
                                                </div>
                                                <span className="text-xs font-bold text-emerald-400">New Staff</span>
                                            </div>
                                            <p className="text-[10px] text-neutral-500 leading-relaxed">Use 6-digit PIN from invitation email</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                    <span className="text-[10px] font-bold text-blue-400">4</span>
                                                </div>
                                                <span className="text-xs font-bold text-blue-400">Existing Staff</span>
                                            </div>
                                            <p className="text-[10px] text-neutral-500 leading-relaxed">Use your 4-digit permanent PIN</p>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={!email.trim() || isLoading}
                                        className="w-full h-14 rounded-2xl font-bold uppercase text-sm tracking-widest bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Zap className="w-4 h-4" />
                                                Continue
                                            </>
                                        )}
                                    </button>

                                    <div className="text-center pt-2">
                                        <Link href="/login" className="text-xs font-semibold text-neutral-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                                            <ArrowLeft className="w-3.5 h-3.5" />
                                            Back to Admin Login
                                        </Link>
                                    </div>
                                </motion.form>
                            ) : (
                                <motion.div
                                    key="pin"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="space-y-6"
                                >
                                    {/* Back Button & Staff Info */}
                                    <div className="flex items-center justify-between">
                                        <button
                                            onClick={() => { setStep('email'); setPin(''); setError(null); setStaffPreview(null); }}
                                            className="flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-white transition-colors group"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                                            Change
                                        </button>
                                        <Badge className={cn(
                                            "px-3 py-1 font-bold text-[10px] uppercase tracking-wider",
                                            staffPreview?.needs_setup
                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                        )}>
                                            {staffPreview?.name || 'Staff'}
                                        </Badge>
                                    </div>

                                    {/* Staff Info Card */}
                                    {staffPreview?.role && (
                                        <div className="p-3 rounded-xl bg-neutral-900/50 border border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                                                    <User className="w-5 h-5 text-orange-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">{staffPreview.name}</p>
                                                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{staffPreview.role} • {staffPreview.restaurant?.name}</p>
                                                </div>
                                            </div>
                                            <Badge className={cn(
                                                "px-2 py-1 text-[9px] font-bold uppercase",
                                                staffPreview.needs_setup
                                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                            )}>
                                                {staffPreview.needs_setup ? 'New' : 'Active'}
                                            </Badge>
                                        </div>
                                    )}

                                    {/* PIN Header */}
                                    <div className="text-center space-y-2">
                                        <div className={cn(
                                            "inline-flex items-center gap-2 px-4 py-2 rounded-2xl border mb-4",
                                            staffPreview?.needs_setup
                                                ? "bg-emerald-500/5 border-emerald-500/10"
                                                : "bg-blue-500/5 border-blue-500/10"
                                        )}>
                                            <KeyRound className={cn(
                                                "w-4 h-4",
                                                staffPreview?.needs_setup ? "text-emerald-400" : "text-blue-400"
                                            )} />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Step 2 of 2</span>
                                        </div>
                                        <h2 className="text-xl font-bold text-white">
                                            {staffPreview?.needs_setup ? 'Enter Temporary PIN' : 'Enter Your PIN'}
                                        </h2>
                                        <p className="text-sm text-neutral-500">
                                            {staffPreview?.needs_setup
                                                ? '6-digit PIN from your invitation email'
                                                : '4-digit permanent access code'}
                                        </p>
                                    </div>

                                    {/* PIN Display */}
                                    <div className="flex justify-center gap-3 py-4">
                                        {Array.from({ length: staffPreview?.needs_setup ? 6 : 4 }).map((_, i) => (
                                            <motion.div
                                                key={i}
                                                animate={{
                                                    scale: pin.length > i ? 1 : 0.9,
                                                    opacity: pin.length > i ? 1 : 0.3
                                                }}
                                                className={cn(
                                                    "w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-200",
                                                    pin.length > i
                                                        ? "bg-orange-500 border-orange-500 shadow-lg shadow-orange-500/30"
                                                        : "bg-neutral-900/50 border-neutral-800"
                                                )}
                                            >
                                                {pin.length > i && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        className="w-2.5 h-2.5 rounded-full bg-white"
                                                    />
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Error Message */}
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center"
                                        >
                                            <p className="text-sm font-semibold text-rose-400">{error}</p>
                                        </motion.div>
                                    )}

                                    {/* PIN Pad */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {pinPadNumbers.map((num, i) => (
                                            <button
                                                key={i}
                                                onClick={() => num && handlePinPress(num)}
                                                disabled={isLoading || !num}
                                                className={cn(
                                                    "h-14 rounded-xl font-bold text-xl transition-all flex items-center justify-center active:scale-95",
                                                    num === 'delete'
                                                        ? "bg-neutral-900/50 text-neutral-500 hover:text-rose-500 hover:bg-rose-500/10"
                                                        : num
                                                            ? "bg-neutral-900 border border-white/5 hover:border-orange-500/30 hover:bg-neutral-800 text-white"
                                                            : "invisible pointer-events-none",
                                                    isLoading && "opacity-50 pointer-events-none"
                                                )}
                                            >
                                                {num === 'delete' ? (
                                                    <Delete className="w-5 h-5" />
                                                ) : (
                                                    num
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Loading Overlay */}
                                    {isLoading && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-[2.5rem]"
                                        >
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                                className="w-16 h-16 rounded-full border-2 border-orange-500 border-t-transparent mb-6"
                                            />
                                            <p className="text-sm font-bold text-white uppercase tracking-widest">Verifying...</p>
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-8 text-center flex items-center justify-center gap-4"
                >
                    <div className="flex items-center gap-2 text-neutral-600">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">End-to-end encrypted</span>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
