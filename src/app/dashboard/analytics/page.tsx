'use client'

import { motion } from 'framer-motion'
import {
    TrendingUp,
    ShoppingBag,
    Clock,
    BarChart3,
    Calendar,
    Download,
    ArrowUpRight
} from 'lucide-react'
import { Card, Button, Badge } from '@/components/ui/common'
import { cn } from '@/lib/utils'

export default function AnalyticsPage() {
    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-12 pb-24"
        >
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                <div>
                    <div className="flex items-center gap-4 mb-3">
                        <Badge variant="outline" className="bg-orange-600/10 text-orange-600 border-orange-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            Live Analytics
                        </Badge>
                        <div className="h-px w-12 bg-neutral-800" />
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Performance Period</span>
                    </div>
                    <h1 className="text-5xl font-bold tracking-tight text-white uppercase">
                        Business <span className="text-orange-600">Reports</span>
                    </h1>
                    <p className="text-neutral-500 mt-4 font-medium text-lg">
                        Reviewing <span className="text-white font-bold">detailed performance metrics</span> across all restaurant operations.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        className="h-16 px-10 border-neutral-800 text-neutral-400 font-bold text-xs uppercase tracking-widest hover:bg-white hover:text-neutral-900 hover:border-white transition-all"
                        icon={Calendar}
                    >
                        Select Period
                    </Button>
                    <Button className="h-16 px-12 bg-orange-600 hover:bg-orange-500 text-white shadow-2xl shadow-orange-600/30 font-bold uppercase tracking-widest text-xs border-none group">
                        Export Report <ArrowUpRight className="ml-2 w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </Button>
                </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Revenue', value: '$458.2K', change: 18.5, icon: TrendingUp, color: 'text-orange-600' },
                    { label: 'Total Orders', value: '1,284', change: 4.2, icon: ShoppingBag, color: 'text-white' },
                    { label: 'Order Accuracy', value: '98.4%', change: 1.2, icon: BarChart3, color: 'text-white' },
                    { label: 'Avg Prep Time', value: '14.2m', change: -8.1, icon: Clock, color: 'text-white' },
                ].map((stat) => (
                    <motion.div key={stat.label} variants={item}>
                        <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-600/5 rounded-bl-full group-hover:bg-orange-600/10 transition-colors" />
                            <div className="flex items-start justify-between relative z-10">
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4">{stat.label}</p>
                                    <h3 className={cn("text-3xl font-bold tracking-tight", stat.color)}>{stat.value}</h3>
                                    <div className="flex items-center gap-2 mt-4 text-[10px] uppercase font-bold tracking-widest">
                                        <span className={stat.change >= 0 ? "text-emerald-500" : "text-rose-500"}>
                                            {stat.change >= 0 ? '+' : ''}{stat.change}%
                                        </span>
                                        <span className="text-neutral-600">vs Previous Period</span>
                                    </div>
                                </div>
                                <div className="w-14 h-14 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center group-hover:border-orange-600 transition-colors shadow-inner">
                                    <stat.icon className="w-6 h-6 text-neutral-500 group-hover:text-orange-600 transition-colors" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Visual Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <motion.div variants={item}>
                    <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-2xl relative overflow-hidden h-[500px] flex flex-col">
                        <div className="flex items-center justify-between mb-12">
                            <div>
                                <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Revenue <span className="text-orange-600">Distribution</span></h2>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-2">Daily revenue for the last 7 days</p>
                            </div>
                            <Badge className="bg-black border border-neutral-800 text-neutral-400 font-bold text-[10px] px-4 py-2 uppercase">Stable Performance</Badge>
                        </div>
                        <div className="flex-1 flex items-end gap-3 pb-4">
                            {[40, 65, 45, 90, 55, 75, 85].map((val, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                                    <div className="w-full relative bg-black rounded-t-xl border-x border-t border-neutral-800 overflow-hidden" style={{ height: `${val}%` }}>
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: '100%' }}
                                            transition={{ duration: 1.5, delay: 0.1 * i, ease: [0.16, 1, 0.3, 1] }}
                                            className="w-full bg-gradient-to-t from-orange-600 to-orange-400 opacity-80 group-hover:opacity-100 transition-opacity shadow-glow shadow-orange-600/20"
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest group-hover:text-orange-600 transition-colors">
                                        Day {i + 1}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </motion.div>

                <motion.div variants={item}>
                    <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-2xl relative overflow-hidden h-[500px] flex flex-col">
                        <div className="flex items-center justify-between mb-12">
                            <div>
                                <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Peak <span className="text-orange-600">Hours</span></h2>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-2">Order volume by hour</p>
                            </div>
                            <Clock className="w-6 h-6 text-neutral-700" />
                        </div>
                        <div className="flex-1 flex flex-col justify-between">
                            {[
                                { hour: '08:00', load: 30 },
                                { hour: '12:00', load: 85 },
                                { hour: '16:00', load: 45 },
                                { hour: '20:00', load: 95 },
                                { hour: '00:00', load: 20 },
                            ].map((item, i) => (
                                <div key={i} className="space-y-3">
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                        <span className="text-neutral-500">{item.hour}</span>
                                        <span className="text-white">Order Volume {item.load}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-black border border-neutral-800 rounded-full overflow-hidden p-0.5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${item.load}%` }}
                                            transition={{ duration: 1.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                            className={cn(
                                                "h-full rounded-full shadow-glow transition-all",
                                                item.load > 80 ? "bg-orange-600 shadow-orange-600/40" : "bg-white shadow-white/20"
                                            )}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </motion.div>
            </div>

            {/* Top Selling Items */}
            <motion.div variants={item}>
                <Card className="flex flex-col pt-6 px-0 pb-4 bg-neutral-900 border-neutral-800 shadow-2xl relative overflow-hidden">
                    <div className="px-10 mb-8 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Item <span className="text-orange-600">Performance</span></h2>
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-2">Most popular menu items this period</p>
                        </div>
                        <Button variant="outline" className="h-10 px-5 border-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-widest hover:border-white hover:text-white transition-all">
                            View Detailed Stats
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-separate border-spacing-y-0">
                            <thead>
                                <tr className="bg-black/50 text-neutral-600 font-bold text-[10px] uppercase tracking-widest">
                                    <th className="px-10 py-5 border-y border-neutral-800">Rank</th>
                                    <th className="px-10 py-5 border-y border-neutral-800">Item Name</th>
                                    <th className="px-10 py-5 border-y border-neutral-800 text-center">Total Orders</th>
                                    <th className="px-10 py-5 border-y border-neutral-800">Growth</th>
                                    <th className="px-10 py-5 border-y border-neutral-800 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800/50">
                                {['Nuclear Pizza', 'Quantum Burger', 'Cyber Sushi', 'Binary Pasta'].map((name, i) => (
                                    <tr key={name} className="group hover:bg-orange-600/[0.03] transition-all">
                                        <td className="px-10 py-6 text-neutral-700 font-bold tracking-widest">#{i + 1}</td>
                                        <td className="px-10 py-6">
                                            <span className="font-bold text-white uppercase tracking-tight">{name}</span>
                                        </td>
                                        <td className="px-10 py-6 text-center font-bold text-neutral-500 uppercase text-[10px] tracking-widest">{450 - (i * 40)} Orders</td>
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-2 text-emerald-500 font-bold text-[10px] uppercase tracking-widest">
                                                <TrendingUp className="w-3 h-3" />
                                                +{(12 - (i * 2)).toFixed(1)}%
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <Badge className="bg-orange-600 text-white font-bold text-[10px] px-3 py-1 rounded-md border-none shadow-glow shadow-orange-600/20">Top Seller</Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </motion.div>

            {/* Delivery Performance */}
            <motion.div variants={item}>
                <Card className="p-8 bg-neutral-900 border-neutral-800 shadow-2xl">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Delivery <span className="text-purple-500">Performance</span></h2>
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-2">Real-time delivery operations metrics</p>
                        </div>
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            Live Data
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                            { label: 'Avg Delivery Time', value: '24m', change: -12, icon: Clock, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
                            { label: 'On-Time Rate', value: '94.2%', change: 3.5, icon: TrendingUp, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
                            { label: 'Active Riders', value: '8/12', change: 0, icon: ShoppingBag, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
                            { label: 'Deliveries Today', value: '156', change: 22, icon: BarChart3, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
                        ].map((stat) => (
                            <div key={stat.label} className={cn("p-6 rounded-2xl border border-neutral-800", stat.bgColor, "bg-opacity-50")}>
                                <stat.icon className={cn("w-8 h-8 mb-4", stat.color)} />
                                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">{stat.label}</p>
                                <p className={cn("text-3xl font-bold", stat.color)}>{stat.value}</p>
                                {stat.change !== 0 && (
                                    <p className={cn("text-[10px] font-bold mt-2", stat.change > 0 ? "text-emerald-500" : "text-rose-500")}>
                                        {stat.change > 0 ? '+' : ''}{stat.change}% vs last week
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            </motion.div>

            {/* Revenue by Channel */}
            <motion.div variants={item}>
                <Card className="p-8 bg-neutral-900 border-neutral-800 shadow-2xl">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Revenue by <span className="text-emerald-500">Channel</span></h2>
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-2">Order sources and revenue distribution</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { channel: 'Website Orders', revenue: 'Rs.245,000', orders: 342, percentage: 45, color: 'bg-purple-500', icon: '🌐' },
                            { channel: 'Walk-in / Dine-in', revenue: 'Rs.189,500', orders: 456, percentage: 35, color: 'bg-emerald-500', icon: '🍽️' },
                            { channel: 'Phone / WhatsApp', revenue: 'Rs.108,200', orders: 178, percentage: 20, color: 'bg-orange-500', icon: '📞' },
                        ].map((item) => (
                            <div key={item.channel} className="p-6 bg-black/40 rounded-2xl border border-neutral-800 hover:border-neutral-700 transition-all group">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl", item.color, "bg-opacity-20")}>
                                        {item.icon}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">{item.channel}</p>
                                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{item.orders} orders</p>
                                    </div>
                                </div>
                                <p className="text-3xl font-bold text-white mb-4">{item.revenue}</p>
                                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                                    <div className={cn("h-full rounded-full", item.color)} style={{ width: `${item.percentage}%` }} />
                                </div>
                                <p className="text-[10px] text-neutral-500 mt-2 font-bold uppercase tracking-widest">{item.percentage}% of total revenue</p>
                            </div>
                        ))}
                    </div>
                </Card>
            </motion.div>
        </motion.div>
    )
}
