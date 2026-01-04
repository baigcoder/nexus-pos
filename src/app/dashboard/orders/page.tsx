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
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-12 pb-24"
        >
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pt-4">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-orange-600/10 text-orange-600 border-orange-600/20 px-3 py-1 font-bold uppercase text-[10px] tracking-widest">
                            ● Active Orders
                        </Badge>
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Today</span>
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white uppercase">
                        Order <span className="text-orange-600">History</span>
                    </h1>
                    <p className="text-neutral-500 font-medium text-lg">
                        Managing <span className="text-white font-bold">{realtimeOrders.length} orders</span> across the restaurant.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        className="h-14 px-8 border-neutral-800 text-neutral-400 font-bold text-xs uppercase tracking-widest hover:bg-white hover:text-neutral-900 hover:border-white transition-all"
                        icon={Printer}
                    >
                        Print Report
                    </Button>
                    <Link href="/dashboard/kitchen">
                        <Button className="h-14 px-10 bg-orange-600 hover:bg-orange-500 text-white shadow-lg font-bold uppercase tracking-widest text-xs border-none group">
                            Kitchen View <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {statsData.map((stat) => (
                    <motion.div key={stat.label} variants={item}>
                        <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-xl relative overflow-hidden group">
                            <div className="flex items-start justify-between relative z-10">
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">{stat.label}</p>
                                    <h3 className="text-3xl font-bold text-white tracking-tight">{stat.value}</h3>
                                    {stat.change !== 0 && (
                                        <div className="flex items-center gap-1 mt-3 text-emerald-500 font-bold text-[10px] uppercase tracking-widest">
                                            <ArrowUpRight className="w-3 h-3" />
                                            {stat.change}% Growth
                                        </div>
                                    )}
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-orange-600 group-hover:border-orange-600 transition-colors shadow-inner">
                                    <stat.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <motion.div variants={item}>
                <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-xl overflow-hidden">
                    <div className="flex flex-col lg:flex-row gap-8 items-center">
                        <div className="flex-1 w-full relative group">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-orange-600 transition-colors" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by Order # or Table Name..."
                                className="w-full bg-black border border-neutral-800 rounded-xl pl-14 pr-6 py-4 text-xs font-bold uppercase tracking-widest outline-none focus:border-orange-600 transition-all text-white placeholder:text-neutral-700 shadow-inner"
                            />
                        </div>
                        <div className="flex gap-2 flex-wrap justify-center">
                            {(['all', 'pending', 'preparing', 'ready', 'served', 'paid'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={cn(
                                        'px-5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border',
                                        statusFilter === status
                                            ? 'bg-white text-black border-white shadow-lg scale-105'
                                            : 'bg-black text-neutral-500 border-neutral-800 hover:border-orange-600/50 hover:text-white'
                                    )}
                                >
                                    {status === 'all' ? 'All Orders' : statusConfig[status].label}
                                </button>
                            ))}
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* Orders List */}
            <motion.div variants={item}>
                <Card className="p-0 overflow-hidden bg-neutral-900 border-neutral-800 shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-black/40 text-neutral-500 font-bold text-[10px] uppercase tracking-widest">
                                    <th className="px-8 py-5 text-left">Order ID</th>
                                    <th className="px-8 py-5 text-left">Table</th>
                                    <th className="px-8 py-5 text-left">Items</th>
                                    <th className="px-8 py-5 text-left">Total</th>
                                    <th className="px-8 py-5 text-center">Status</th>
                                    <th className="px-8 py-5 text-center">Time</th>
                                    <th className="px-8 py-5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800/50">
                                {filteredOrders.map((order) => {
                                    const cfg = statusConfig[order.status]
                                    return (
                                        <tr key={order.id} className="hover:bg-white/[0.02] transition-all">
                                            <td className="px-8 py-6 font-bold text-neutral-400 group-hover:text-orange-600 transition-colors">
                                                #{order.order_number}
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-black border border-neutral-800 text-white flex items-center justify-center font-bold text-[10px] group-hover:border-orange-600 transition-colors">
                                                        {order.table?.table_number || '?'}
                                                    </div>
                                                    <span className="font-bold text-white text-sm">Table {order.table?.table_number || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-neutral-500 font-bold text-xs">{order.items?.length || 0} items</td>
                                            <td className="px-8 py-6 font-bold text-white">Rs. {order.total.toLocaleString()}</td>
                                            <td className="px-8 py-6 text-center">
                                                <Badge
                                                    className={cn(
                                                        "font-bold text-[9px] px-3 py-1 rounded-md uppercase tracking-widest border-none shadow-md",
                                                        order.status === 'pending' ? 'bg-rose-500/20 text-rose-500' :
                                                            order.status === 'preparing' ? 'bg-orange-500/20 text-orange-500' :
                                                                order.status === 'ready' ? 'bg-emerald-500/20 text-emerald-500' :
                                                                    'bg-neutral-800 text-neutral-400'
                                                    )}
                                                >
                                                    {cfg.label}
                                                </Badge>
                                            </td>
                                            <td className="px-8 py-6 text-center text-[10px] font-bold text-neutral-500 uppercase">{getTimeAgo(order.created_at)}</td>
                                            <td className="px-8 py-6 text-right">
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="h-9 px-4 bg-black border border-neutral-800 rounded-lg text-[10px] font-bold text-neutral-400 uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center gap-2 ml-auto"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </motion.div>

            {/* Order Detail Modal */}
            <AnimatePresence>
                {selectedOrder && (
                    <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Order Summary: #${selectedOrder.order_number}`} size="lg">
                        <div className="space-y-8 py-4 bg-black">
                            <div className="flex items-center justify-between pb-8 border-b border-neutral-900">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 text-orange-600 flex items-center justify-center font-bold text-xl shadow-inner">
                                        {selectedOrder.table?.table_number || '?'}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Location</p>
                                        <h3 className="text-2xl font-bold text-white tracking-tight">Table {selectedOrder.table?.table_number || 'N/A'}</h3>
                                    </div>
                                </div>
                                <Badge
                                    className={cn(
                                        "font-bold text-[10px] px-4 py-2 rounded-lg tracking-widest border-none text-white",
                                        selectedOrder.status === 'preparing' ? 'bg-orange-600' : 'bg-emerald-600'
                                    )}
                                >
                                    {statusConfig[selectedOrder.status].label}
                                </Badge>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-4">Order Details</h4>
                                {(selectedOrder.items || []).map((item, i) => (
                                    <div key={i} className="flex justify-between items-center p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl group hover:border-orange-600 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-7 h-7 rounded-md bg-black border border-neutral-800 flex items-center justify-center">
                                                <span className="text-[10px] font-bold text-orange-600">x{item.quantity}</span>
                                            </div>
                                            <span className="font-bold text-white text-sm">{item.menu_item?.name || 'Item'}</span>
                                        </div>
                                        <span className="font-bold text-white text-sm">Rs. {item.subtotal || 0}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-8 border-t border-neutral-900 space-y-3">
                                <div className="flex justify-between text-[11px] font-bold text-neutral-500 uppercase">
                                    <span>Subtotal</span><span>Rs. {selectedOrder.subtotal}</span>
                                </div>
                                <div className="flex justify-between text-[11px] font-bold text-neutral-500 uppercase">
                                    <span>Tax (16%)</span><span>Rs. {selectedOrder.tax}</span>
                                </div>
                                <div className="flex justify-between text-3xl font-bold text-white pt-6 border-t border-neutral-900">
                                    <span>TOTAL</span><span className="text-orange-600">Rs. {selectedOrder.total}</span>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-8">
                                <Button
                                    variant="outline"
                                    className="flex-1 h-16 border-neutral-800 text-neutral-500 font-bold uppercase tracking-widest text-xs hover:border-white hover:text-white transition-all"
                                    onClick={() => setSelectedOrder(null)}
                                >
                                    Close
                                </Button>
                                <Button
                                    className="flex-1 h-16 bg-white text-black hover:bg-orange-600 hover:text-white uppercase font-bold tracking-widest text-xs border-none shadow-xl transition-all"
                                    icon={Printer}
                                >
                                    Print Receipt
                                </Button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
