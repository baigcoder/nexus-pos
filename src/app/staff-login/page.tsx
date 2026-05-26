'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChefHat, ArrowLeft, Delete, Mail, Fingerprint, ShieldCheck, Loader2,
    Zap, Wifi, WifiOff, KeyRound, User, CheckCircle2, Phone, MapPin,
    Camera, Eye, EyeOff, Clock, AlertTriangle, Sparkles, LogIn,
    Users, X, ChevronRight, Shield, Ban
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/common'
import { cn } from '@/lib/utils'

type LoginStep = 'email' | 'temp_pin' | 'setup_pin' | 'profile_setup' | 'login_pin' | 'setup_complete' | 'forgot_pin'

interface StaffProfile {
    name: string
    phone: string
    location: string
    avatar_url: string | null
}

interface SavedAccount {
    email: string
    name: string
    role: string
    restaurantName: string
    timestamp: number
}

const STEPS: Record<Exclude<LoginStep, 'forgot_pin' | 'setup_complete'>, { label: string; stepNum: number }> = {
    email: { label: 'Email', stepNum: 1 },
    temp_pin: { label: 'Temp PIN', stepNum: 2 },
    setup_pin: { label: 'Create PIN', stepNum: 3 },
    profile_setup: { label: 'Profile', stepNum: 4 },
    login_pin: { label: 'PIN', stepNum: 2 },
}

const TOTAL_STEPS = 4

function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(true)
    useEffect(() => {
        const handler = () => setIsOnline(navigator.onLine)
        window.addEventListener('online', handler)
        window.addEventListener('offline', handler)
        setIsOnline(navigator.onLine)
        return () => {
            window.removeEventListener('online', handler)
            window.removeEventListener('offline', handler)
        }
    }, [])
    return isOnline
}

function getSavedAccounts(): SavedAccount[] {
    try {
        const raw = localStorage.getItem('orderflow-staff-accounts')
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

function saveAccount(account: SavedAccount) {
    const existing = getSavedAccounts().filter((a) => a.email !== account.email)
    existing.unshift(account)
    localStorage.setItem('orderflow-staff-accounts', JSON.stringify(existing.slice(0, 5)))
}

export default function StaffLoginPage() {
    const router = useRouter()
    const { loginAsStaff } = useAuthStore()
    const { success, error: showError } = useToast()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const emailInputRef = useRef<HTMLInputElement>(null)
    const isOnline = useOnlineStatus()

    const [step, setStep] = useState<LoginStep>('email')
    const [email, setEmail] = useState('')
    const [pin, setPin] = useState('')
    const [confirmPin, setConfirmPin] = useState('')
    const [pinVisible, setPinVisible] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [shake, setShake] = useState(false)
    const [currentTime, setCurrentTime] = useState<string>('')
    const [staffPreview, setStaffPreview] = useState<any>(null)
    const [pinLength, setPinLength] = useState(4)
    const [verifiedTempPin, setVerifiedTempPin] = useState('')
    const [rememberMe, setRememberMe] = useState(false)
    const [termsAccepted, setTermsAccepted] = useState(false)
    const [retryAfter, setRetryAfter] = useState<number>(0)
    const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([])
    const [showAccountSwitcher, setShowAccountSwitcher] = useState(false)
    const [restaurantInfo, setRestaurantInfo] = useState<any>(null)
    const [forgotPinLoading, setForgotPinLoading] = useState(false)
    const [forgotPinSuccess, setForgotPinSuccess] = useState<string | null>(null)

    const [profile, setProfile] = useState<StaffProfile>({
        name: '',
        phone: '',
        location: '',
        avatar_url: null
    })
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

    // Timer for retry countdown
    useEffect(() => {
        if (retryAfter <= 0) return
        const interval = setInterval(() => {
            setRetryAfter((r) => {
                if (r <= 1) {
                    clearInterval(interval)
                    return 0
                }
                return r - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [retryAfter])

    // Clock
    useEffect(() => {
        const update = () => setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
        update()
        const interval = setInterval(update, 1000)
        return () => clearInterval(interval)
    }, [])

    // Load saved accounts
    useEffect(() => {
        setSavedAccounts(getSavedAccounts())
    }, [])

    // Auto-focus email
    useEffect(() => {
        if (step === 'email') {
            setTimeout(() => emailInputRef.current?.focus(), 300)
        }
    }, [step])

    // Keyboard support
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (step === 'email') return
            if (step === 'forgot_pin') return

            if (e.key === 'Backspace') {
                e.preventDefault()
                handlePinPress('delete')
            } else if (/^[0-9]$/.test(e.key)) {
                e.preventDefault()
                handlePinPress(e.key)
            } else if (e.key === 'Enter' && step === 'profile_setup') {
                e.preventDefault()
                if (termsAccepted) handleProfileSubmit()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [step, pin, confirmPin, isLoading, termsAccepted])

    const pinPadNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']

    const triggerShake = () => {
        setShake(true)
        setTimeout(() => setShake(false), 500)
    }

    const handlePinPress = useCallback((value: string) => {
        if (value === 'delete') {
            if (step === 'setup_pin') {
                setConfirmPin((p) => p.slice(0, -1))
            } else {
                setPin((p) => p.slice(0, -1))
            }
        } else if (value) {
            if (step === 'setup_pin') {
                setConfirmPin((p) => {
                    if (p.length >= 4) return p
                    return p + value
                })
            } else if (step === 'temp_pin' || step === 'login_pin') {
                setPin((p) => {
                    if (p.length >= pinLength) return p
                    const newPin = p + value
                    if (newPin.length === pinLength) {
                        setTimeout(() => handlePinSubmit(newPin), 100)
                    }
                    return newPin
                })
            }
        }
    }, [step, pinLength])

    const fetchRestaurantInfo = async (restaurantId: string) => {
        try {
            const res = await fetch(`/api/settings/restaurant?restaurantId=${restaurantId}`)
            if (res.ok) {
                const data = await res.json()
                setRestaurantInfo(data.restaurant || null)
            }
        } catch {
            // silent fail
        }
    }

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim() || !isOnline) return

        setIsLoading(true)
        setError(null)
        setForgotPinSuccess(null)

        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000)

            const response = await fetch('/api/auth/staff-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.toLowerCase().trim() }),
                signal: controller.signal
            })

            clearTimeout(timeoutId)
            const result = await response.json()

            if (!response.ok || !result.success) {
                setError(result.error || 'No active staff account found with this email')
                triggerShake()
                setIsLoading(false)
                return
            }

            setProfile((prev) => ({ ...prev, name: result.staff.name || '' }))
            setStaffPreview({
                ...result.staff,
                email: email.toLowerCase().trim(),
            })

            if (result.staff.restaurant_id) {
                fetchRestaurantInfo(result.staff.restaurant_id)
            }

            if (result.staff.needs_setup) {
                setPinLength(6)
                setStep('temp_pin')
            } else {
                setPinLength(4)
                setStep('login_pin')
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                setError('Request timed out. Please try again.')
            } else {
                setError('Failed to verify email. Please try again.')
            }
            triggerShake()
        } finally {
            setIsLoading(false)
        }
    }

    const handlePinSubmit = async (pinCode: string) => {
        if (!staffPreview?.email || !isOnline) return

        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/auth/staff-email-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: staffPreview.email,
                    pin: pinCode,
                    setupPin: step === 'setup_pin' ? confirmPin : undefined
                }),
            })

            const result = await response.json()

            if (response.status === 429 && result.retryAfter) {
                setRetryAfter(result.retryAfter)
                setError(result.error || 'Too many attempts')
                triggerShake()
                setPin('')
                setConfirmPin('')
                setIsLoading(false)
                return
            }

            if (!response.ok || !result.success) {
                setError(result.error || 'Invalid PIN')
                triggerShake()
                setPin('')
                setConfirmPin('')
                setIsLoading(false)
                return
            }

            if (result.needsSetup && result.verified && !result.justSetup) {
                setVerifiedTempPin(pinCode)
                setStep('setup_pin')
                setPin('')
                setIsLoading(false)
                return
            }

            if (result.justSetup) {
                setStep('profile_setup')
                setIsLoading(false)
                return
            }

            completeLogin(result.staff, result.restaurant)

        } catch (err: any) {
            setError('Failed to verify PIN. Please try again.')
            triggerShake()
            setPin('')
        } finally {
            setIsLoading(false)
        }
    }

    const handleProfileSubmit = async () => {
        if (!staffPreview?.email || confirmPin.length !== 4 || !verifiedTempPin || !isOnline) return
        if (!termsAccepted) {
            setError('Please accept the Terms of Service to continue')
            return
        }

        setIsLoading(true)
        setError(null)

        const avatarUrl = avatarPreview

        try {
            const response = await fetch('/api/auth/staff-email-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: staffPreview.email,
                    pin: verifiedTempPin,
                    setupPin: confirmPin,
                    profileData: {
                        name: profile.name.trim() || staffPreview.name,
                        phone: profile.phone.trim(),
                        avatar_url: avatarUrl
                    }
                }),
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                setError(result.error || 'Failed to complete setup')
                setIsLoading(false)
                return
            }

            setStep('setup_complete')
            setTimeout(() => {
                completeLogin(result.staff, result.restaurant)
            }, 2500)

        } catch (err: any) {
            setError('Failed to save profile. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleForgotPin = async () => {
        if (!email.trim() || !isOnline) return
        setForgotPinLoading(true)
        setError(null)
        setForgotPinSuccess(null)

        try {
            const res = await fetch('/api/auth/forgot-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.toLowerCase().trim() }),
            })
            const data = await res.json()

            if (!res.ok) {
                if (res.status === 429 && data.retryAfter) {
                    setRetryAfter(data.retryAfter)
                }
                setError(data.error || 'Failed to reset PIN')
                triggerShake()
            } else {
                setForgotPinSuccess(data.message)
                setStep('email')
            }
        } catch {
            setError('Failed to send reset request')
        } finally {
            setForgotPinLoading(false)
        }
    }

    const completeLogin = (staff: any, restaurant: any) => {
        loginAsStaff(staff, restaurant)

        const authState = {
            user: null,
            restaurant: restaurant,
            staff: staff,
            userRole: staff.role,
            isAuthenticated: true,
            isLoading: false,
            loginMode: 'staff' as const,
        }

        const storage = rememberMe ? localStorage : sessionStorage
        storage.setItem('orderflow-auth', JSON.stringify({ state: authState, version: 0 }))

        saveAccount({
            email: staff.email,
            name: staff.name,
            role: staff.role,
            restaurantName: restaurant?.name || '',
            timestamp: Date.now(),
        })

        const roleRedirects: Record<string, string> = {
            kitchen: '/dashboard/kitchen-view',
            waiter: '/waiter',
            cashier: '/dashboard/cashier',
            delivery: '/dashboard/delivery-boy',
            rider: '/dashboard/delivery-boy',
            manager: '/dashboard',
            owner: '/dashboard',
        }
        const redirectPath = roleRedirects[staff.role] || '/staff-portal'

        setTimeout(() => router.push(redirectPath), 100)
    }

    const resetToEmail = () => {
        setStep('email')
        setEmail('')
        setPin('')
        setConfirmPin('')
        setVerifiedTempPin('')
        setError(null)
        setForgotPinSuccess(null)
        setRetryAfter(0)
        setStaffPreview(null)
        setProfile({ name: '', phone: '', location: '', avatar_url: null })
        setAvatarPreview(null)
        setTermsAccepted(false)
    }

    const selectSavedAccount = (account: SavedAccount) => {
        setEmail(account.email)
        setShowAccountSwitcher(false)
        setTimeout(() => {
            emailInputRef.current?.focus()
        }, 100)
    }

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 2 * 1024 * 1024) {
            setError('Image must be under 2MB')
            return
        }
        const reader = new FileReader()
        reader.onloadend = () => setAvatarPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    const getStepInfo = () => {
        if (step === 'login_pin') return { current: 2, total: 2, label: 'Enter PIN' }
        if (step === 'temp_pin') return { current: 2, total: 4, label: 'Temp PIN' }
        if (step === 'setup_pin') return { current: 3, total: 4, label: 'Create PIN' }
        if (step === 'profile_setup') return { current: 4, total: 4, label: 'Profile' }
        return { current: 1, total: 4, label: 'Email' }
    }

    const stepInfo = getStepInfo()

    return (
        <div className="min-h-screen bg-[#030303] text-white flex items-center justify-center p-4 overflow-hidden relative font-sans selection:bg-orange-500/30">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_rgba(234,88,12,0.08)_0%,_transparent_50%)]" />
                <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_right,_rgba(234,88,12,0.05)_0%,_transparent_50%)]" />
                <div className="absolute inset-0 bg-gradient-to-br from-orange-900/20 via-transparent to-blue-900/20" />
            </div>

            {/* Offline Banner */}
            <AnimatePresence>
                {!isOnline && (
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="fixed top-0 left-0 right-0 z-50 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-2"
                    >
                        <WifiOff className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-amber-400">No internet connection</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="w-full max-w-md relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-8"
                >
                    <div className="inline-flex relative mb-6 group">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute inset-0 -m-4 bg-orange-500/20 blur-3xl rounded-full"
                        />
                        <div className="relative w-20 h-20 rounded-[1.75rem] bg-gradient-to-br from-neutral-900 to-neutral-950 border border-white/10 flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                            {restaurantInfo?.logo_url ? (
                                <img src={restaurantInfo.logo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <ChefHat className="w-9 h-9 text-orange-500" />
                            )}
                        </div>
                    </div>

                    <h1 className="text-4xl font-black tracking-tighter mb-2">
                        {restaurantInfo?.name ? (
                            <>{restaurantInfo.name} <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-500">Staff</span></>
                        ) : (
                            <>Staff <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-500">Portal</span></>
                        )}
                    </h1>
                    <p className="text-sm text-neutral-500 font-medium">Secure access for team members</p>
                </motion.div>

                {/* Progress Stepper */}
                {step !== 'forgot_pin' && step !== 'setup_complete' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 mb-6 px-2"
                    >
                        {Array.from({ length: stepInfo.total }).map((_, i) => (
                            <div key={i} className="flex-1 flex items-center gap-2">
                                <div className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                                    i + 1 < stepInfo.current ? 'bg-emerald-500 text-white' :
                                    i + 1 === stepInfo.current ? 'bg-orange-500 text-white ring-4 ring-orange-500/20' :
                                    'bg-neutral-800 text-neutral-500'
                                )}>
                                    {i + 1 < stepInfo.current ? (
                                        <CheckCircle2 className="w-4 h-4" />
                                    ) : (
                                        <span>{i + 1}</span>
                                    )}
                                </div>
                                {i < stepInfo.total - 1 && (
                                    <div className={cn(
                                        'flex-1 h-1 rounded-full transition-all',
                                        i + 1 < stepInfo.current ? 'bg-emerald-500' : 'bg-neutral-800'
                                    )} />
                                )}
                            </div>
                        ))}
                    </motion.div>
                )}

                {/* Main Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className={cn('relative', shake && 'animate-shake')}
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
                                <span className="text-lg font-black tabular-nums tracking-tight text-white">{currentTime}</span>
                            </div>
                        </div>

                        {/* Retry Countdown */}
                        <AnimatePresence>
                            {retryAfter > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2"
                                >
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    <span className="text-xs font-medium text-amber-400">
                                        Too many attempts. Try again in {Math.floor(retryAfter / 60)}:{String(retryAfter % 60).padStart(2, '0')}
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <AnimatePresence mode="wait">
                            {/* STEP 1: Email */}
                            {step === 'email' && (
                                <motion.div
                                    key="email"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.3 }}
                                    className="space-y-6"
                                >
                                    <div className="text-center space-y-2">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/5 mb-4">
                                            <Mail className="w-4 h-4 text-orange-500" />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Step 1 of 4</span>
                                        </div>
                                        <h2 className="text-xl font-bold text-white">Enter Your Email</h2>
                                        <p className="text-sm text-neutral-500">The email your manager used to invite you</p>
                                    </div>

                                    {/* Saved Accounts */}
                                    {savedAccounts.length > 0 && (
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => setShowAccountSwitcher((s) => !s)}
                                                className="flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-orange-400 transition-colors mx-auto"
                                            >
                                                <Users className="w-3.5 h-3.5" />
                                                {showAccountSwitcher ? 'Hide saved accounts' : `Use a saved account (${savedAccounts.length})`}
                                            </button>
                                            <AnimatePresence>
                                                {showAccountSwitcher && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="space-y-2 overflow-hidden"
                                                    >
                                                        {savedAccounts.map((account) => (
                                                            <button
                                                                key={account.email}
                                                                onClick={() => selectSavedAccount(account)}
                                                                className="w-full p-3 bg-neutral-900/50 border border-neutral-800 rounded-xl flex items-center gap-3 hover:border-orange-500/30 transition-colors text-left"
                                                            >
                                                                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                                                                    <User className="w-4 h-4 text-orange-500" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-semibold text-white truncate">{account.name}</p>
                                                                    <p className="text-xs text-neutral-500 truncate">{account.email}</p>
                                                                </div>
                                                                <Badge className="px-2 py-0.5 text-[10px] uppercase bg-neutral-800 text-neutral-400 border-neutral-700">
                                                                    {account.role}
                                                                </Badge>
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}

                                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                                        <div className="relative group">
                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                            <div className="relative">
                                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-orange-500 transition-colors" />
                                                <input
                                                    ref={emailInputRef}
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

                                        {forgotPinSuccess && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center"
                                            >
                                                <p className="text-sm font-semibold text-emerald-400">{forgotPinSuccess}</p>
                                            </motion.div>
                                        )}

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
                                            disabled={!email.trim() || isLoading || !isOnline}
                                            className="w-full h-14 rounded-2xl font-bold uppercase text-sm tracking-widest bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                                        >
                                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Zap className="w-4 h-4" />Continue</>}
                                        </button>
                                    </form>

                                    <div className="flex items-center justify-between pt-2">
                                        <button
                                            onClick={() => { setStep('forgot_pin'); setError(null); setForgotPinSuccess(null) }}
                                            className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                                        >
                                            Forgot PIN?
                                        </button>
                                        <Link href="/login" className="text-xs font-semibold text-neutral-500 hover:text-white transition-colors flex items-center gap-1">
                                            <ArrowLeft className="w-3 h-3" /> Admin Login
                                        </Link>
                                    </div>
                                </motion.div>
                            )}

                            {/* FORGOT PIN */}
                            {step === 'forgot_pin' && (
                                <motion.div
                                    key="forgot_pin"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="space-y-6"
                                >
                                    <div className="text-center space-y-2">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-500/5 border border-rose-500/10 mb-4">
                                            <KeyRound className="w-4 h-4 text-rose-400" />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Reset PIN</span>
                                        </div>
                                        <h2 className="text-xl font-bold text-white">Forgot Your PIN?</h2>
                                        <p className="text-sm text-neutral-500">Enter your email and we'll send a temporary reset PIN</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
                                            <input
                                                type="email"
                                                placeholder="your@email.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full h-14 bg-neutral-900/50 border border-white/10 rounded-2xl pl-14 pr-5 text-lg font-bold text-white placeholder:text-neutral-700 focus:border-rose-500/50 focus:bg-neutral-900 transition-all outline-none"
                                            />
                                        </div>

                                        {error && (
                                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center">
                                                <p className="text-sm font-semibold text-rose-400">{error}</p>
                                            </motion.div>
                                        )}

                                        {forgotPinSuccess && (
                                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
                                                <p className="text-sm font-semibold text-emerald-400">{forgotPinSuccess}</p>
                                            </motion.div>
                                        )}

                                        <button
                                            onClick={handleForgotPin}
                                            disabled={!email.trim() || forgotPinLoading || !isOnline || retryAfter > 0}
                                            className="w-full h-14 rounded-2xl font-bold uppercase text-sm tracking-widest bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                                        >
                                            {forgotPinLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><KeyRound className="w-4 h-4" />Send Reset PIN</>}
                                        </button>
                                    </div>

                                    <button onClick={() => setStep('email')} className="w-full text-xs font-semibold text-neutral-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                                    </button>
                                </motion.div>
                            )}

                            {/* STEP 2a: Temp PIN */}
                            {step === 'temp_pin' && (
                                <motion.div key="temp_pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <button onClick={resetToEmail} className="flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-white transition-colors group">
                                            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Change
                                        </button>
                                        <Badge className="px-3 py-1 font-bold text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border-emerald-500/20">New Staff</Badge>
                                    </div>

                                    <StaffPreviewCard staffPreview={staffPreview} restaurantInfo={restaurantInfo} />

                                    <div className="text-center space-y-2">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border bg-emerald-500/5 border-emerald-500/10 mb-4">
                                            <KeyRound className="w-4 h-4 text-emerald-400" />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Step 2 of 4</span>
                                        </div>
                                        <h2 className="text-xl font-bold text-white">Enter Temporary PIN</h2>
                                        <p className="text-sm text-neutral-500">6-digit PIN from your invitation email</p>
                                    </div>

                                    <PinDisplay length={6} pin={pin} color="orange" />

                                    {error && (
                                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center">
                                            <p className="text-sm font-semibold text-rose-400">{error}</p>
                                        </motion.div>
                                    )}

                                    <PinPad onPress={handlePinPress} disabled={isLoading} />
                                </motion.div>
                            )}

                            {/* STEP 2b: Login PIN */}
                            {step === 'login_pin' && (
                                <motion.div key="login_pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <button onClick={resetToEmail} className="flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-white transition-colors group">
                                            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Change
                                        </button>
                                        <Badge className="px-3 py-1 font-bold text-[10px] uppercase tracking-wider bg-blue-500/10 text-blue-400 border-blue-500/20">Active Staff</Badge>
                                    </div>

                                    <StaffPreviewCard staffPreview={staffPreview} restaurantInfo={restaurantInfo} />

                                    <div className="text-center space-y-2">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border bg-blue-500/5 border-blue-500/10 mb-4">
                                            <KeyRound className="w-4 h-4 text-blue-400" />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Enter PIN</span>
                                        </div>
                                        <h2 className="text-xl font-bold text-white">Enter Your PIN</h2>
                                        <p className="text-sm text-neutral-500">4-digit permanent access code</p>
                                    </div>

                                    <div className="flex items-center justify-center gap-2">
                                        <PinDisplay length={4} pin={pin} color="blue" />
                                        <button
                                            onClick={() => setPinVisible((v) => !v)}
                                            className="p-2 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                                            title={pinVisible ? 'Hide PIN' : 'Show PIN'}
                                        >
                                            {pinVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {pinVisible && pin && <p className="text-center text-sm font-mono text-neutral-400 tracking-widest">{pin}</p>}

                                    {error && (
                                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center">
                                            <p className="text-sm font-semibold text-rose-400">{error}</p>
                                        </motion.div>
                                    )}

                                    <PinPad onPress={handlePinPress} disabled={isLoading} />

                                    <div className="flex items-center justify-between">
                                        <button onClick={() => { setStep('forgot_pin'); setError(null) }} className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors">
                                            Forgot PIN?
                                        </button>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-orange-500 focus:ring-orange-500"
                                            />
                                            <span className="text-xs text-neutral-400">Remember me</span>
                                        </label>
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 3: Setup Permanent PIN */}
                            {step === 'setup_pin' && (
                                <motion.div key="setup_pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <button onClick={() => setStep('temp_pin')} className="flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-white transition-colors group">
                                            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Back
                                        </button>
                                        <Badge className="px-3 py-1 font-bold text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Step 3 of 4</Badge>
                                    </div>

                                    <div className="text-center space-y-2">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border bg-emerald-500/5 border-emerald-500/10 mb-4">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Temporary PIN Verified!</span>
                                        </div>
                                        <h2 className="text-xl font-bold text-white">Create Your 4-Digit PIN</h2>
                                        <p className="text-sm text-neutral-500">This will be your permanent login code</p>
                                    </div>

                                    <div className="space-y-4">
                                        <PinDisplay length={4} pin={confirmPin} color="emerald" />
                                        <p className="text-center text-xs text-neutral-500">
                                            {confirmPin.length === 0 ? 'Enter your 4-digit PIN' : confirmPin.length < 4 ? `${4 - confirmPin.length} more digits` : 'PIN ready — press Continue'}
                                        </p>
                                    </div>

                                    {error && (
                                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center">
                                            <p className="text-sm font-semibold text-rose-400">{error}</p>
                                        </motion.div>
                                    )}

                                    <PinPad onPress={handlePinPress} disabled={isLoading} maxLength={4} />

                                    {confirmPin.length === 4 && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                            <button onClick={() => setStep('profile_setup')} className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2">
                                                Continue to Profile <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}

                            {/* STEP 4: Profile Setup */}
                            {step === 'profile_setup' && (
                                <motion.div key="profile_setup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <button onClick={() => setStep('setup_pin')} className="flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-white transition-colors group">
                                            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Back
                                        </button>
                                        <Badge className="px-3 py-1 font-bold text-[10px] uppercase tracking-wider bg-orange-500/10 text-orange-400 border-orange-500/20">Step 4 of 4</Badge>
                                    </div>

                                    <div className="text-center space-y-2">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border bg-orange-500/5 border-orange-500/10 mb-4">
                                            <User className="w-4 h-4 text-orange-400" />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Complete Your Profile</span>
                                        </div>
                                        <h2 className="text-xl font-bold text-white">Tell Us About Yourself</h2>
                                        <p className="text-sm text-neutral-500">Update your profile information</p>
                                    </div>

                                    {/* Avatar Upload */}
                                    <div className="flex justify-center mb-4">
                                        <div className="relative">
                                            <div className="w-24 h-24 rounded-full bg-neutral-900 border-2 border-dashed border-neutral-700 flex items-center justify-center overflow-hidden">
                                                {avatarPreview ? (
                                                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <User className="w-10 h-10 text-neutral-600" />
                                                )}
                                            </div>
                                            <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white hover:bg-orange-600 transition-colors">
                                                <Camera className="w-4 h-4" />
                                            </button>
                                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
                                            <input type="text" placeholder="Your Full Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="w-full h-14 bg-neutral-900/50 border border-white/10 rounded-xl pl-12 pr-4 text-white placeholder:text-neutral-700 focus:border-orange-500/50 focus:bg-neutral-900 transition-all outline-none" />
                                        </div>
                                        <div className="relative">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
                                            <input type="tel" placeholder="Phone Number (optional)" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="w-full h-14 bg-neutral-900/50 border border-white/10 rounded-xl pl-12 pr-4 text-white placeholder:text-neutral-700 focus:border-orange-500/50 focus:bg-neutral-900 transition-all outline-none" />
                                        </div>
                                        <div className="relative">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
                                            <input type="text" placeholder="Your Location (optional)" value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} className="w-full h-14 bg-neutral-900/50 border border-white/10 rounded-xl pl-12 pr-4 text-white placeholder:text-neutral-700 focus:border-orange-500/50 focus:bg-neutral-900 transition-all outline-none" />
                                        </div>
                                    </div>

                                    {/* Terms Acceptance */}
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={termsAccepted}
                                            onChange={(e) => setTermsAccepted(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-orange-500 focus:ring-orange-500"
                                        />
                                        <span className="text-xs text-neutral-400 leading-relaxed">
                                            I agree to the{' '}
                                            <Link href="/terms" target="_blank" className="text-orange-400 hover:underline">Terms of Service</Link>
                                            {' '}and{' '}
                                            <Link href="/privacy" target="_blank" className="text-orange-400 hover:underline">Privacy Policy</Link>
                                            {' '}required for using OrderFlow.
                                        </span>
                                    </label>

                                    {error && (
                                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center">
                                            <p className="text-sm font-semibold text-rose-400">{error}</p>
                                        </motion.div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleProfileSubmit}
                                            disabled={!termsAccepted || isLoading || !isOnline}
                                            className="flex-1 h-14 rounded-2xl font-bold uppercase text-sm tracking-widest bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                                        >
                                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" />Complete Setup</>}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setProfile({ ...profile, phone: '', location: '' })
                                                handleProfileSubmit()
                                            }}
                                            disabled={!termsAccepted || isLoading || !isOnline}
                                            className="h-14 px-5 rounded-2xl font-bold text-sm text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-600 transition-all disabled:opacity-40"
                                        >
                                            Skip
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 5: Setup Complete */}
                            {step === 'setup_complete' && (
                                <motion.div key="setup_complete" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.5 }} className="text-center py-8">
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="relative w-24 h-24 mx-auto mb-6">
                                        <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full" />
                                        <div className="relative w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/30 flex items-center justify-center">
                                            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                                        </div>
                                    </motion.div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Welcome Aboard!</h2>
                                    <p className="text-neutral-500 mb-2">Your account is ready.</p>
                                    {restaurantInfo?.name && <p className="text-sm text-orange-400 font-medium mb-6">{restaurantInfo.name}</p>}
                                    <div className="flex justify-center">
                                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Footer */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-8 text-center flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2 text-neutral-600">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">End-to-end encrypted</span>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}

/* ============================================
   SUB-COMPONENTS
   ============================================ */

function StaffPreviewCard({ staffPreview, restaurantInfo }: { staffPreview: any; restaurantInfo: any }) {
    if (!staffPreview) return null
    return (
        <div className="p-3 rounded-xl bg-neutral-900/50 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                    <p className="text-sm font-bold text-white">{staffPreview.name}</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{staffPreview.role}</p>
                </div>
            </div>
            {restaurantInfo?.name && (
                <span className="text-[10px] text-neutral-500 bg-neutral-800 px-2 py-1 rounded-lg">{restaurantInfo.name}</span>
            )}
        </div>
    )
}

function PinDisplay({ length, pin, color }: { length: number; pin: string; color: 'orange' | 'blue' | 'emerald' }) {
    const colorClasses = {
        orange: 'bg-orange-500 border-orange-500 shadow-orange-500/30',
        blue: 'bg-blue-500 border-blue-500 shadow-blue-500/30',
        emerald: 'bg-emerald-500 border-emerald-500 shadow-emerald-500/30',
    }
    return (
        <div className="flex justify-center gap-3 py-4">
            {Array.from({ length }).map((_, i) => (
                <motion.div
                    key={i}
                    animate={{ scale: pin.length > i ? 1 : 0.9, opacity: pin.length > i ? 1 : 0.3 }}
                    className={cn(
                        'w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-200',
                        pin.length > i ? colorClasses[color] : 'bg-neutral-900/50 border-neutral-800'
                    )}
                >
                    {pin.length > i && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
                </motion.div>
            ))}
        </div>
    )
}

function PinPad({ onPress, disabled, maxLength }: { onPress: (val: string) => void; disabled: boolean; maxLength?: number }) {
    const nums = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']
    return (
        <div className="grid grid-cols-3 gap-3">
            {nums.map((num, i) => (
                <button
                    key={i}
                    onClick={() => num && onPress(num)}
                    disabled={disabled || !num}
                    className={cn(
                        'h-14 rounded-xl font-bold text-xl transition-all flex items-center justify-center active:scale-95',
                        num === 'delete'
                            ? 'bg-neutral-900/50 text-neutral-500 hover:text-rose-500 hover:bg-rose-500/10'
                            : num
                                ? 'bg-neutral-900 border border-white/5 hover:border-orange-500/30 hover:bg-neutral-800 text-white'
                                : 'invisible pointer-events-none',
                        disabled && 'opacity-50 pointer-events-none'
                    )}
                >
                    {num === 'delete' ? <Delete className="w-5 h-5" /> : num}
                </button>
            ))}
        </div>
    )
}
