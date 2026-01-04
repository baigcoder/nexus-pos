'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    DollarSign,
    ShoppingBag,
    Users,
    Clock,
    ArrowRight,
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
    Activity,
    Zap,
    Sparkles,
    ChefHat,
    Receipt
} from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores'
import { Card, Badge, Button } from '@/components/ui/common'
import { cn } from '@/lib/utils'

// Mock Data (To be replaced with real Supabase data in next step if required)
const recentOrders = [
    { id: 1, table: 'Table 3', items: 4, total: 'Rs. 2,450', status: 'preparing', time: '2 min ago' },
    { id: 2, table: 'Table 7', items: 2, total: 'Rs. 1,200', status: 'ready', time: '5 min ago' },
    { id: 3, table: 'Table 1', items: 6, total: 'Rs. 4,800', status: 'served', time: '12 min ago' },
    { id: 4, table: 'Table 5', items: 3, total: 'Rs. 1,850', status: 'preparing', time: '15 min ago' },
]

const topItems = [
    { name: 'Truffle Dal Makhani', orders: 23, grow: '+15%' },
    { name: 'Paneer Tikka', orders: 18, grow: '+12%' },
    { name: 'Garlic Naan', orders: 45, grow: '+24%' },
]

export default function DashboardPage() {
    const { restaurant, user } = useAuthStore()
    const [currentTime, setCurrentTime] = useState<string>('')

    useEffect(() => {
        const updateTime = () => {
            setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        }
        updateTime()
        const interval = setInterval(updateTime, 60000)
        return () => clearInterval(interval)
    }, [])

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    }

    const itemVariant = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-12"
        >
            {/* Hero Header Area */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-neutral-950 border border-neutral-900 group">
                <div className="absolute top-0 right-0 w-[50%] h-full bg-gradient-to-l from-orange-600/5 to-transparent pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-orange-600/10 rounded-full blur-[120px] pointer-events-none group-hover:bg-orange-600/20 transition-all duration-1000" />

                <div className="relative z-10 p-10 lg:p-14 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                    <div className="space-y-6">
                        <motion.div variants={itemVariant} className="flex items-center gap-3">
                            <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Operational</span>
                            </div>
                            <div className="h-4 w-[1px] bg-neutral-800" />
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{currentTime}</span>
                        </motion.div>

                        <div className="space-y-2">
                            <motion.h1 variants={itemVariant} className="text-4xl lg:text-7xl font-display font-bold text-white tracking-tight leading-[1.1]">
                                HELLO, <span className="text-orange-600 border-b-4 border-orange-600/30">{user?.full_name?.split(' ')[0] || 'ADMIN'}</span>
                            </motion.h1>
                            <motion.p variants={itemVariant} className="text-neutral-500 text-lg lg:text-xl font-medium max-w-xl leading-relaxed">
                                Here's what's happening at <span className="text-white font-bold">{restaurant?.name || 'Nexus POS'}</span> today.
                            </motion.p>
                        </div>

                        <motion.div variants={itemVariant} className="flex flex-wrap items-center gap-4 pt-2">
                            <Link href="/dashboard/orders">
                                <Button className="h-16 px-10 bg-orange-600 hover:bg-orange-500 text-white shadow-2xl shadow-orange-600/20 font-bold uppercase tracking-widest text-[10px] rounded-2xl group border-none">
                                    Process Orders <ArrowRight className="ml-3 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                            <Button variant="outline" className="h-16 px-10 border-neutral-800 bg-neutral-950 text-neutral-400 font-bold text-[10px] uppercase tracking-widest rounded-2xl hover:border-white hover:text-white transition-all">
                                Performance Report
                            </Button>
                        </motion.div>
                    </div>

                    <motion.div variants={itemVariant} className="hidden xl:block">
                        <div className="flex items-center gap-4">
                            <div className="p-8 bg-neutral-900/50 backdrop-blur-3xl border border-neutral-800 rounded-[2rem] text-center space-y-2 group/card hover:border-orange-600/30 transition-all duration-500">
                                <div className="w-14 h-14 rounded-2xl bg-orange-600/10 flex items-center justify-center mx-auto mb-4 text-orange-600 group-hover/card:scale-110 transition-transform">
                                    <TrendingUp className="w-7 h-7" />
                                </div>
                                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Growth Rate</p>
                                <h4 className="text-3xl font-black text-white">+12.5%</h4>
                            </div>
                            <div className="p-8 bg-neutral-900/50 backdrop-blur-3xl border border-neutral-800 rounded-[2rem] text-center space-y-2 group/card hover:border-orange-600/30 transition-all duration-500">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 text-emerald-500 group-hover/card:scale-110 transition-transform">
                                    <Zap className="w-7 h-7" />
                                </div>
                                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Efficiency</p>
                                <h4 className="text-3xl font-black text-white">98%</h4>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Premium Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Gross Revenue", value: 'Rs. 45.6K', change: 12.5, icon: DollarSign, color: 'text-orange-500', glow: 'shadow-orange-600/10' },
                    { label: "Active Orders", value: '47', change: 8.2, icon: ShoppingBag, color: 'text-emerald-500', glow: 'shadow-emerald-500/10' },
                    { label: 'Table Occupancy', value: '08 / 15', change: 2.1, icon: Users, color: 'text-blue-500', glow: 'shadow-blue-500/10' },
                    { label: 'Avg. Turnaround', value: '12m', change: -4.3, icon: Clock, color: 'text-purple-500', glow: 'shadow-purple-500/10' },
                ].map((stat) => (
                    <motion.div key={stat.label} variants={itemVariant}>
                        <Card className={cn(
                            "group p-8 bg-neutral-950 border-neutral-900 hover:border-neutral-800 transition-all duration-500 overflow-hidden relative rounded-3xl",
                            stat.glow
                        )}>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.01] rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="w-12 h-12 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center group-hover:border-neutral-700 transition-colors">
                                        <stat.icon className={cn("w-5 h-5", stat.color)} />
                                    </div>
                                    <div className={cn(
                                        "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter flex items-center gap-1",
                                        stat.change >= 0 ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
                                    )}>
                                        {stat.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                        {Math.abs(stat.change)}%
                                    </div>
                                </div>
                                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                                <h3 className="text-3xl font-black text-white tracking-tight">{stat.value}</h3>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Table & Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual Order Board */}
                <motion.div variants={itemVariant} className="lg:col-span-2">
                    <Card className="flex flex-col bg-neutral-950 border-neutral-900 shadow-2xl rounded-[2.5rem] overflow-hidden">
                        <div className="p-10 border-b border-neutral-900 flex items-center justify-between bg-neutral-950/50 backdrop-blur-xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-orange-600/10 flex items-center justify-center text-orange-600">
                                    <Activity className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white uppercase tracking-widest">Order <span className="text-orange-600">Stream</span></h2>
                                    <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mt-1">Live Kitchen Pulse</p>
                                </div>
                            </div>
                            <Link href="/dashboard/orders">
                                <Button variant="outline" className="h-12 px-6 border-neutral-800 text-[10px] font-bold uppercase tracking-widest hover:border-white hover:text-white transition-all rounded-xl">
                                    Full Ledger
                                </Button>
                            </Link>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-black/40 text-neutral-600 font-bold text-[10px] uppercase tracking-[0.2em]">
                                        <th className="px-10 py-6">ID & Location</th>
                                        <th className="px-10 py-6 text-center">Volume</th>
                                        <th className="px-10 py-6">Capital</th>
                                        <th className="px-10 py-6 text-center">Lifecycle</th>
                                        <th className="px-10 py-6 text-right">Age</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-900">
                                    {recentOrders.map((order) => (
                                        <tr key={order.id} className="group hover:bg-white/[0.01] transition-all duration-300">
                                            <td className="px-10 py-7">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 text-white flex items-center justify-center font-black text-xs group-hover:border-orange-600/50 transition-colors">
                                                        {order.table.split(' ')[1]}
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-white text-sm block">{order.table}</span>
                                                        <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">STATION 0{order.id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-7 text-center">
                                                <Badge variant="outline" className="border-neutral-800 text-neutral-400 font-bold text-[10px] uppercase">{order.items} ITEMS</Badge>
                                            </td>
                                            <td className="px-10 py-7">
                                                <span className="font-bold text-white text-md">{order.total}</span>
                                            </td>
                                            <td className="px-10 py-7 text-center">
                                                <div className={cn(
                                                    "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest leading-none",
                                                    order.status === 'preparing' ? 'bg-orange-600/10 text-orange-500' :
                                                        order.status === 'ready' ? 'bg-emerald-500/10 text-emerald-500' :
                                                            'bg-neutral-800/40 text-neutral-500'
                                                )}>
                                                    <div className={cn(
                                                        "w-1 h-1 rounded-full",
                                                        order.status === 'preparing' ? 'bg-orange-500 animate-pulse' :
                                                            order.status === 'ready' ? 'bg-emerald-500' : 'bg-neutral-600'
                                                    )} />
                                                    {order.status}
                                                </div>
                                            </td>
                                            <td className="px-10 py-7 text-right">
                                                <span className="font-medium text-[11px] text-neutral-500">{order.time}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </motion.div>

                {/* Popular Dishes Tile */}
                <motion.div variants={itemVariant}>
                    <Card className="flex flex-col h-full bg-neutral-950 border-neutral-900 shadow-2xl rounded-[2.5rem] overflow-hidden group">
                        <div className="p-10 border-b border-neutral-900 bg-neutral-950/50 backdrop-blur-xl relative">
                            <div className="absolute top-0 right-0 p-4">
                                <Sparkles className="w-5 h-5 text-orange-600/30 group-hover:text-orange-600 transition-colors" />
                            </div>
                            <h2 className="text-xl font-bold text-white uppercase tracking-widest">MVP <span className="text-orange-600">Dishes</span></h2>
                            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mt-1">Daily Profit Drivers</p>
                        </div>

                        <div className="p-10 flex-1 space-y-10">
                            {topItems.map((item, i) => (
                                <div key={item.name} className="group/item cursor-default">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-black text-neutral-800 group-hover/item:text-orange-600 transition-colors italic tracking-widest">#{i + 1}</span>
                                            <p className="font-black text-white text-md uppercase tracking-tight group-hover/item:translate-x-1 transition-transform">{item.name}</p>
                                        </div>
                                        <Badge className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-black text-[9px] uppercase tracking-tighter">
                                            {item.grow}
                                        </Badge>
                                    </div>
                                    <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden shadow-inner">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.max(30, 100 - (i * 20))}%` }}
                                            transition={{ duration: 1.5, ease: "circOut", delay: i * 0.2 }}
                                            className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full"
                                        />
                                    </div>
                                    <div className="flex justify-between mt-3 px-1">
                                        <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">{item.orders} ORDERS</p>
                                        <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Top Rated</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-10 bg-neutral-900/40 mt-auto border-t border-neutral-900">
                            <Link href="/dashboard/menu" className="h-16 flex items-center justify-center bg-white text-neutral-950 rounded-2xl hover:bg-orange-600 hover:text-white transition-all duration-500 font-black uppercase tracking-[0.2em] text-[10px] group/btn overflow-hidden relative shadow-xl">
                                <span className="relative z-10">Inventory Admin</span>
                                <div className="absolute inset-0 bg-orange-600 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
                            </Link>
                        </div>
                    </Card>
                </motion.div>
            </div>

            {/* Quick Actions / Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div variants={itemVariant}>
                    <div className="p-8 rounded-[2rem] bg-orange-600/10 border border-orange-600/20 flex items-center justify-between group hover:bg-orange-600/20 transition-all cursor-pointer">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-orange-600 flex items-center justify-center text-white shadow-xl shadow-orange-600/30 group-hover:scale-110 transition-transform">
                                <ChefHat className="w-8 h-8" />
                            </div>
                            <div>
                                <h4 className="text-xl font-black text-white uppercase tracking-tight">KITCHEN OPS</h4>
                                <p className="text-neutral-500 text-sm font-medium">Switch to dedicated production monitor</p>
                            </div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-orange-600 group-hover:translate-x-2 transition-transform" />
                    </div>
                </motion.div>
                <motion.div variants={itemVariant}>
                    <div className="p-8 rounded-[2rem] bg-neutral-900 border border-neutral-800 flex items-center justify-between group hover:border-white/20 transition-all cursor-pointer">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-white flex items-center justify-center text-black shadow-xl group-hover:scale-110 transition-transform">
                                <Receipt className="w-8 h-8" />
                            </div>
                            <div>
                                <h4 className="text-xl font-black text-white uppercase tracking-tight">POINT OF SALE</h4>
                                <p className="text-neutral-500 text-sm font-medium">Open terminal for billing and checkout</p>
                            </div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-white group-hover:translate-x-2 transition-transform" />
                    </div>
                </motion.div>
            </div>
        </motion.div>
    )
}
