'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    DollarSign,
    Receipt,
    CreditCard,
    Banknote,
    Smartphone,
    CheckCircle2,
    Clock,
    TrendingUp,
    User
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { Card, Badge, Button } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import type { Order } from '@/types'

export default function CashierDashboard() {
    const { restaurant, staff } = useAuthStore()
    const [pendingOrders, setPendingOrders] = useState<Order[]>([])
    const [completedToday, setCompletedToday] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState('')
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

    // Mock data for demo
    const dailyStats = {
        totalSales: 125600,
        transactions: 47,
        cashPayments: 23,
        cardPayments: 18,
        mobilePayments: 6,
        avgTransaction: 2672,
    }

    const mockPendingOrders = [
        { id: '1', order_number: 1042, table: { table_number: '5' }, total: 2450, items: [{ name: 'Chicken Biryani', qty: 2 }, { name: 'Naan', qty: 4 }] },
        { id: '2', order_number: 1043, table: { table_number: '8' }, total: 3800, items: [{ name: 'Butter Chicken', qty: 1 }, { name: 'Dal Makhani', qty: 1 }] },
        { id: '3', order_number: 1044, table: { table_number: '3' }, total: 1200, items: [{ name: 'Paneer Tikka', qty: 2 }] },
    ]

    useEffect(() => {
        const updateTime = () => setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        updateTime()
        const interval = setInterval(updateTime, 60000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        // Simulate loading
        setTimeout(() => {
            setIsLoading(false)
            setCompletedToday(47)
        }, 500)
    }, [])

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
    }

    const handleProcessPayment = (method: 'cash' | 'card' | 'mobile') => {
        if (!selectedOrder) return
        // Mock payment processing
        setSelectedOrder(null)
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-10 pb-24"
        >
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-purple-600/10 text-purple-500 border-purple-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            ● Cashier Station
                        </Badge>
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{currentTime}</span>
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white uppercase">
                        Checkout <span className="text-purple-500">& Billing</span>
                    </h1>
                    <p className="text-neutral-400 text-lg font-medium">
                        Welcome, <span className="text-white font-bold">{staff?.name || 'Cashier'}</span>
                    </p>
                </div>
            </div>

            {/* Daily Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Sales', value: `Rs.${(dailyStats.totalSales / 1000).toFixed(1)}k`, icon: DollarSign, color: 'text-emerald-500' },
                    { label: 'Transactions', value: dailyStats.transactions.toString(), icon: Receipt, color: 'text-purple-500' },
                    { label: 'Avg. Bill', value: `Rs.${dailyStats.avgTransaction}`, icon: TrendingUp, color: 'text-blue-500' },
                    { label: 'Completed', value: completedToday.toString(), icon: CheckCircle2, color: 'text-orange-600' },
                ].map((stat, idx) => (
                    <motion.div key={idx} variants={item}>
                        <Card className="p-5 bg-neutral-900 border-neutral-800 shadow-xl relative overflow-hidden group">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">{stat.label}</p>
                                    <h3 className={cn("text-2xl font-bold tracking-tight", stat.color)}>{stat.value}</h3>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-purple-500 group-hover:border-purple-500 transition-all">
                                    <stat.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Payment Methods Summary */}
            <motion.div variants={item}>
                <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-xl">
                    <h2 className="text-lg font-bold text-white uppercase tracking-tight mb-6">Payment <span className="text-purple-500">Breakdown</span></h2>
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { method: 'Cash', count: dailyStats.cashPayments, icon: Banknote, color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
                            { method: 'Card', count: dailyStats.cardPayments, icon: CreditCard, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
                            { method: 'Mobile', count: dailyStats.mobilePayments, icon: Smartphone, color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
                        ].map((pm, idx) => (
                            <div key={idx} className={cn("p-5 rounded-xl border text-center", pm.color)}>
                                <pm.icon className="w-8 h-8 mx-auto mb-3" />
                                <p className="text-2xl font-bold">{pm.count}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">{pm.method} Payments</p>
                            </div>
                        ))}
                    </div>
                </Card>
            </motion.div>

            {/* Pending Checkout Queue */}
            <motion.div variants={item}>
                <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-white uppercase tracking-tight">Checkout <span className="text-purple-500">Queue</span></h2>
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Orders ready for payment</p>
                        </div>
                        <Badge className="bg-purple-500/10 text-purple-500 border-none font-bold">{mockPendingOrders.length} Pending</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {mockPendingOrders.map((order: any) => (
                            <div
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className={cn(
                                    "p-5 bg-black border-2 rounded-xl cursor-pointer transition-all hover:border-purple-500",
                                    selectedOrder?.id === order.id ? 'border-purple-500 shadow-lg shadow-purple-500/10' : 'border-neutral-800'
                                )}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center font-bold text-purple-500">
                                            {order.table.table_number}
                                        </div>
                                        <div>
                                            <span className="font-bold text-white">Order #{order.order_number}</span>
                                            <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">
                                                {order.items.length} items
                                            </p>
                                        </div>
                                    </div>
                                    <Clock className="w-4 h-4 text-neutral-600" />
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t border-neutral-900">
                                    <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Total</span>
                                    <span className="text-xl font-bold text-white">Rs.{order.total.toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Payment Buttons */}
                    {selectedOrder && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-6 p-6 bg-black border border-purple-500/30 rounded-xl"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <span className="font-bold text-white">Process Payment for Order #{(selectedOrder as any).order_number}</span>
                                    <p className="text-purple-500 font-bold text-2xl mt-1">Rs.{(selectedOrder as any).total?.toLocaleString()}</p>
                                </div>
                                <button onClick={() => setSelectedOrder(null)} className="text-neutral-600 hover:text-white">
                                    ✕
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <Button
                                    onClick={() => handleProcessPayment('cash')}
                                    className="h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest"
                                    icon={Banknote}
                                >
                                    Cash
                                </Button>
                                <Button
                                    onClick={() => handleProcessPayment('card')}
                                    className="h-14 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-widest"
                                    icon={CreditCard}
                                >
                                    Card
                                </Button>
                                <Button
                                    onClick={() => handleProcessPayment('mobile')}
                                    className="h-14 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-widest"
                                    icon={Smartphone}
                                >
                                    Mobile
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </Card>
            </motion.div>
        </motion.div>
    )
}
