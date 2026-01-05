'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Tv, ArrowRight, Loader2, Shield, Wifi } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'

export default function ScreenLoginPage() {
    const router = useRouter()
    const { success, error: showError } = useToast()

    const [restaurantSlug, setRestaurantSlug] = useState('')
    const [displayCode, setDisplayCode] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const supabase = createClient()

            // Verify restaurant exists
            const { data: restaurant, error: restError } = await supabase
                .from('restaurants')
                .select('id, name, slug')
                .eq('slug', restaurantSlug.toLowerCase().trim())
                .single()

            if (restError || !restaurant) {
                showError('Invalid', 'Restaurant not found')
                setIsLoading(false)
                return
            }

            // Verify display code from display_screens table
            const { data: screen, error: screenError } = await supabase
                .from('display_screens')
                .select('*')
                .eq('restaurant_id', restaurant.id)
                .eq('access_code', displayCode.trim())
                .eq('is_active', true)
                .single()

            if (screenError || !screen) {
                showError('Access Denied', 'Invalid display code. Please check with your manager.')
                setIsLoading(false)
                return
            }

            // Update last connected timestamp
            await supabase
                .from('display_screens')
                .update({ last_connected_at: new Date().toISOString() })
                .eq('id', screen.id)

            // Store in session
            sessionStorage.setItem('display_restaurant', restaurant.slug)
            sessionStorage.setItem('display_screen_id', screen.id)
            sessionStorage.setItem('display_screen_name', screen.name)
            sessionStorage.setItem('display_mode', 'connected')

            success('Connected!', `Display ready: ${screen.name}`)

            // Redirect based on screen type
            if (screen.screen_type === 'kitchen') {
                router.push(`/dashboard/kitchen`)
            } else if (screen.screen_type === 'order_status') {
                router.push(`/display/${restaurant.slug}?mode=orders`)
            } else {
                router.push(`/display/${restaurant.slug}`)
            }

        } catch (err: any) {
            showError('Error', err.message || 'Failed to connect')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-neutral-950 to-black text-white flex items-center justify-center p-4 overflow-hidden relative">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_rgba(234,88,12,0.08)_0%,_transparent_50%)]" />
                <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_right,_rgba(59,130,246,0.05)_0%,_transparent_50%)]" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-10"
                >
                    <div className="inline-flex relative mb-8 group">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="absolute inset-0 -m-6 bg-blue-500/20 blur-3xl rounded-full"
                        />
                        <div className="relative w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-2xl">
                            <Tv className="w-12 h-12 text-white" />
                        </div>
                    </div>

                    <h1 className="text-5xl font-black tracking-tighter mb-3">
                        Display <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-500">Screen</span>
                    </h1>
                    <p className="text-neutral-400 font-medium">Connect to customer facing display</p>
                </motion.div>

                {/* Login Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative"
                >
                    <div className="absolute -inset-px bg-gradient-to-b from-white/10 to-transparent rounded-[2.5rem] pointer-events-none" />
                    <div className="bg-neutral-950/80 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-8 lg:p-10 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">

                        {/* Status Bar */}
                        <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                    <motion.div
                                        animate={{ opacity: [1, 0.5, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                                    />
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Ready</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-neutral-600">
                                    <Wifi className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Secure</span>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                                    Restaurant ID
                                </label>
                                <input
                                    type="text"
                                    value={restaurantSlug}
                                    onChange={(e) => setRestaurantSlug(e.target.value)}
                                    placeholder="your-restaurant-id"
                                    required
                                    className="w-full h-16 bg-neutral-900/50 border border-white/10 rounded-2xl px-5 text-lg font-bold text-white placeholder:text-neutral-700 focus:border-blue-500/50 focus:bg-neutral-900 transition-all outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                                    Display Access Code
                                </label>
                                <input
                                    type="password"
                                    value={displayCode}
                                    onChange={(e) => setDisplayCode(e.target.value)}
                                    placeholder="• • • •"
                                    required
                                    maxLength={6}
                                    className="w-full h-16 bg-neutral-900/50 border border-white/10 rounded-2xl px-5 text-lg font-bold text-white placeholder:text-neutral-700 focus:border-blue-500/50 focus:bg-neutral-900 transition-all outline-none text-center tracking-[0.5em]"
                                />
                            </div>

                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                                <p className="text-xs font-medium text-blue-400">
                                    <strong>Need access?</strong> Ask your manager to create a screen in Display Manager and share the access code with you.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !restaurantSlug || !displayCode}
                                className="w-full h-16 rounded-2xl font-bold uppercase text-sm tracking-widest bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-400 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Tv className="w-5 h-5" />
                                        Connect Display
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>
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
                        <span className="text-[10px] font-bold uppercase tracking-widest">Authorized displays only</span>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
