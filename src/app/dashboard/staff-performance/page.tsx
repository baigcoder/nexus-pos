'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Users,
    TrendingUp,
    Clock,
    DollarSign,
    ShoppingCart,
    Award,
    ChevronLeft,
    ChevronRight,
    Star
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface StaffPerformance {
    id: string
    name: string
    role: string
    ordersToday: number
    ordersThisWeek: number
    revenueToday: number
    revenueThisWeek: number
    avgOrderValue: number
    avgServiceTime: number // minutes
    rating: number // 1-5
    rank: number
}

export default function StaffPerformancePage() {
    const { restaurant } = useAuthStore()
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')

    // Sample performance data
    const staffPerformance: StaffPerformance[] = [
        { id: '1', name: 'Zia Ahmed', role: 'waiter', ordersToday: 34, ordersThisWeek: 187, revenueToday: 48600, revenueThisWeek: 267800, avgOrderValue: 1430, avgServiceTime: 12, rating: 4.8, rank: 1 },
        { id: '2', name: 'Sara Khan', role: 'waiter', ordersToday: 28, ordersThisWeek: 156, revenueToday: 38200, revenueThisWeek: 218400, avgOrderValue: 1364, avgServiceTime: 14, rating: 4.6, rank: 2 },
        { id: '3', name: 'Ali Raza', role: 'waiter', ordersToday: 22, ordersThisWeek: 134, revenueToday: 29800, revenueThisWeek: 178600, avgOrderValue: 1355, avgServiceTime: 15, rating: 4.4, rank: 3 },
        { id: '4', name: 'Fatima Malik', role: 'cashier', ordersToday: 45, ordersThisWeek: 289, revenueToday: 186500, revenueThisWeek: 1245000, avgOrderValue: 4144, avgServiceTime: 3, rating: 4.9, rank: 1 },
        { id: '5', name: 'Usman Shah', role: 'kitchen', ordersToday: 67, ordersThisWeek: 412, revenueToday: 0, revenueThisWeek: 0, avgOrderValue: 0, avgServiceTime: 18, rating: 4.7, rank: 1 },
    ]

    const topPerformer = staffPerformance.reduce((best, current) =>
        current.revenueToday > best.revenueToday ? current : best
    )

    const totalRevenue = staffPerformance.reduce((sum, s) => sum + s.revenueToday, 0)
    const totalOrders = staffPerformance.reduce((sum, s) => sum + s.ordersToday, 0)
    const avgRating = (staffPerformance.reduce((sum, s) => sum + s.rating, 0) / staffPerformance.length).toFixed(1)

    const handleDateChange = (days: number) => {
        const date = new Date(selectedDate)
        date.setDate(date.getDate() + days)
        setSelectedDate(date.toISOString().split('T')[0])
    }

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
    const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } } }

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-10 pb-24">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-cyan-600/10 text-cyan-500 border-cyan-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            ● Performance
                        </Badge>
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white uppercase">
                        Staff <span className="text-cyan-500">Analytics</span>
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-black border border-neutral-800 rounded-xl p-2">
                        <button onClick={() => handleDateChange(-1)} className="w-10 h-10 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-all">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="px-4 font-bold text-white">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        <button onClick={() => handleDateChange(1)} className="w-10 h-10 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-all">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex gap-2">
                        {(['today', 'week', 'month'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={cn(
                                    'h-12 px-6 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all',
                                    period === p ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-black text-neutral-500 border-neutral-800'
                                )}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top Performer Card */}
            <motion.div variants={item}>
                <Card className="p-8 bg-gradient-to-r from-cyan-600/20 via-neutral-900 to-neutral-900 border-cyan-600/30">
                    <div className="flex items-center gap-8">
                        <div className="w-20 h-20 rounded-2xl bg-cyan-500 flex items-center justify-center">
                            <Award className="w-10 h-10 text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-2">🏆 Top Performer Today</p>
                            <h2 className="text-3xl font-bold text-white">{topPerformer.name}</h2>
                            <div className="flex items-center gap-6 mt-2 text-neutral-400">
                                <span className="flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4 text-cyan-500" />
                                    <span className="text-white font-bold">{topPerformer.ordersToday}</span> orders
                                </span>
                                <span className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-emerald-500" />
                                    <span className="text-white font-bold">Rs.{(topPerformer.revenueToday / 1000).toFixed(1)}K</span> revenue
                                </span>
                                <span className="flex items-center gap-2">
                                    <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                                    <span className="text-white font-bold">{topPerformer.rating}</span> rating
                                </span>
                            </div>
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Orders', value: totalOrders, icon: ShoppingCart, color: 'text-cyan-500' },
                    { label: 'Total Revenue', value: `Rs.${(totalRevenue / 1000).toFixed(0)}K`, icon: DollarSign, color: 'text-emerald-500' },
                    { label: 'Avg Rating', value: avgRating, icon: Star, color: 'text-orange-500' },
                    { label: 'Active Staff', value: staffPerformance.length, icon: Users, color: 'text-purple-500' },
                ].map((stat, idx) => (
                    <motion.div key={idx} variants={item}>
                        <Card className="p-5 bg-neutral-900 border-neutral-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">{stat.label}</p>
                                    <h3 className={cn("text-2xl font-bold", stat.color)}>{stat.value}</h3>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-neutral-600">
                                    <stat.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Performance Table */}
            <motion.div variants={item}>
                <Card className="p-6 bg-neutral-900 border-neutral-800 overflow-hidden">
                    <h3 className="text-lg font-bold text-white mb-6">Staff Performance Rankings</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-neutral-800 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                                    <th className="text-left py-4 px-4">Rank</th>
                                    <th className="text-left py-4 px-4">Staff</th>
                                    <th className="text-left py-4 px-4">Role</th>
                                    <th className="text-center py-4 px-4">Orders</th>
                                    <th className="text-center py-4 px-4">Revenue</th>
                                    <th className="text-center py-4 px-4">Avg Order</th>
                                    <th className="text-center py-4 px-4">Service Time</th>
                                    <th className="text-center py-4 px-4">Rating</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800">
                                {staffPerformance.sort((a, b) => b.revenueToday - a.revenueToday).map((staff, idx) => (
                                    <tr key={staff.id} className="hover:bg-neutral-800/50 transition-all">
                                        <td className="py-4 px-4">
                                            <span className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                                                idx === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                                    idx === 1 ? 'bg-neutral-500/20 text-neutral-300' :
                                                        idx === 2 ? 'bg-orange-600/20 text-orange-500' :
                                                            'bg-neutral-800 text-neutral-500'
                                            )}>
                                                {idx + 1}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
                                                    {staff.name.split(' ').map(n => n[0]).join('')}
                                                </div>
                                                <span className="font-bold text-white">{staff.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <Badge className={cn(
                                                "text-[10px] font-bold uppercase",
                                                staff.role === 'waiter' ? 'bg-blue-500/10 text-blue-400' :
                                                    staff.role === 'cashier' ? 'bg-purple-500/10 text-purple-400' :
                                                        'bg-orange-500/10 text-orange-400'
                                            )}>
                                                {staff.role}
                                            </Badge>
                                        </td>
                                        <td className="py-4 px-4 text-center font-bold text-white">{staff.ordersToday}</td>
                                        <td className="py-4 px-4 text-center font-bold text-emerald-500">Rs.{(staff.revenueToday / 1000).toFixed(1)}K</td>
                                        <td className="py-4 px-4 text-center font-bold text-neutral-400">Rs.{staff.avgOrderValue.toLocaleString()}</td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={cn(
                                                "font-bold",
                                                staff.avgServiceTime <= 12 ? 'text-emerald-500' :
                                                    staff.avgServiceTime <= 18 ? 'text-orange-500' : 'text-rose-500'
                                            )}>
                                                {staff.avgServiceTime}m
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                                                <span className="font-bold text-white">{staff.rating}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </motion.div>
        </motion.div>
    )
}
