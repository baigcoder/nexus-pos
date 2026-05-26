'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Building2, ShieldCheck, Shield, ArrowRight, Sparkles, Clock, Eye, EyeOff } from 'lucide-react'
import { createClient, signInWithGoogle, isSupabaseConfigured, getSupabaseConfigError } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'

export default function RegisterPage() {
    const router = useRouter()
    const { success, error, info } = useToast()
    const googleAuthAvailable = isSupabaseConfigured()
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
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
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                        restaurant_name: formData.restaurantName,
                        role: 'owner',
                    },
                    emailRedirectTo: undefined,
                },
            })
            if (authError) throw authError
            if (authData.user) {
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
                router.push(`/verify-otp?email=${encodeURIComponent(formData.email)}&restaurant=${encodeURIComponent(formData.restaurantName)}`)
            }
        } catch (err: unknown) {
            error('Registration Failed', err instanceof Error ? err.message : 'Something went wrong.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[400px] bg-brand/5 rounded-full blur-[120px]" />
                <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-brand/3 rounded-full blur-[100px]" />
            </div>

            <Link href="/" className="mb-6 flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-glow">
                    <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="font-display text-xl font-bold text-[var(--text-primary)]">
                    Nexus<span className="text-brand">POS</span>
                </span>
            </Link>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 relative z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-subtle border border-brand/10 text-brand text-xs font-semibold"
            >
                <Sparkles className="w-3.5 h-3.5" />
                14-day free trial · No credit card required
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-[480px] relative z-10"
            >
                <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-8 shadow-xl">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Create your account</h1>
                        <p className="text-sm text-[var(--text-muted)] mt-1">Get full access to all NexusPOS features</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label htmlFor="fullName" className="label">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                    <input id="fullName" name="fullName" required value={formData.fullName} onChange={handleChange}
                                        placeholder="Your name"
                                        className="w-full h-11 pl-10 pr-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-disabled)] outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="restaurantName" className="label">Restaurant</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                    <input id="restaurantName" name="restaurantName" required value={formData.restaurantName} onChange={handleChange}
                                        placeholder="Restaurant name"
                                        className="w-full h-11 pl-10 pr-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-disabled)] outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="email" className="label">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                <input id="email" name="email" type="email" required value={formData.email} onChange={handleChange}
                                    placeholder="you@restaurant.com"
                                    className="w-full h-11 pl-10 pr-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-disabled)] outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label htmlFor="password" className="label">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                    <input id="password" name="password" type={showPassword ? 'text' : 'password'} required value={formData.password} onChange={handleChange}
                                        placeholder="••••••"
                                        className="w-full h-11 pl-10 pr-10 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-disabled)] outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-all"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]" aria-label={showPassword ? 'Hide' : 'Show'}>
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="confirmPassword" className="label">Confirm</label>
                                <div className="relative">
                                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                    <input id="confirmPassword" name="confirmPassword" type="password" required value={formData.confirmPassword} onChange={handleChange}
                                        placeholder="••••••"
                                        className="w-full h-11 pl-10 pr-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-disabled)] outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-11 bg-brand hover:bg-brand-hover text-white font-semibold rounded-lg transition-all shadow-glow hover:shadow-glow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <><Sparkles className="w-4 h-4" /> Start Free Trial <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--border)]" /></div>
                            <div className="relative flex justify-center text-xs"><span className="px-2 bg-[var(--surface-raised)] text-[var(--text-muted)]">or</span></div>
                        </div>

                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    if (!googleAuthAvailable) throw new Error(getSupabaseConfigError())
                                    const { error } = await signInWithGoogle()
                                    if (error) throw error
                                } catch (err: unknown) {
                                    error('Google Sign Up Failed', err instanceof Error ? err.message : 'Could not sign up with Google.')
                                }
                            }}
                            disabled={isLoading || !googleAuthAvailable}
                            className="w-full h-11 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] font-medium rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Sign up with Google
                        </button>

                        <div className="flex items-center justify-center gap-3 text-[11px] text-[var(--text-muted)]">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Setup in 2 mins</span>
                            <span>•</span>
                            <span>Cancel anytime</span>
                        </div>
                    </form>

                    <div className="mt-6 pt-6 border-t border-[var(--border)] text-center">
                        <p className="text-sm text-[var(--text-muted)]">
                            Already have an account?{' '}
                            <Link href="/login" className="font-medium text-brand hover:text-brand-hover transition-colors">Log in</Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
