'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, Shield, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { createClient, signInWithGoogle, isSupabaseConfigured, getSupabaseConfigError } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Button, PageLoading } from '@/components/ui/common'

export default function LoginPage() {
    return (
        <Suspense fallback={<PageLoading />}>
            <LoginForm />
        </Suspense>
    )
}

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { success, error, info } = useToast()
    const { setUser, setRestaurant, setUserRole } = useAuthStore()
    const googleAuthAvailable = isSupabaseConfigured()

    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [ownerForm, setOwnerForm] = useState({ email: '', password: '' })

    useEffect(() => {
        if (searchParams.get('registered') === 'true') {
            info('Account Created', 'Please verify your email to continue.')
        }
    }, [searchParams, info])

    const handleOwnerLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const supabase = createClient()
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: ownerForm.email,
                password: ownerForm.password,
            })
            if (authError) throw authError
            if (authData.user) {
                const { data: restaurant } = await supabase
                    .from('restaurants').select('*').eq('owner_id', authData.user.id).single()
                setUser({
                    id: authData.user.id,
                    email: authData.user.email!,
                    full_name: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || authData.user.email?.split('@')[0],
                })
                if (restaurant) {
                    setRestaurant(restaurant)
                    setUserRole('owner')
                    success('Welcome back', `Logged into ${restaurant.name}`)
                    router.push('/dashboard')
                } else {
                    router.push('/setup')
                }
            }
        } catch (err: unknown) {
            error('Login Failed', err instanceof Error ? err.message : 'Invalid login')
        } finally {
            setIsLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setIsLoading(true)
        try {
            if (!googleAuthAvailable) throw new Error(getSupabaseConfigError())
            const { error: oauthError } = await signInWithGoogle()
            if (oauthError) throw oauthError
        } catch (err: unknown) {
            error('Google Login Failed', err instanceof Error ? err.message : 'Could not sign in with Google')
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand/5 rounded-full blur-[120px]" />
            </div>

            <Link href="/" className="mb-8 flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-glow">
                    <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="font-display text-xl font-bold text-[var(--text-primary)]">
                    Nexus<span className="text-brand">POS</span>
                </span>
            </Link>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-[400px] relative z-10"
            >
                <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-8 shadow-xl">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Welcome back</h1>
                        <p className="text-sm text-[var(--text-muted)] mt-1">Sign in to your restaurant dashboard</p>
                    </div>

                    <form onSubmit={handleOwnerLogin} className="space-y-5">
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="label">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    placeholder="you@restaurant.com"
                                    value={ownerForm.email}
                                    onChange={e => setOwnerForm({ ...ownerForm, email: e.target.value })}
                                    className="w-full h-11 pl-10 pr-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-disabled)] outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="password" className="label">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    value={ownerForm.password}
                                    onChange={e => setOwnerForm({ ...ownerForm, password: e.target.value })}
                                    className="w-full h-11 pl-10 pr-10 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-disabled)] outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-[var(--border)] bg-[var(--surface)] text-brand focus:ring-brand" />
                                <span className="text-xs text-[var(--text-muted)]">Remember me</span>
                            </label>
                            <a href="#" className="text-xs font-medium text-brand hover:text-brand-hover transition-colors">Forgot password?</a>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-11 bg-brand hover:bg-brand-hover text-white font-semibold rounded-lg transition-all shadow-glow hover:shadow-glow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>Sign In <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-[var(--border)]" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-2 bg-[var(--surface-raised)] text-[var(--text-muted)]">or</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={isLoading || !googleAuthAvailable}
                            className="w-full h-11 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] font-medium rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-[var(--border)] space-y-3 text-center">
                        <p className="text-sm text-[var(--text-muted)]">
                            No account?{' '}
                            <Link href="/register" className="font-medium text-brand hover:text-brand-hover transition-colors">Sign up</Link>
                        </p>
                        <p className="text-sm text-[var(--text-muted)]">
                            Staff member?{' '}
                            <Link href="/staff-login" className="font-medium text-brand hover:text-brand-hover transition-colors">Staff Portal</Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
