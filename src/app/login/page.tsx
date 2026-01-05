'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Mail,
    Lock,
    Utensils,
    ArrowRight
} from 'lucide-react'
import { createClient, signInWithGoogle } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Button, Input, PageLoading } from '@/components/ui/common'

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
    const { setUser, setRestaurant } = useAuthStore()

    const [isLoading, setIsLoading] = useState(false)
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
                    .from('restaurants')
                    .select('*')
                    .eq('owner_id', authData.user.id)
                    .single()

                setUser({
                    id: authData.user.id,
                    email: authData.user.email!,
                    full_name: authData.user.user_metadata?.full_name
                        || authData.user.user_metadata?.name
                        || authData.user.email?.split('@')[0],
                })

                if (restaurant) {
                    setRestaurant(restaurant)
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
            const { error: oauthError } = await signInWithGoogle()
            if (oauthError) throw oauthError
        } catch (err: unknown) {
            error('Google Login Failed', err instanceof Error ? err.message : 'Could not sign in with Google')
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Ambience - Subtle Orange Glow, No Purple */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-orange-600/5 blur-[120px] rounded-full" />
            </div>

            <Link href="/" className="mb-8 flex items-center gap-3 group relative z-10">
                <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform duration-300">
                    <Utensils className="w-5 h-5 text-white dark:text-black" />
                </div>
                <span className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">OrderFlow.</span>
            </Link>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[420px] relative z-10"
            >
                <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-[2rem] p-8 shadow-2xl shadow-neutral-200/50 dark:shadow-black/50">
                    <div className="text-center mb-8 space-y-2">
                        <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">Welcome back</h1>
                        <p className="text-neutral-500 font-medium text-sm">Access your restaurant dashboard</p>
                    </div>

                    <motion.form
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        onSubmit={handleOwnerLogin} className="space-y-5"
                    >
                        <Input
                            label="Email Address"
                            type="email"
                            placeholder="manager@restaurant.com"
                            icon={Mail}
                            value={ownerForm.email}
                            onChange={(e: any) => setOwnerForm({ ...ownerForm, email: e.target.value })}
                            className="bg-neutral-50 dark:bg-neutral-800/50"
                            required
                        />
                        <div className="space-y-1">
                            <Input
                                label="Password"
                                type="password"
                                placeholder="••••••••"
                                icon={Lock}
                                value={ownerForm.password}
                                onChange={(e: any) => setOwnerForm({ ...ownerForm, password: e.target.value })}
                                className="bg-neutral-50 dark:bg-neutral-800/50"
                                required
                            />
                            <div className="flex justify-end">
                                <a href="#" className="text-[10px] uppercase font-bold text-neutral-400 hover:text-orange-500 transition-colors tracking-wider">Forgot password?</a>
                            </div>
                        </div>
                        <Button type="submit" className="w-full h-12 uppercase tracking-widest text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-glow rounded-xl" isLoading={isLoading}>
                            Log In <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>

                        {/* OR Divider */}
                        <div className="flex items-center gap-4 my-2">
                            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Or</span>
                            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
                        </div>

                        {/* Google Login Button */}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleGoogleLogin}
                            className="w-full h-12 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-bold text-xs uppercase tracking-widest transition-all"
                            disabled={isLoading}
                        >
                            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </Button>
                    </motion.form>

                    <div className="mt-8 text-center space-y-3">
                        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                            No account?{' '}
                            <Link href="/register" className="font-bold text-neutral-900 dark:text-white hover:text-orange-600 transition-colors">
                                Sign up
                            </Link>
                        </p>
                        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                            Staff member?{' '}
                            <Link href="/staff-login" className="font-bold text-orange-500 hover:text-orange-400 transition-colors">
                                Staff Portal →
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
