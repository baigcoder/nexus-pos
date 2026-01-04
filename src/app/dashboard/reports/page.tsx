'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    FileText,
    Download,
    Calendar,
    DollarSign,
    TrendingUp,
    ShoppingCart,
    Users,
    CreditCard,
    Banknote,
    Smartphone,
    ChevronLeft,
    ChevronRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface DailyReport {
    date: string
    totalOrders: number
    totalRevenue: number
    avgOrderValue: number
    topItems: { name: string; quantity: number; revenue: number }[]
    paymentBreakdown: { cash: number; card: number; mobile: number }
    hourlyBreakdown: { hour: string; orders: number; revenue: number }[]
}

export default function ReportsPage() {
    const { restaurant } = useAuthStore()
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [isLoading, setIsLoading] = useState(false)

    // Sample report data
    const report: DailyReport = {
        date: selectedDate,
        totalOrders: 87,
        totalRevenue: 186500,
        avgOrderValue: 2144,
        topItems: [
            { name: 'Chicken Biryani', quantity: 34, revenue: 35700 },
            { name: 'Butter Chicken', quantity: 28, revenue: 25900 },
            { name: 'Seekh Kebab', quantity: 22, revenue: 12100 },
            { name: 'Naan', quantity: 156, revenue: 15600 },
            { name: 'Mango Lassi', quantity: 45, revenue: 8550 },
        ],
        paymentBreakdown: { cash: 45, card: 32, mobile: 10 },
        hourlyBreakdown: [
            { hour: '12 PM', orders: 8, revenue: 18500 },
            { hour: '1 PM', orders: 12, revenue: 26400 },
            { hour: '2 PM', orders: 6, revenue: 12800 },
            { hour: '7 PM', orders: 15, revenue: 34200 },
            { hour: '8 PM', orders: 22, revenue: 48600 },
            { hour: '9 PM', orders: 18, revenue: 38400 },
            { hour: '10 PM', orders: 6, revenue: 7600 },
        ],
    }

    const handleExportPDF = () => {
        // Simple print-based PDF export
        window.print()
    }

    const handleDateChange = (days: number) => {
        const date = new Date(selectedDate)
        date.setDate(date.getDate() + days)
        setSelectedDate(date.toISOString().split('T')[0])
    }

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
    const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } } }

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-10 pb-24 print:pb-0 print:space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 print:hidden">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-emerald-600/10 text-emerald-500 border-emerald-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            ● Daily Reports
                        </Badge>
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white uppercase">
                        Sales <span className="text-emerald-500">Report</span>
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
                    <Button onClick={handleExportPDF} icon={Download} className="h-14 px-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest text-xs">
                        Export PDF
                    </Button>
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block">
                <h1 className="text-2xl font-bold text-black">Daily Sales Report - {new Date(selectedDate).toLocaleDateString()}</h1>
                <p className="text-neutral-600">{restaurant?.name || 'OrderFlow Restaurant'}</p>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
                {[
                    { label: 'Total Orders', value: report.totalOrders, icon: ShoppingCart, color: 'text-blue-500', prefix: '' },
                    { label: 'Revenue', value: (report.totalRevenue / 1000).toFixed(1) + 'K', icon: DollarSign, color: 'text-emerald-500', prefix: 'Rs.' },
                    { label: 'Avg Order', value: report.avgOrderValue.toLocaleString(), icon: TrendingUp, color: 'text-orange-500', prefix: 'Rs.' },
                    { label: 'Transactions', value: report.paymentBreakdown.cash + report.paymentBreakdown.card + report.paymentBreakdown.mobile, icon: CreditCard, color: 'text-purple-500', prefix: '' },
                ].map((stat, idx) => (
                    <motion.div key={idx} variants={item}>
                        <Card className="p-5 bg-neutral-900 border-neutral-800 print:bg-white print:border print:border-neutral-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">{stat.label}</p>
                                    <h3 className={cn("text-2xl font-bold print:text-black", stat.color)}>{stat.prefix}{stat.value}</h3>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-neutral-600 print:hidden">
                                    <stat.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                {/* Top Selling Items */}
                <motion.div variants={item}>
                    <Card className="p-6 bg-neutral-900 border-neutral-800 print:bg-white print:border print:border-neutral-200">
                        <h3 className="text-lg font-bold text-white mb-6 print:text-black">Top Selling Items</h3>
                        <div className="space-y-4">
                            {report.topItems.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-black border border-neutral-800 rounded-xl print:bg-neutral-100 print:border-neutral-200">
                                    <div className="flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-lg bg-neutral-900 text-orange-500 flex items-center justify-center font-bold text-sm print:bg-white">
                                            {idx + 1}
                                        </span>
                                        <div>
                                            <p className="font-bold text-white text-sm print:text-black">{item.name}</p>
                                            <p className="text-[10px] text-neutral-500 font-bold uppercase">{item.quantity} sold</p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-emerald-500 print:text-emerald-600">Rs.{item.revenue.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </motion.div>

                {/* Payment Methods */}
                <motion.div variants={item}>
                    <Card className="p-6 bg-neutral-900 border-neutral-800 print:bg-white print:border print:border-neutral-200">
                        <h3 className="text-lg font-bold text-white mb-6 print:text-black">Payment Methods</h3>
                        <div className="space-y-4">
                            {[
                                { method: 'Cash', count: report.paymentBreakdown.cash, icon: Banknote, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                                { method: 'Card', count: report.paymentBreakdown.card, icon: CreditCard, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                                { method: 'Mobile', count: report.paymentBreakdown.mobile, icon: Smartphone, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                            ].map((pm, idx) => {
                                const total = report.paymentBreakdown.cash + report.paymentBreakdown.card + report.paymentBreakdown.mobile
                                const percent = Math.round((pm.count / total) * 100)
                                return (
                                    <div key={idx} className="p-4 bg-black border border-neutral-800 rounded-xl print:bg-neutral-100 print:border-neutral-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", pm.bg, pm.color)}>
                                                    <pm.icon className="w-5 h-5" />
                                                </div>
                                                <span className="font-bold text-white print:text-black">{pm.method}</span>
                                            </div>
                                            <span className={cn("font-bold text-xl", pm.color)}>{pm.count}</span>
                                        </div>
                                        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden print:bg-neutral-200">
                                            <div className={cn("h-full rounded-full", pm.bg.replace('/10', ''))} style={{ width: `${percent}%` }} />
                                        </div>
                                        <p className="text-[10px] text-neutral-500 font-bold mt-2 uppercase">{percent}% of transactions</p>
                                    </div>
                                )
                            })}
                        </div>
                    </Card>
                </motion.div>
            </div>

            {/* Hourly Breakdown */}
            <motion.div variants={item}>
                <Card className="p-6 bg-neutral-900 border-neutral-800 print:bg-white print:border print:border-neutral-200">
                    <h3 className="text-lg font-bold text-white mb-6 print:text-black">Hourly Breakdown</h3>
                    <div className="grid grid-cols-7 gap-3">
                        {report.hourlyBreakdown.map((h, idx) => (
                            <div key={idx} className="p-4 bg-black border border-neutral-800 rounded-xl text-center print:bg-neutral-100 print:border-neutral-200">
                                <p className="text-[10px] font-bold text-neutral-500 uppercase mb-2">{h.hour}</p>
                                <p className="text-xl font-bold text-white print:text-black">{h.orders}</p>
                                <p className="text-[10px] font-bold text-emerald-500">Rs.{(h.revenue / 1000).toFixed(1)}K</p>
                            </div>
                        ))}
                    </div>
                </Card>
            </motion.div>
        </motion.div>
    )
}
