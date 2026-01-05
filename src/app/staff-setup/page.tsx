'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion } from 'framer-motion'
import {
    ChefHat,
    Lock,
    User,
    Phone,
    CheckCircle2,
    ArrowRight,
    Loader2,
    Shield,
    Sparkles
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

export default function StaffSetupPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#030303] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
        }>
            <StaffSetupContent />
        </Suspense>
    )
}

function StaffSetupContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { loginAsStaff, staff } = useAuthStore()
    const { success, error: showError } = useToast()

    const [step, setStep] = useState(1)
    const [isLoading, setIsLoading] = useState(false)
    const [staffData, setStaffData] = useState<any>(null)

    const [formData, setFormData] = useState({
        pin: '',
        confirmPin: '',
        phone: '',
    })

    // Get staff info from URL params
    const email = searchParams.get('email')
    const token = searchParams.get('token')
    const staffId = searchParams.get('id') || staff?.id

    useEffect(() => {
        // Need either email+token OR staffId
        if (!email && !staffId) {
            router.push('/staff-login')
            return
        }

        // Load staff data via server API (bypasses RLS)
        async function loadStaff() {
            try {
                // Use the staff-check API to get staff info
                const response = await fetch('/api/auth/staff-check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email?.toLowerCase() }),
                })

                const result = await response.json()

                if (!response.ok || !result.success) {
                    showError('Error', 'Staff member not found')
                    router.push('/staff-login')
                    return
                }

                if (!result.staff.needs_setup) {
                    // Already set up, redirect to dashboard
                    router.push('/dashboard')
                    return
                }

                setStaffData(result.staff)
            } catch (err) {
                showError('Error', 'Failed to load staff data')
                router.push('/staff-login')
            }
        }

        if (email) {
            loadStaff()
        } else if (staffId) {
            // Fallback to client-side for staffId (for backwards compatibility)
            const supabase = createClient()
            supabase
                .from('staff')
                .select('*, restaurants(*)')
                .eq('id', staffId)
                .single()
                .then(({ data, error }: { data: any; error: any }) => {
                    if (error || !data) {
                        showError('Error', 'Staff member not found')
                        router.push('/staff-login')
                        return
                    }
                    if (!data.needs_setup) {
                        router.push('/dashboard')
                        return
                    }
                    setStaffData(data)
                })
        }
    }, [email, staffId])

    const handlePinChange = (value: string, field: 'pin' | 'confirmPin') => {
        if (/^\d*$/.test(value) && value.length <= 4) {
            setFormData({ ...formData, [field]: value })
        }
    }

    const handleSubmit = async () => {
        if (formData.pin.length !== 4) {
            showError('Invalid PIN', 'PIN must be exactly 4 digits')
            return
        }

        if (formData.pin !== formData.confirmPin) {
            showError('PIN Mismatch', 'PINs do not match')
            return
        }

        setIsLoading(true)

        try {
            // Use server-side API to complete setup (bypasses RLS)
            const response = await fetch('/api/auth/staff-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email || staffData?.email,
                    tempPin: token,
                    newPin: formData.pin,
                    phone: formData.phone || null,
                }),
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to complete setup')
            }

            // Login the staff member
            loginAsStaff(result.staff, result.restaurant)
            success('Setup Complete!', 'Welcome to the team!')

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

        } catch (err: any) {
            showError('Error', err.message || 'Failed to complete setup')
        } finally {
            setIsLoading(false)
        }
    }

    if (!staffData) {
        return (
            <div className="min-h-screen bg-[#030303] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#030303] text-white flex items-center justify-center p-4 overflow-hidden relative">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_rgba(234,88,12,0.08)_0%,_transparent_50%)]" />
                <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_right,_rgba(16,185,129,0.05)_0%,_transparent_50%)]" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-10"
                >
                    <div className="inline-flex relative mb-6 group">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="absolute inset-0 -m-4 bg-emerald-500/20 blur-3xl rounded-full"
                        />
                        <div className="relative w-20 h-20 rounded-[1.75rem] bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-2xl">
                            <Sparkles className="w-9 h-9 text-white" />
                        </div>
                    </div>

                    <h1 className="text-3xl font-black tracking-tighter mb-2">
                        Welcome, <span className="text-emerald-500">{staffData.name}!</span>
                    </h1>
                    <p className="text-sm text-neutral-500 font-medium">
                        Let's set up your account at <span className="text-white">{staffData.restaurants?.name}</span>
                    </p>
                </motion.div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-3 mb-10">
                    {[1, 2].map((s) => (
                        <div
                            key={s}
                            className={cn(
                                "w-12 h-1.5 rounded-full transition-all",
                                step >= s ? "bg-emerald-500" : "bg-neutral-800"
                            )}
                        />
                    ))}
                </div>

                {/* Main Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative"
                >
                    <div className="absolute -inset-px bg-gradient-to-b from-white/10 to-transparent rounded-[2.5rem] pointer-events-none" />
                    <div className="bg-neutral-950/80 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-8 lg:p-10 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">

                        {step === 1 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-8"
                            >
                                <div className="text-center space-y-2">
                                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
                                        <Lock className="w-4 h-4 text-emerald-500" />
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">Step 1 of 2</span>
                                    </div>
                                    <h2 className="text-xl font-bold text-white">Create Your PIN</h2>
                                    <p className="text-sm text-neutral-500">Choose a 4-digit PIN for daily login</p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">New PIN</label>
                                        <input
                                            type="password"
                                            value={formData.pin}
                                            onChange={(e) => handlePinChange(e.target.value, 'pin')}
                                            placeholder="0 0 0 0"
                                            maxLength={4}
                                            className="w-full h-16 bg-black border border-neutral-800 rounded-2xl text-center text-2xl font-black tracking-[0.5em] text-emerald-500 placeholder:text-neutral-900 focus:border-emerald-500 transition-all outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Confirm PIN</label>
                                        <input
                                            type="password"
                                            value={formData.confirmPin}
                                            onChange={(e) => handlePinChange(e.target.value, 'confirmPin')}
                                            placeholder="0 0 0 0"
                                            maxLength={4}
                                            className="w-full h-16 bg-black border border-neutral-800 rounded-2xl text-center text-2xl font-black tracking-[0.5em] text-emerald-500 placeholder:text-neutral-900 focus:border-emerald-500 transition-all outline-none"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        if (formData.pin.length === 4 && formData.pin === formData.confirmPin) {
                                            setStep(2)
                                        } else if (formData.pin.length !== 4) {
                                            showError('Invalid', 'PIN must be 4 digits')
                                        } else {
                                            showError('Mismatch', 'PINs do not match')
                                        }
                                    }}
                                    className="w-full h-14 rounded-2xl font-bold uppercase text-sm tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-3"
                                >
                                    Continue
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-8"
                            >
                                <div className="text-center space-y-2">
                                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
                                        <User className="w-4 h-4 text-emerald-500" />
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">Step 2 of 2</span>
                                    </div>
                                    <h2 className="text-xl font-bold text-white">Profile Details</h2>
                                    <p className="text-sm text-neutral-500">Optional: Add your contact info</p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Phone Number (Optional)</label>
                                        <div className="relative">
                                            <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
                                            <input
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                placeholder="+1 234 567 8900"
                                                className="w-full h-16 bg-black border border-neutral-800 rounded-2xl pl-14 pr-5 text-lg font-bold text-white placeholder:text-neutral-700 focus:border-emerald-500 transition-all outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-white">Ready to Go!</p>
                                            <p className="text-xs text-neutral-500">Your account is almost set up</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSubmit}
                                    disabled={isLoading}
                                    className="w-full h-14 rounded-2xl font-bold uppercase text-sm tracking-widest bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Shield className="w-4 h-4" />
                                            Complete Setup
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => setStep(1)}
                                    className="w-full text-xs font-semibold text-neutral-500 hover:text-white transition-colors"
                                >
                                    ← Back to PIN setup
                                </button>
                            </motion.div>
                        )}
                    </div>
                </motion.div>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-8 text-center"
                >
                    <div className="flex items-center justify-center gap-2 text-neutral-600">
                        <Shield className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Your PIN is encrypted</span>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
