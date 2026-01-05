'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingBag,
    Users,
    Clock,
    ChefHat,
    Zap,
    Star,
    ArrowUpRight,
    Activity,
    BadgeCheck,
    Sparkles,
    Flame,
    Crown,
    Award,
    Target,
    Bell,
    Search,
    ChevronRight,
    MousePointer2
} from 'lucide-react'
import { Card } from '@/components/ui/common'
import { useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'

interface DashboardStats {
    revenue: { value: number; change: number; trend: 'up' | 'down' }
    orders: { value: number; change: number; trend: 'up' | 'down' }
    tables: { occupied: number; total: number }
    avgTime: { value: string; change: number; trend: 'up' | 'down' }
    efficiency: number
    topItems: { name: string; count: number; revenue: number }[]
}

export default function DashboardPage() {
    const { user, staff, restaurant } = useAuthStore()

    // Premium Name Formatting
    const rawName = staff?.name || user?.full_name || user?.email?.split('@')[0] || 'User'
    const userName = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()

    const currentHour = new Date().getHours()
    const greeting = currentHour < 12 ? 'Morning' : currentHour < 18 ? 'Afternoon' : 'Evening'

    const [stats] = useState<DashboardStats>({
        revenue: { value: 45600, change: 12.5, trend: 'up' },
        orders: { value: 47, change: 8.2, trend: 'up' },
        tables: { occupied: 8, total: 15 },
        avgTime: { value: '12m', change: 5.4, trend: 'down' },
        efficiency: 98,
        topItems: [
            { name: 'Butter Chicken', count: 24, revenue: 18900 },
            { name: 'Biryani Special', count: 18, revenue: 14500 },
            { name: 'Naan Basket', count: 32, revenue: 8600 },
        ]
    })

    const [time, setTime] = useState(new Date())

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="min-h-screen relative overflow-hidden pb-12">
            {/* Mesh Gradient Background Orbs */}
            <div className="fixed inset-0 pointer-events-none -z-10 bg-black">
                <motion.div
                    animate={{
                        x: [0, 100, 0],
                        y: [0, -50, 0],
                        scale: [1, 1.2, 1]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-orange-600/10 blur-[120px] rounded-full"
                />
                <motion.div
                    animate={{
                        x: [0, -80, 0],
                        y: [0, 100, 0],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[20%] -right-[5%] w-[40%] h-[40%] bg-blue-600/5 blur-[100px] rounded-full"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.3, 0.5, 0.3]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[10%] left-[20%] w-[30%] h-[30%] bg-purple-600/5 blur-[80px] rounded-full"
                />
            </div>

            <div className="px-2 lg:px-4 space-y-10 animate-in fade-in duration-700">
                {/* Header Section: Premium Balance */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pt-4">
                    <div className="space-y-4">


                        <div className="space-y-1">
                            <motion.h1
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-5xl lg:text-7xl font-black text-white tracking-tight leading-[0.9]"
                            >
                                Good {greeting}, <br />
                                <span className="bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 bg-clip-text text-transparent">
                                    {userName}
                                </span>
                            </motion.h1>
                            <p className="text-lg text-neutral-500 font-medium">
                                {restaurant?.name || 'Restaurant HQ'} is performing <span className="text-orange-500 italic">peak efficiency</span> today.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <motion.button
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            className="group relative h-14 px-10 bg-orange-600 rounded-2xl flex items-center gap-3 overflow-hidden shadow-2xl shadow-orange-600/20"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                            <Zap className="w-5 h-5 text-white fill-white" />
                            <span className="text-sm font-black text-white uppercase tracking-widest">New Order</span>
                        </motion.button>
                    </div>
                </header>

                {/* Primary Stats: Glassmorphism 2.0 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        {
                            label: 'Today Revenue',
                            value: `Rs. ${(stats.revenue.value / 1000).toFixed(1)}k`,
                            change: stats.revenue.change,
                            trend: stats.revenue.trend,
                            icon: DollarSign,
                            glow: 'group-hover:shadow-orange-500/20',
                            accent: 'bg-orange-500'
                        },
                        {
                            label: 'Active Orders',
                            value: stats.orders.value,
                            change: stats.orders.change,
                            trend: stats.orders.trend,
                            icon: ShoppingBag,
                            glow: 'group-hover:shadow-blue-500/20',
                            accent: 'bg-blue-500'
                        },
                        {
                            label: 'Table Occupancy',
                            value: `${stats.tables.occupied}/${stats.tables.total}`,
                            change: `${Math.round(stats.tables.occupied / stats.tables.total * 100)}%`,
                            trend: 'up',
                            icon: Users,
                            glow: 'group-hover:shadow-purple-500/20',
                            accent: 'bg-purple-500'
                        },
                        {
                            label: 'Avg Turnaround',
                            value: stats.avgTime.value,
                            change: stats.avgTime.change,
                            trend: stats.avgTime.trend,
                            icon: Clock,
                            glow: 'group-hover:shadow-emerald-500/20',
                            accent: 'bg-emerald-500'
                        },
                    ].map((m, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * i }}
                            whileHover={{ y: -5 }}
                            className="group cursor-pointer"
                        >
                            <Card className={cn(
                                "relative overflow-hidden p-6 h-full bg-neutral-900/40 backdrop-blur-xl border border-neutral-800/50 hover:border-neutral-700/80 transition-all duration-300 shadow-xl",
                                m.glow
                            )}>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent blur-2xl -translate-y-12 translate-x-12" />

                                <div className="flex justify-between items-start mb-6">
                                    <div className={cn("p-2.5 rounded-xl shadow-inner", m.accent + "/10")}>
                                        <m.icon className={cn("w-5 h-5", m.accent.replace('bg-', 'text-'))} />
                                    </div>
                                    <div className={cn(
                                        "flex items-center gap-1 text-[10px] font-black tracking-widest px-2 py-1 rounded-lg border",
                                        m.trend === 'up' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 'text-rose-500 border-rose-500/20 bg-rose-500/5'
                                    )}>
                                        {m.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {m.change}{typeof m.change === 'number' ? '%' : ''}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">{m.label}</p>
                                    <h3 className="text-3xl font-black text-white tracking-tighter tabular-nums">{m.value}</h3>
                                </div>

                                <motion.div
                                    className={cn("absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-transparent to-transparent group-hover:from-transparent group-hover:via-current group-hover:to-transparent opacity-50", m.accent.replace('bg-', 'text-'))}
                                    layoutId={`accent-${i}`}
                                />
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Secondary Grid: Interactive Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Efficiency Glow Card */}
                    <div className="lg:col-span-4 h-full">
                        <Card className="relative overflow-hidden p-8 h-full bg-neutral-900/40 backdrop-blur-xl border border-neutral-800/50 flex flex-col justify-between">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 blur-[60px] rounded-full -translate-y-16 translate-x-16" />

                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500/10 rounded-lg">
                                        <Zap className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <span className="text-xs font-black text-white uppercase tracking-widest">Service Health</span>
                                </div>
                                <Crown className="w-4 h-4 text-amber-500" />
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-7xl font-black bg-gradient-to-br from-white via-white to-white/50 bg-clip-text text-transparent">
                                        {stats.efficiency}
                                    </span>
                                    <span className="text-2xl font-black text-neutral-700">%</span>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-neutral-500">
                                        <span>Capacity Load</span>
                                        <span className="text-emerald-500">Optimal</span>
                                    </div>
                                    <div className="h-2 bg-neutral-950/50 rounded-full border border-neutral-800 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${stats.efficiency}%` }}
                                            transition={{ duration: 1.5, ease: "easeOut" }}
                                            className="h-full bg-gradient-to-r from-orange-600 to-amber-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-neutral-800 flex items-center gap-3">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-8 h-8 rounded-full bg-neutral-800 border-2 border-neutral-900 flex items-center justify-center text-[10px] font-black">
                                            {String.fromCharCode(64 + i)}
                                        </div>
                                    ))}
                                </div>
                                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                    <Sparkles className="w-3 h-3 text-amber-500" /> +2 Workers Peak
                                </span>
                            </div>
                        </Card>
                    </div>

                    {/* Top Sellers: Premium Table View */}
                    <div className="lg:col-span-8">
                        <Card className="relative h-full bg-neutral-900/40 backdrop-blur-xl border border-neutral-800/50 overflow-hidden">
                            <div className="p-6 border-b border-neutral-800/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-rose-500/10 rounded-lg">
                                        <Flame className="w-5 h-5 text-rose-500" />
                                    </div>
                                    <span className="text-xs font-black text-white uppercase tracking-widest">Demand Analysis</span>
                                </div>
                                <button className="group text-[10px] font-black text-orange-500 hover:text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2 transition-all">
                                    Intelligence Report <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                </button>
                            </div>

                            <div className="p-6">
                                <div className="space-y-4">
                                    {stats.topItems.map((item, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.1 * idx }}
                                            className="group flex items-center justify-between p-4 bg-neutral-950/20 border border-neutral-800/50 rounded-2xl hover:bg-neutral-950/40 hover:border-neutral-700 transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className="relative w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center border border-neutral-800 group-hover:border-neutral-700">
                                                    <span className="text-lg font-black text-neutral-700 group-hover:text-orange-500/50 transition-colors">0{idx + 1}</span>
                                                    {idx === 0 && <Award className="absolute -top-1.5 -right-1.5 w-5 h-5 text-amber-500 drop-shadow-lg" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-white tracking-wide">{item.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{item.count} Orders</span>
                                                        <div className="h-1 w-1 rounded-full bg-neutral-700" />
                                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">High Margin</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-lg font-black text-white tabular-nums tracking-tighter">Rs. {(item.revenue / 1000).toFixed(1)}k</p>
                                                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Gross Yield</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6 bg-neutral-950/40 border-t border-neutral-800/50">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                            <TrendingUp className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-white uppercase tracking-tighter">+12% vs Yesterday</p>
                                            <p className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Overall Demand Growth</p>
                                        </div>
                                    </div>
                                    <button className="h-10 px-6 bg-neutral-900 border border-neutral-800 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] hover:bg-neutral-800 transition-all flex items-center gap-2">
                                        Predictive Insights <MousePointer2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Status Bar Footer: Minimal & Clean */}
                <footer className="pt-8 border-t border-neutral-900 flex flex-col md:flex-row items-center justify-between gap-6 opacity-60 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-6">
                        {[
                            { label: 'Latency', val: '2ms', icon: Activity },
                            { label: 'Workers', val: '12 Active', icon: Target },
                            { label: 'Security', val: 'Encrypted', icon: BadgeCheck },
                        ].map((s, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <s.icon className="w-3.5 h-3.5 text-neutral-600" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">
                                    {s.label}: <span className="text-white">{s.val}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-600">
                        Nexus POS v2.4.0 • Enterprise Edition
                    </p>
                </footer>
            </div>
        </div>
    )
}
