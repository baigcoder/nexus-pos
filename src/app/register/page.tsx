'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Mail,
    Lock,
    User,
    Building2,
    ShieldCheck,
    Utensils,
    ArrowRight,
    Sparkles,
    Clock
} from 'lucide-react'
import { createClient, signInWithGoogle } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Button, Input, Badge } from '@/components/ui/common'

export default function RegisterPage() {
    const router = useRouter()
    const { success, error, info } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        restaurantName: '',
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (formData.password !== formData.confirmPassword) {
            error('Password Mismatch', 'Please ensure both passwords match.')
            return
        }

        if (formData.password.length < 6) {
            error('Password Too Short', 'Password must be at least 6 characters.')
            return
        }

        setIsLoading(true)

        try {
            const supabase = createClient()

            // Step 1: Create user with Supabase Auth (disable built-in email confirmation)
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                        restaurant_name: formData.restaurantName,
                        role: 'owner',
                    },
                    // Disable Supabase's built-in email confirmation - we use custom OTP via Nodemailer
                    emailRedirectTo: undefined,
                },
            })

            if (authError) throw authError

            if (authData.user) {
                // Step 2: Send OTP verification code
                info('Sending Verification Code', 'Please wait...')

                const otpResponse = await fetch('/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: formData.email }),
                })

                if (!otpResponse.ok) {
                    const otpResult = await otpResponse.json()
                    throw new Error(otpResult.error || 'Failed to send verification code')
                }

                success('Verification Code Sent', 'Check your email for the 6-digit code.')

                // Step 3: Redirect to OTP verification page
                router.push(`/verify-otp?email=${encodeURIComponent(formData.email)}`)
            }
        } catch (err: unknown) {
            error('Registration Failed', err instanceof Error ? err.message : 'Something went wrong.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute bottom-0 right-1/4 w-[800px] h-[600px] bg-orange-600/5 blur-[120px] rounded-full" />
                <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-orange-500/5 blur-[100px] rounded-full" />
            </div>

            <Link href="/" className="mb-6 flex items-center gap-3 group relative z-10">
                <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform duration-300">
                    <Utensils className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">OrderFlow.</span>
            </Link>

            {/* Free Trial Badge */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-6 relative z-10"
            >
                <Badge variant="outline" className="px-4 py-2 text-orange-600 border-orange-500/30 bg-orange-500/5">
                    <Sparkles className="w-4 h-4 mr-2" />
                    14-DAY FREE TRIAL · NO CREDIT CARD REQUIRED
                </Badge>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[480px] relative z-10"
            >
                <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-[2rem] p-8 sm:p-10 shadow-2xl shadow-neutral-200/50 dark:shadow-black/50">
                    <div className="text-center mb-8 space-y-2">
                        <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">Create Your Manager Account</h1>
                        <p className="text-neutral-500 font-medium text-sm">Full access to all OrderFlow features</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Full Name"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="Your Name"
                                icon={User}
                                className="bg-neutral-50 dark:bg-neutral-800/50"
                                required
                            />
                            <Input
                                label="Restaurant"
                                name="restaurantName"
                                value={formData.restaurantName}
                                onChange={handleChange}
                                placeholder="Resto Name"
                                icon={Building2}
                                className="bg-neutral-50 dark:bg-neutral-800/50"
                                required
                            />
                        </div>

                        <Input
                            label="Email Address"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="you@email.com"
                            icon={Mail}
                            className="bg-neutral-50 dark:bg-neutral-800/50"
                            required
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Password"
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••"
                                icon={Lock}
                                className="bg-neutral-50 dark:bg-neutral-800/50"
                                required
                            />
                            <Input
                                label="Confirm"
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="••••••"
                                icon={ShieldCheck}
                                className="bg-neutral-50 dark:bg-neutral-800/50"
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            isLoading={isLoading}
                            className="w-full h-14 text-sm uppercase font-bold tracking-widest bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-[0_10px_40px_-10px_rgba(249,115,22,0.4)]"
                        >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Start Free Trial
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>

                        {/* OR Divider */}
                        <div className="flex items-center gap-4 my-1">
                            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Or</span>
                            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
                        </div>

                        {/* Google Sign Up Button */}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                                try {
                                    const { error } = await signInWithGoogle()
                                    if (error) throw error
                                } catch (err) {
                                    console.error('Google sign up failed', err)
                                }
                            }}
                            className="w-full h-12 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-bold text-xs uppercase tracking-widest transition-all"
                            disabled={isLoading}
                        >
                            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Sign up with Google
                        </Button>

                        {/* Trust indicators */}
                        <div className="flex items-center justify-center gap-4 pt-2 text-neutral-400 text-[10px] uppercase tracking-wider font-bold">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Setup in 2 mins</span>
                            <span>•</span>
                            <span>Cancel anytime</span>
                        </div>
                    </form>

                    <div className="mt-8 text-center bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
                        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                            Already have an account?{' '}
                            <Link href="/login" className="font-bold text-neutral-900 dark:text-white hover:text-orange-600 transition-colors">
                                Log in
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
