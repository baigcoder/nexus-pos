'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search,
    Clock,
    CheckCircle2,
    XCircle,
    ChefHat,
    Utensils,
    DollarSign,
    Eye,
    X,
    Printer,
    ArrowRight,
    ArrowUpRight,
    MapPin,
    Calendar,
    RefreshCw,
    Volume2
} from 'lucide-react'
import { Card, Button, Badge, SearchInput, Modal, StatCard } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import { useAllOrders } from '@/hooks/useRealtimeOrders'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import type { Order, OrderStatus } from '@/types'

const statusConfig: Record<OrderStatus, { label: string; variant: 'error' | 'warning' | 'success' | 'default' | 'neutral'; icon: any }> = {
    pending: { label: 'Pending', variant: 'error', icon: Clock },
    preparing: { label: 'Preparing', variant: 'warning', icon: ChefHat },
    ready: { label: 'Ready', variant: 'success', icon: CheckCircle2 },
    served: { label: 'Served', variant: 'default', icon: Utensils },
    paid: { label: 'Paid', variant: 'success', icon: DollarSign },
    cancelled: { label: 'Cancelled', variant: 'neutral', icon: XCircle },
}

export default function OrdersPage() {
    const { orders: realtimeOrders, isLoading, refresh } = useAllOrders()
    const { success, error: showError } = useToast()
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [soundEnabled, setSoundEnabled] = useState(true)

    // Play sound when new order arrives
    useEffect(() => {
        if (soundEnabled && realtimeOrders.length > 0) {
            // Sound notification logic can be added here
        }
    }, [realtimeOrders.length, soundEnabled])

    const filteredOrders = realtimeOrders.filter(order => {
        const matchesSearch = order.order_number?.toString().includes(searchQuery) ||
            order.table?.table_number?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter
        return matchesSearch && matchesStatus
    })

    const getTimeAgo = (date: string) => {
        const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
        if (mins < 1) return 'Just now'
        if (mins < 60) return `${mins}m ago`
        return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
    }

    // Update order status
    const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
        const supabase = createClient()
        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId)

        if (error) {
            showError('Error', 'Failed to update order status')
        } else {
            success('Updated', `Order status changed to ${newStatus}`)
            setSelectedOrder(null)
        }
    }

    const statsData = [
        { label: 'Total Orders', value: realtimeOrders.length.toString(), icon: Utensils, change: 0 },
        { label: 'Active Orders', value: realtimeOrders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)).length.toString(), icon: Clock, change: 12 },
        { label: 'Today\'s Revenue', value: `Rs. ${(realtimeOrders.reduce((sum, o) => sum + (o.total || 0), 0) / 1000).toFixed(1)}K`, icon: DollarSign, change: 8.5 },
    ]

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
    }

    return (
        <div className="relative min-h-screen">
            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <motion.div
                    animate={{
                        x: [0, 100, 0],
                        y: [0, 50, 0],
                        scale: [1, 1.2, 1]
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-orange-600/10 blur-[120px] rounded-full"
                />
                <motion.div
                    animate={{
                        x: [0, -80, 0],
                        y: [0, 100, 0],
                        scale: [1, 1.3, 1]
                    }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-purple-600/10 blur-[150px] rounded-full"
                />
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="px-2 lg:px-4 space-y-10 pb-24 relative z-10"
            >
                {/* Header */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pt-4">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="px-4 py-1.5 bg-orange-600/10 border border-orange-600/20 rounded-full flex items-center gap-2"
                            >
                                <span className="w-1.5 h-1.5 bg-orange-600 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em]">Order Hub</span>
                            </motion.div>
                            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Live Sync Active</span>
                        </div>

                        <motion.h1
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-5xl lg:text-7xl font-black text-white tracking-tight leading-[0.9]"
                        >
                            ORDER <br />
                            <span className="bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 bg-clip-text text-transparent italic">
                                HISTORY
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="text-neutral-500 font-bold text-lg max-w-xl"
                        >
                            Managing <span className="text-white underline decoration-orange-600/50 underline-offset-4 font-black">{realtimeOrders.length} orders</span> across the restaurant ecosystem.
                        </motion.p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <motion.button
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            className="h-14 px-8 bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl flex items-center gap-3 text-neutral-400 hover:text-white transition-all group shadow-xl"
                        >
                            <Printer className="w-5 h-5 group-hover:text-blue-500 transition-colors" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Print Report</span>
                        </motion.button>

                        <Link href="/dashboard/kitchen">
                            <motion.button
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                className="group relative h-14 px-10 bg-orange-600 rounded-2xl flex items-center gap-3 overflow-hidden shadow-2xl shadow-orange-600/20"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                <ChefHat className="w-5 h-5 text-white" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Kitchen View</span>
                                <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
                            </motion.button>
                        </Link>
                    </div>
                </header>

                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Total Orders', value: realtimeOrders.length.toString(), icon: Utensils, change: undefined, color: "from-orange-500/20 to-orange-600/5" },
                        { label: 'Active Orders', value: realtimeOrders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)).length.toString(), icon: Clock, change: 12, color: "from-blue-500/20 to-blue-600/5" },
                        { label: 'Daily Revenue', value: `Rs. ${(realtimeOrders.reduce((sum, o) => sum + (o.total || 0), 0) / 1000).toFixed(1)}K`, icon: DollarSign, change: 8.5, color: "from-emerald-500/20 to-emerald-600/5" },
                    ].map((stat) => (
                        <motion.div
                            key={stat.label}
                            variants={item}
                            whileHover={{ y: -5, scale: 1.02 }}
                            className="group"
                        >
                            <div className="relative h-full p-8 rounded-[2.5rem] bg-neutral-900/40 backdrop-blur-3xl border border-neutral-800/50 overflow-hidden transition-all duration-500 hover:border-orange-500/30 shadow-2xl">
                                {/* Internal Glow */}
                                <div className={cn("absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700", stat.color)} />

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="w-12 h-12 rounded-2xl bg-black/40 border border-neutral-800/50 flex items-center justify-center text-neutral-400 group-hover:text-white group-hover:border-orange-500/50 transition-all duration-500 shadow-inner">
                                            <stat.icon className="w-6 h-6" />
                                        </div>
                                        {stat.change !== undefined && (
                                            <div className={cn(
                                                "px-3 py-1 rounded-full text-[10px] font-black tracking-widest border transition-all duration-500",
                                                stat.change >= 0
                                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-black"
                                                    : "bg-rose-500/10 border-rose-500/20 text-rose-500 group-hover:bg-rose-500 group-hover:text-black"
                                            )}>
                                                {stat.change >= 0 ? '↑' : '↓'} {Math.abs(stat.change)}%
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-auto">
                                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-4xl font-black text-white tracking-tighter leading-none">{stat.value}</h3>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Filters */}
                <motion.div variants={item}>
                    <div className="p-8 bg-neutral-900/40 backdrop-blur-3xl border border-neutral-800/50 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                        <div className="flex flex-col xl:flex-row gap-8 items-center relative z-10">
                            <div className="flex-1 w-full relative group/input">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within/input:text-orange-600 transition-colors" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="SEARCH ORDER # OR TABLE..."
                                    className="w-full h-16 bg-black/40 border border-neutral-800/50 rounded-2xl pl-16 pr-6 text-[10px] font-black uppercase tracking-[0.2em] outline-none focus:border-orange-500/50 focus:ring-8 focus:ring-orange-500/5 transition-all text-white placeholder:text-neutral-700 shadow-inner"
                                />
                            </div>

                            <div className="flex gap-3 flex-wrap justify-center bg-black/20 p-2 rounded-2xl border border-neutral-800/50">
                                {(['all', 'pending', 'preparing', 'ready', 'served', 'paid'] as const).map(status => (
                                    <motion.button
                                        key={status}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setStatusFilter(status)}
                                        className={cn(
                                            'px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 border relative overflow-hidden group/btn',
                                            statusFilter === status
                                                ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20'
                                                : 'bg-transparent text-neutral-500 border-neutral-800/50 hover:border-neutral-700 hover:text-white'
                                        )}
                                    >
                                        <span className="relative z-10">{status === 'all' ? 'All Orders' : statusConfig[status].label}</span>
                                        {statusFilter === status && (
                                            <motion.div
                                                layoutId="activeFilter"
                                                className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-transparent"
                                            />
                                        )}
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Orders List */}
                <motion.div variants={item}>
                    <div className="rounded-[3rem] overflow-hidden bg-neutral-900/40 backdrop-blur-3xl border border-neutral-800/50 shadow-2xl relative">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-black/60 border-b border-neutral-800/50">
                                        <th className="px-10 py-8 text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Payload ID</th>
                                        <th className="px-10 py-8 text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Station</th>
                                        <th className="px-10 py-8 text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Capacity</th>
                                        <th className="px-10 py-8 text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Revenue</th>
                                        <th className="px-10 py-8 text-center text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Lifecycle</th>
                                        <th className="px-10 py-8 text-center text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Duration</th>
                                        <th className="px-10 py-8 text-right text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800/30">
                                    {filteredOrders.length > 0 ? filteredOrders.map((order) => {
                                        const cfg = statusConfig[order.status]
                                        return (
                                            <motion.tr
                                                key={order.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="group hover:bg-orange-500/[0.02] transition-colors duration-500"
                                            >
                                                <td className="px-10 py-8">
                                                    <span className="text-sm font-black text-neutral-400 group-hover:text-orange-500 transition-colors">#{order.order_number}</span>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-black/40 border border-neutral-800 flex items-center justify-center font-black text-[10px] group-hover:border-orange-500/50 transition-all shadow-inner">
                                                            {order.table?.table_number || '?'}
                                                        </div>
                                                        <span className="font-black text-white text-sm tracking-tighter">Table {order.table?.table_number || 'N/A'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-white">{order.items?.length || 0}</span>
                                                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Selected Items</span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <span className="text-base font-black text-white tracking-tighter">Rs. {order.total.toLocaleString()}</span>
                                                </td>
                                                <td className="px-10 py-8 text-center">
                                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-neutral-800 group-hover:border-orange-500/30 transition-all">
                                                        <span className={cn(
                                                            "w-1.5 h-1.5 rounded-full",
                                                            order.status === 'pending' ? 'bg-rose-500 animate-pulse' :
                                                                order.status === 'preparing' ? 'bg-orange-500 animate-pulse' :
                                                                    order.status === 'ready' ? 'bg-emerald-500 animate-pulse' :
                                                                        'bg-neutral-600'
                                                        )} />
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-[0.2em]",
                                                            order.status === 'pending' ? 'text-rose-500' :
                                                                order.status === 'preparing' ? 'text-orange-500' :
                                                                    order.status === 'ready' ? 'text-emerald-500' :
                                                                        'text-neutral-500'
                                                        )}>
                                                            {cfg.label}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8 text-center">
                                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{getTimeAgo(order.created_at)}</span>
                                                </td>
                                                <td className="px-10 py-8 text-right">
                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="h-10 px-6 bg-neutral-900 border border-neutral-800 rounded-xl text-[9px] font-black text-neutral-500 uppercase tracking-widest hover:text-white hover:border-orange-500 hover:shadow-lg hover:shadow-orange-600/10 transition-all inline-flex items-center gap-3"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        Details
                                                    </motion.button>
                                                </td>
                                            </motion.tr>
                                        )
                                    }) : (
                                        <tr>
                                            <td colSpan={7} className="px-10 py-32 text-center text-neutral-600 font-black uppercase tracking-[0.3em] italic">
                                                No orders found in this lifecycle stage
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.div>

                {/* Order Detail Modal */}
                <AnimatePresence>
                    {selectedOrder && (
                        <Modal
                            isOpen={!!selectedOrder}
                            onClose={() => setSelectedOrder(null)}
                            title={`SETTLEMENT PAYLOAD: #${selectedOrder.order_number}`}
                            size="lg"
                        >
                            <div className="space-y-10 py-6 bg-transparent relative overflow-hidden">
                                {/* Brand Glow */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/5 blur-[100px] rounded-full pointer-events-none" />

                                <div className="flex items-center justify-between pb-10 border-b border-neutral-800/50 relative z-10">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 rounded-[1.5rem] bg-neutral-900 border border-neutral-800 text-orange-500 flex items-center justify-center font-black text-2xl shadow-2xl shadow-orange-600/10 italic">
                                            {selectedOrder.table?.table_number || '?'}
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em] block mb-1">STATION ASSIGNMENT</span>
                                            <h3 className="text-3xl font-black text-white tracking-tighter">Table {selectedOrder.table?.table_number || 'N/A'}</h3>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="px-5 py-2 rounded-xl bg-orange-600/10 border border-orange-500/30">
                                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{statusConfig[selectedOrder.status].label}</span>
                                        </div>
                                        <span className="text-[9px] font-black text-neutral-700 uppercase tracking-widest">LIFECYCLE STATUS</span>
                                    </div>
                                </div>

                                <div className="space-y-6 relative z-10">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em]">ITEMIZED INVENTORY</span>
                                        <div className="h-0.5 flex-1 mx-6 bg-gradient-to-r from-neutral-800 to-transparent opacity-30" />
                                    </div>

                                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                        {(selectedOrder.items || []).map((item, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="flex justify-between items-center p-6 bg-neutral-900/40 border border-neutral-800/50 rounded-[1.5rem] group hover:border-orange-500/30 transition-all shadow-xl"
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className="w-10 h-10 rounded-xl bg-black/40 border border-neutral-800 flex items-center justify-center shadow-inner">
                                                        <span className="text-xs font-black text-orange-500">x{item.quantity}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-white text-sm tracking-tight block">{item.menu_item?.name || 'Item'}</span>
                                                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Individual Serving</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-black text-white text-base tracking-tighter">Rs. {item.subtotal || 0}</span>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-8 bg-black/40 rounded-[2.5rem] border border-neutral-800/50 space-y-4 relative z-10 shadow-inner">
                                    <div className="flex justify-between text-[10px] font-black text-neutral-600 uppercase tracking-widest">
                                        <span>SUBTOTAL RECONCILIATION</span>
                                        <span className="text-white">Rs. {selectedOrder.subtotal}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black text-neutral-600 uppercase tracking-widest">
                                        <span>TAXATION (16% GST)</span>
                                        <span className="text-white font-black">Rs. {selectedOrder.tax}</span>
                                    </div>
                                    <div className="h-px bg-neutral-800/50 my-4" />
                                    <div className="flex justify-between items-end">
                                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">FINAL SETTLEMENT</span>
                                        <span className="text-4xl font-black text-white tracking-tighter italic">Rs. {selectedOrder.total}</span>
                                    </div>
                                </div>

                                <div className="flex gap-6 relative z-10 pt-4">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex-1 h-20 rounded-[2rem] bg-neutral-900 text-neutral-500 font-black text-[10px] uppercase tracking-[0.2em] border border-neutral-800 hover:text-white transition-all shadow-xl"
                                        onClick={() => setSelectedOrder(null)}
                                    >
                                        DISMISS
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.02, backgroundColor: '#ea580c' }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex-1 h-20 rounded-[2rem] bg-orange-600 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-orange-600/20 flex items-center justify-center gap-3 border border-orange-400/20"
                                    >
                                        PRINT PAYLOAD <Printer className="w-5 h-5" />
                                    </motion.button>
                                </div>
                            </div>
                        </Modal>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}
