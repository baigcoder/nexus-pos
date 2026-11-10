'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    Shield, ClipboardList, TrendingUp, Users, Clock, Zap, Play, Check, 
    ChevronRight, Circle, Activity, CreditCard, Sparkles 
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MockOrder {
    id: string
    items: string
    table: string
    status: 'new' | 'preparing' | 'ready' | 'served'
    price: string
}

export function HeroAnimation() {
    const [orders, setOrders] = useState<MockOrder[]>([
        { id: '1092', items: '2x Truffle Burger, Parmesan Fries', table: 'T-04', status: 'ready', price: 'Rs 3,450' },
        { id: '1093', items: '1x Margherita Pizza, Fresh Lemonade', table: 'T-08', status: 'preparing', price: 'Rs 1,890' },
        { id: '1094', items: '1x Spicy Salmon Bowl, Iced Latte', table: 'T-02', status: 'new', price: 'Rs 2,200' },
    ])
    const [sales, setSales] = useState(48620)
    const [activeTab, setActiveTab] = useState('orders')

    // Periodically update orders to make it feel alive!
    useEffect(() => {
        const interval = setInterval(() => {
            setOrders(prev => {
                const next = [...prev]
                // Randomly change a status or add a new order
                const indexToUpdate = Math.floor(Math.random() * next.length)
                const statuses: ('new' | 'preparing' | 'ready' | 'served')[] = ['new', 'preparing', 'ready', 'served']
                const currentStatus = next[indexToUpdate].status
                const currentIdx = statuses.indexOf(currentStatus)
                const nextStatus = statuses[(currentIdx + 1) % statuses.length]
                
                next[indexToUpdate] = {
                    ...next[indexToUpdate],
                    status: nextStatus
                }

                // Randomly increment sales
                setSales(s => s + Math.floor(Math.random() * 150) + 50)
                
                return next
            })
        }, 4000)
        return () => clearInterval(interval)
    }, [])

    const statusColors = {
        new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        preparing: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse',
        ready: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        served: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    }

    return (
        <div className="relative w-full aspect-[16/10] bg-[#08090c] rounded-2xl overflow-hidden flex text-slate-200 border border-white/5 select-none">
            {/* Ambient Background Glows inside the mockup container */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-brand/10 rounded-full blur-[80px]" />
                <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-violet-600/5 rounded-full blur-[60px]" />
            </div>

            {/* Left Mock Sidebar */}
            <div className="w-[22%] bg-[#0c0e14]/80 border-r border-white/5 p-4 flex flex-col justify-between hidden sm:flex relative z-10">
                <div className="space-y-6">
                    {/* Brand */}
                    <div className="flex items-center gap-2 px-1">
                        <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shadow-glow">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-display font-bold text-sm tracking-tight text-white">
                            Nexus<span className="text-brand">POS</span>
                        </span>
                    </div>

                    {/* Nav Links */}
                    <div className="space-y-1">
                        {[
                            { id: 'orders', label: 'Order Monitor', icon: ClipboardList },
                            { id: 'analytics', label: 'Live Sales', icon: TrendingUp },
                            { id: 'staff', label: 'Staff Hub', icon: Users },
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left",
                                    activeTab === item.id 
                                        ? "bg-brand/10 text-brand border border-brand/20 shadow-glow" 
                                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                                )}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer details */}
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">Live Server</span>
                </div>
            </div>

            {/* Main simulator space */}
            <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
                {/* Header bar */}
                <header className="h-14 border-b border-white/5 px-6 flex items-center justify-between bg-[#0c0e14]/50 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Terminal</span>
                        <div className="h-1.5 w-1.5 rounded-full bg-brand" />
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Live Clock display */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                            <Clock className="w-3.5 h-3.5 text-brand" />
                            <span>14:38:05</span>
                        </div>
                        <div className="w-8 h-8 rounded-full border border-white/10 bg-brand/20 flex items-center justify-center font-bold text-xs text-brand shadow-glow">
                            O
                        </div>
                    </div>
                </header>

                {/* Simulated Content Area */}
                <div className="flex-1 p-5 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {activeTab === 'orders' && (
                            <motion.div
                                key="orders"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4 h-full flex flex-col"
                            >
                                {/* Metrics top */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New</span>
                                        <span className="text-lg font-black font-display text-blue-400 mt-1">12 Orders</span>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preparing</span>
                                        <span className="text-lg font-black font-display text-amber-400 mt-1 animate-pulse">8 Orders</span>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Time</span>
                                        <span className="text-lg font-black font-display text-emerald-400 mt-1">8.2m</span>
                                    </div>
                                </div>

                                {/* Order Monitor Feed */}
                                <div className="flex-1 space-y-2 overflow-hidden relative">
                                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#08090c] to-transparent pointer-events-none z-10" />
                                    <p className="text-[11px] font-bold text-slate-400 tracking-wide mb-1 uppercase">Kitchen Stream</p>
                                    <div className="space-y-2 overflow-y-auto max-h-[170px] pr-1">
                                        {orders.map(order => (
                                            <motion.div
                                                key={order.id}
                                                layout
                                                className="p-3 rounded-xl bg-[#0c0e14]/90 border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-brand/5 border border-brand/20 flex items-center justify-center font-display font-bold text-xs text-brand shadow-glow">
                                                        {order.table}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-bold text-slate-200">{order.items}</p>
                                                        <p className="text-[10px] text-slate-400 font-medium">Order #{order.id} • {order.price}</p>
                                                    </div>
                                                </div>

                                                <div className={cn("px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border", statusColors[order.status])}>
                                                    {order.status}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'analytics' && (
                            <motion.div
                                key="analytics"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4"
                            >
                                <div className="flex justify-between items-center bg-white/5 border border-white/5 p-3.5 rounded-xl">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Revenue Today</p>
                                        <p className="text-xl font-black font-display text-white mt-1">Rs {sales.toLocaleString()}</p>
                                    </div>
                                    <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center gap-1 border border-emerald-500/20 shadow-glow">
                                        <TrendingUp className="w-3.5 h-3.5" />
                                        +24.5%
                                    </div>
                                </div>

                                {/* Simulated SVG Area Chart */}
                                <div className="relative p-3.5 bg-white/5 border border-white/5 rounded-xl h-[130px] flex flex-col justify-end">
                                    <div className="absolute top-3 left-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sales Distribution</div>
                                    <svg className="w-full h-[65%] text-brand" viewBox="0 0 100 30" preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.25" />
                                                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.0" />
                                            </linearGradient>
                                        </defs>
                                        {/* Filled Area */}
                                        <path 
                                            d="M0,30 Q15,20 30,22 T60,8 T90,5 T100,2 L100,30 Z" 
                                            fill="url(#chartGrad)" 
                                        />
                                        {/* Line */}
                                        <path 
                                            d="M0,30 Q15,20 30,22 T60,8 T90,5 T100,2" 
                                            fill="none" 
                                            stroke="currentColor" 
                                            strokeWidth="1.2" 
                                            strokeLinecap="round" 
                                        />
                                    </svg>
                                    <div className="flex justify-between text-[8px] text-slate-400 font-mono mt-2 pt-2 border-t border-white/5">
                                        <span>08:00</span>
                                        <span>12:00</span>
                                        <span>16:00</span>
                                        <span>20:00</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'staff' && (
                            <motion.div
                                key="staff"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4"
                            >
                                <div className="flex justify-between items-center">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Shift Crew</p>
                                    <span className="text-[10px] bg-brand-subtle text-brand border border-brand/20 px-2 py-0.5 rounded-full font-bold">5 Staff Clocked In</span>
                                </div>

                                <div className="space-y-2">
                                    {[
                                        { name: 'Alex Cooper', role: 'Head Chef', performance: '100%', activeOrders: 3, avatar: 'A' },
                                        { name: 'Sarah Patel', role: 'Server (Floor A)', performance: '98%', activeOrders: 4, avatar: 'S' },
                                        { name: 'Marcus Vance', role: 'Kitchen Associate', performance: '95%', activeOrders: 2, avatar: 'M' },
                                    ].map((staff, i) => (
                                        <div key={i} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-display font-black text-xs">
                                                    {staff.avatar}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-white">{staff.name}</p>
                                                    <p className="text-[10px] text-slate-400">{staff.role}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold text-emerald-400">{staff.performance}</p>
                                                    <p className="text-[9px] text-slate-400">Score</p>
                                                </div>
                                                <div className="h-6 w-px bg-white/5" />
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold text-white">{staff.activeOrders} orders</p>
                                                    <p className="text-[9px] text-slate-400">Active</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
