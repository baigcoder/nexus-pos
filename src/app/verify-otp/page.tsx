'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Utensils,
    Loader2,
    ShieldCheck,
    ArrowRight,
    RefreshCw,
    Mail,
    CheckCircle2
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Button, Badge, Card } from '@/components/ui/common'

function OtpVerificationForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const email = searchParams.get('email') || ''
    const { success, error, info } = useToast()
    const { setPendingOtpEmail, setUser } = useAuthStore()

    const [isLoading, setIsLoading] = useState(false)
    const [isResending, setIsResending] = useState(false)
    const [otp, setOtp] = useState(['', '', '', '', '', ''])

    const handleChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return
        const newOtp = [...otp]
        newOtp[index] = value.slice(-1)
        setOtp(newOtp)

        if (value && index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`)
            nextInput?.focus()
        }
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`)
            prevInput?.focus()
        }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        const newOtp = [...otp]
        for (let i = 0; i < pasted.length; i++) {
            newOtp[i] = pasted[i]
        }
        setOtp(newOtp)
    }

    const handleVerify = async () => {
        const token = otp.join('')
        if (token.length !== 6) {
            error('Incomplete Code', 'Please enter all 6 digits.')
            return
        }

        setIsLoading(true)
        try {
            const response = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code: token }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Verification failed')
            }

            if (result.verified) {
                // Store the user in auth store so setup page can access the ID
                if (result.userId) {
                    setUser({
                        id: result.userId,
                        email: result.email || email,
                    })
                }
                success('Email Verified!', 'Your account is now active.')
                setPendingOtpEmail(null)
                router.push('/trial-started')
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Invalid or expired code'
            error('Verification Failed', errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    const handleResend = async () => {
        setIsResending(true)
        try {
            const response = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })

            if (!response.ok) {
                const result = await response.json()
                throw new Error(result.error || 'Failed to resend code')
            }

            info('Code Sent', 'A new verification code has been sent to your email.')
        } catch (err: unknown) {
            error('Error', 'Could not resend code. Please try again.')
        } finally {
            setIsResending(false)
        }
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-orange-600/5 blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md relative z-10"
            >
                {/* Header Branding */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-3 mb-6 group">
                        <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform duration-300">
                            <ShieldCheck className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">OrderFlow.</span>
                    </Link>

                    {/* Progress Steps */}
                    <div className="flex items-center justify-center gap-2 mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm font-bold">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-neutral-400 uppercase">Account</span>
                        </div>
                        <div className="w-8 h-0.5 bg-orange-600"></div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm font-bold">
                                2
                            </div>
                            <span className="text-xs font-bold text-orange-600 uppercase">Verify Email</span>
                        </div>
                    </div>

                    <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white mb-2">Verify Your Email</h1>
                    <p className="text-neutral-500 text-sm">
                        We sent a 6-digit code to<br />
                        <span className="font-bold text-neutral-900 dark:text-white">{email || 'your email'}</span>
                    </p>
                </div>

                <Card className="p-8 border-neutral-200 dark:border-neutral-800">
                    {/* OTP Input Grid */}
                    <div className="flex justify-center gap-3 mb-8" onPaste={handlePaste}>
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                id={`otp-${index}`}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                className="w-12 h-14 bg-neutral-50 dark:bg-neutral-800/50 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl text-center text-2xl font-black text-neutral-900 dark:text-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all"
                                placeholder="0"
                            />
                        ))}
                    </div>

                    {/* Verify Button */}
                    <Button
                        onClick={handleVerify}
                        isLoading={isLoading}
                        className="w-full h-14 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm uppercase font-bold tracking-widest shadow-[0_10px_40px_-10px_rgba(249,115,22,0.4)]"
                    >
                        Verify & Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>

                    {/* Resend Actions */}
                    <div className="text-center mt-6">
                        <p className="text-neutral-400 text-xs mb-2">Didn't receive the code?</p>
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={isResending}
                            className="text-orange-600 font-bold text-xs uppercase tracking-wider hover:text-orange-700 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                        >
                            {isResending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Resend Code
                        </button>
                    </div>
                </Card>

                {/* Return Access */}
                <div className="text-center mt-8">
                    <Link href="/login" className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors text-xs font-bold uppercase tracking-wider">
                        ← Back to Login
                    </Link>
                </div>
            </motion.div>
        </div>
    )
}

export default function VerifyOtpPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
                <div className="space-y-6 text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-orange-500 m-auto" />
                    <p className="text-neutral-400 text-xs uppercase tracking-widest">Loading...</p>
                </div>
            </div>
        }>
            <OtpVerificationForm />
        </Suspense>
    )
}
