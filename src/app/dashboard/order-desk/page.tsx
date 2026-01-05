'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Phone,
    Globe,
    MessageCircle,
    Clock,
    CheckCircle2,
    ChefHat,
    Truck,
    MapPin,
    Search,
    Plus,
    ArrowRight,
    Users,
    DollarSign,
    Package,
    Timer,
    Zap,
    PhoneCall,
    Send,
    Navigation,
    Filter
} from 'lucide-react'
import { Card, Button, Badge, Modal, LoadingSpinner } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAllOrders } from '@/hooks/useRealtimeOrders'
import type { Order, OrderStatus } from '@/types'

// Order source types for the unified desk
type OrderSource = 'website' | 'call' | 'whatsapp' | 'walkin'

const sourceConfig: Record<OrderSource, { label: string; icon: any; color: string; bg: string }> = {
    website: { label: 'Website', icon: Globe, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    call: { label: 'Phone Call', icon: Phone, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
    walkin: { label: 'Walk-in', icon: Users, color: 'text-orange-500', bg: 'bg-orange-500/10' },
}

// Extended order status for delivery flow
type DeliveryStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'dispatched' | 'delivered'

const deliveryStatusConfig: Record<DeliveryStatus, { label: string; color: string; bg: string; next?: DeliveryStatus }> = {
    new: { label: 'NEW ORDER', color: 'text-rose-500', bg: 'bg-rose-500/10', next: 'confirmed' },
    confirmed: { label: 'CONFIRMED', color: 'text-blue-500', bg: 'bg-blue-500/10', next: 'preparing' },
    preparing: { label: 'IN KITCHEN', color: 'text-orange-500', bg: 'bg-orange-500/10', next: 'ready' },
    ready: { label: 'READY', color: 'text-emerald-500', bg: 'bg-emerald-500/10', next: 'dispatched' },
    dispatched: { label: 'OUT FOR DELIVERY', color: 'text-purple-500', bg: 'bg-purple-500/10', next: 'delivered' },
    delivered: { label: 'DELIVERED', color: 'text-neutral-500', bg: 'bg-neutral-800' },
}

// Extended order type with delivery properties
type ExtendedOrder = Order & {
    source: OrderSource
    deliveryStatus: DeliveryStatus
    isDelivery: boolean
    customerPhone: string
    customerAddress: string
    estimatedTime: string
}

export default function OrderDeskPage() {
    const { restaurant } = useAuthStore()
    const { orders: realtimeOrders, isLoading } = useAllOrders()
    const { success, error: showError } = useToast()
    const [activeFilter, setActiveFilter] = useState<'all' | 'delivery' | 'dine-in'>('all')
    const [sourceFilter, setSourceFilter] = useState<OrderSource | 'all'>('all')
    const [selectedOrder, setSelectedOrder] = useState<ExtendedOrder | null>(null)
    const [showNewOrderModal, setShowNewOrderModal] = useState(false)

    // Simulate delivery orders (in production, this would come from DB)
    const ordersWithDelivery = useMemo(() => {
        return realtimeOrders.map(order => ({
            ...order,
            source: (['website', 'call', 'whatsapp', 'walkin'] as OrderSource[])[Math.floor(Math.random() * 4)],
            deliveryStatus: order.status === 'pending' ? 'new' as DeliveryStatus :
                order.status === 'preparing' ? 'preparing' as DeliveryStatus :
                    order.status === 'ready' ? 'ready' as DeliveryStatus : 'confirmed' as DeliveryStatus,
            isDelivery: Math.random() > 0.5,
            customerPhone: '+92 300 ' + Math.floor(1000000 + Math.random() * 9000000),
            customerAddress: 'Block 5, Clifton, Karachi',
            estimatedTime: Math.floor(15 + Math.random() * 30) + ' min',
        }))
    }, [realtimeOrders])

    const filteredOrders = ordersWithDelivery.filter(order => {
        if (activeFilter === 'delivery' && !order.isDelivery) return false
        if (activeFilter === 'dine-in' && order.isDelivery) return false
        if (sourceFilter !== 'all' && order.source !== sourceFilter) return false
        return true
    })

    // Stats
    const stats = {
        total: ordersWithDelivery.length,
        new: ordersWithDelivery.filter(o => o.deliveryStatus === 'new').length,
        inKitchen: ordersWithDelivery.filter(o => o.deliveryStatus === 'preparing').length,
        outForDelivery: ordersWithDelivery.filter(o => o.deliveryStatus === 'dispatched').length,
        delivery: ordersWithDelivery.filter(o => o.isDelivery).length,
    }

    const updateDeliveryStatus = async (orderId: string, newStatus: DeliveryStatus) => {
        // Map delivery status to order status
        const statusMap: Record<DeliveryStatus, OrderStatus> = {
            new: 'pending',
            confirmed: 'pending',
            preparing: 'preparing',
            ready: 'ready',
            dispatched: 'ready',
            delivered: 'paid',
        }

        const supabase = createClient()
        const { error } = await supabase
            .from('orders')
            .update({ status: statusMap[newStatus] })
            .eq('id', orderId)

        if (error) {
            showError('Error', 'Failed to update order')
        } else {
            success('Status Updated', `Order moved to ${deliveryStatusConfig[newStatus].label}`)
            setSelectedOrder(null)
        }
    }

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
    }

    const itemVariant = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
    }

    const getTimeAgo = (date: string) => {
        const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
        if (mins < 1) return 'Just now'
        if (mins < 60) return `${mins}m ago`
        return `${Math.floor(mins / 60)}h ${mins % 60}m`
    }

    return (
        <div className="relative min-h-screen">
            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <motion.div
                    animate={{
                        x: [0, 50, 0],
                        y: [0, 100, 0],
                        scale: [1, 1.2, 1]
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-rose-600/10 blur-[130px] rounded-full"
                />
                <motion.div
                    animate={{
                        x: [0, -80, 0],
                        y: [0, 60, 0],
                        scale: [1.2, 1, 1.2]
                    }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-orange-600/10 blur-[130px] rounded-full"
                />
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="px-2 lg:px-4 space-y-10 pb-32 relative z-10"
            >
                {/* Command Center Header */}
                <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-10 pt-4">
                    <div className="space-y-6">
                        <motion.div variants={itemVariant} className="flex items-center gap-4">
                            <div className="px-5 py-2 rounded-2xl bg-orange-600/10 border border-orange-500/20 backdrop-blur-md shadow-xl">
                                <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">COMMAND CENTER ACTIVE</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/40 border border-neutral-800/50 backdrop-blur-md">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">LIVE SYNC</span>
                            </div>
                        </motion.div>

                        <div className="space-y-1">
                            <motion.h1 variants={itemVariant} className="text-5xl lg:text-7xl font-black text-white tracking-tight leading-[0.9] uppercase">
                                ORDER <span className="text-transparent bg-clip-text bg-gradient-to-tr from-orange-600 via-rose-500 to-orange-400">DESK</span>
                            </motion.h1>
                            <motion.p variants={itemVariant} className="text-neutral-500 text-lg font-medium max-w-2xl leading-relaxed">
                                INDUSTRIAL-GRADE ORDER CONTROL. MONITOR REAL-TIME INTAKE ACROSS WEBSITE, CALLS, AND WALK-INS.
                            </motion.p>
                        </div>
                    </div>

                    <motion.div variants={itemVariant} className="flex items-center gap-4">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowNewOrderModal(true)}
                            className="h-20 px-10 bg-neutral-900 border border-neutral-800 rounded-[2rem] text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] shadow-2xl hover:text-white hover:border-orange-500/50 transition-all flex items-center justify-center gap-4 relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <PhoneCall className="w-5 h-5" />
                            LOG CALL ORDER
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowNewOrderModal(true)}
                            className="h-20 px-12 bg-orange-600 rounded-[2rem] text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(234,88,12,0.3)] flex items-center justify-center gap-4 relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                            FORCE NEW ORDER
                        </motion.button>
                    </motion.div>
                </div>

                {/* Live Stats Bar */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                    {[
                        { label: 'Active Load', value: stats.total, icon: Package, color: 'from-orange-600/20 to-orange-600/5', iconColor: 'text-white' },
                        { label: 'New Entries', value: stats.new, icon: Clock, color: 'from-rose-600/20 to-rose-600/5', iconColor: 'text-rose-500' },
                        { label: 'Kitchen Load', value: stats.inKitchen, icon: ChefHat, color: 'from-amber-600/20 to-amber-600/5', iconColor: 'text-amber-500' },
                        { label: 'Dispatch Queue', value: stats.outForDelivery, icon: Truck, color: 'from-purple-600/20 to-purple-600/5', iconColor: 'text-purple-500' },
                        { label: 'Logistics', value: stats.delivery, icon: Navigation, color: 'from-emerald-600/20 to-emerald-600/5', iconColor: 'text-emerald-500' },
                    ].map((stat, idx) => (
                        <motion.div key={idx} variants={itemVariant} className="group">
                            <div className="relative h-full p-8 rounded-[2.5rem] bg-neutral-900/40 backdrop-blur-3xl border border-neutral-800/50 overflow-hidden transition-all duration-500 hover:border-orange-500/30 shadow-2xl">
                                {/* Internal Glow */}
                                <div className={cn("absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700", stat.color)} />

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="w-12 h-12 rounded-2xl bg-black/40 border border-neutral-800/50 flex items-center justify-center text-neutral-400 group-hover:text-white group-hover:border-orange-500/50 transition-all duration-500 shadow-inner">
                                            <stat.icon className={cn("w-6 h-6", stat.iconColor)} />
                                        </div>
                                    </div>

                                    <div className="mt-auto">
                                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                                        <h3 className="text-4xl font-black text-white tracking-tighter leading-none">{stat.value}</h3>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Filter Bar */}
                <motion.div variants={itemVariant}>
                    <div className="p-8 bg-neutral-900/40 backdrop-blur-3xl border border-neutral-800/50 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                        <div className="flex flex-col lg:flex-row gap-8 items-center relative z-10">
                            <div className="flex items-center gap-4 mr-4">
                                <div className="p-3 rounded-xl bg-orange-600/10 border border-orange-500/20">
                                    <Filter className="w-5 h-5 text-orange-600" />
                                </div>
                                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Lifecycle Filter</span>
                            </div>

                            <div className="flex flex-wrap gap-3 p-2 bg-black/20 rounded-[1.5rem] border border-neutral-800/50">
                                {(['all', 'delivery', 'dine-in'] as const).map(filter => (
                                    <motion.button
                                        key={filter}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setActiveFilter(filter)}
                                        className={cn(
                                            "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 border relative overflow-hidden group/btn",
                                            activeFilter === filter
                                                ? 'bg-white text-black border-white shadow-lg'
                                                : 'bg-transparent border-neutral-800/50 text-neutral-500 hover:border-neutral-700 hover:text-white'
                                        )}
                                    >
                                        <span className="relative z-10">{filter === 'all' ? 'Unified View' : filter}</span>
                                        {activeFilter === filter && (
                                            <motion.div layoutId="activeTag" className="absolute inset-0 bg-gradient-to-r from-neutral-100 to-transparent opacity-10" />
                                        )}
                                    </motion.button>
                                ))}
                            </div>

                            <div className="hidden lg:block h-10 w-[1px] bg-neutral-800/50 mx-4" />

                            <div className="flex flex-wrap gap-2">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setSourceFilter('all')}
                                    className={cn(
                                        "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 border",
                                        sourceFilter === 'all'
                                            ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20'
                                            : 'bg-transparent border-neutral-800/50 text-neutral-500 hover:border-neutral-700'
                                    )}
                                >
                                    All Sources
                                </motion.button>
                                {Object.entries(sourceConfig).map(([key, cfg]) => (
                                    <motion.button
                                        key={key}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setSourceFilter(key as OrderSource)}
                                        className={cn(
                                            "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 border flex items-center gap-3",
                                            sourceFilter === key
                                                ? `${cfg.bg} ${cfg.color} border-current shadow-lg`
                                                : 'bg-transparent border-neutral-800/50 text-neutral-500 hover:border-neutral-700'
                                        )}
                                    >
                                        <cfg.icon className="w-4 h-4" />
                                        {cfg.label}
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Order Cards Grid */}
                {isLoading ? (
                    <div className="flex justify-center py-20"><LoadingSpinner /></div>
                ) : filteredOrders.length === 0 ? (
                    <Card className="p-20 bg-neutral-900/30 border-neutral-800/50 text-center rounded-[2rem] border-dashed">
                        <Package className="w-16 h-16 text-neutral-800 mx-auto mb-6" />
                        <h3 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">No Orders</h3>
                        <p className="text-neutral-500 text-lg max-w-sm mx-auto leading-relaxed">
                            Waiting for incoming orders from website, phone, or walk-ins.
                        </p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {filteredOrders.map((order) => {
                            const statusCfg = deliveryStatusConfig[order.deliveryStatus]
                            const sourceCfg = sourceConfig[order.source]

                            return (
                                <motion.div key={order.id} variants={itemVariant} layout>
                                    <div
                                        className={cn(
                                            "group relative p-0 bg-neutral-900/40 backdrop-blur-3xl border border-neutral-800/50 hover:border-orange-500/30 transition-all duration-500 rounded-[2.5rem] overflow-hidden cursor-pointer shadow-2xl",
                                            order.deliveryStatus === 'new' && 'border-rose-500/30'
                                        )}
                                        onClick={() => setSelectedOrder(order)}
                                    >
                                        {/* Status Glow */}
                                        <div className={cn(
                                            "absolute -top-20 -right-20 w-40 h-40 blur-[60px] opacity-0 group-hover:opacity-20 transition-opacity duration-700",
                                            statusCfg.bg
                                        )} />

                                        {/* Header */}
                                        <div className="p-8 border-b border-neutral-800/50 flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner", sourceCfg.bg)}>
                                                    <sourceCfg.icon className={cn("w-6 h-6", sourceCfg.color)} />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-white text-xl tracking-tighter">#{order.order_number}</h3>
                                                    <p className="text-[9px] font-black text-neutral-600 uppercase tracking-[0.2em]">{sourceCfg.label}</p>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border",
                                                statusCfg.bg, statusCfg.color, "border-current/20"
                                            )}>
                                                {statusCfg.label}
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="p-8 space-y-6 relative z-10">
                                            {order.isDelivery && (
                                                <div className="p-5 bg-black/40 rounded-2xl border border-neutral-800/50 shadow-inner group/addr hover:border-orange-500/20 transition-all">
                                                    <div className="flex items-start gap-4">
                                                        <MapPin className="w-5 h-5 text-orange-600 mt-1" />
                                                        <div className="flex-1">
                                                            <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] block mb-2">Payload Destination</span>
                                                            <p className="text-sm text-white font-black tracking-tight leading-tight">{order.customerAddress}</p>
                                                            <p className="text-[10px] font-black text-neutral-500 mt-2 tracking-widest">{order.customerPhone}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between px-2">
                                                <div className="flex items-center gap-3 group/item">
                                                    <div className="w-8 h-8 rounded-lg bg-neutral-800/50 flex items-center justify-center group-hover/item:bg-orange-600/20 transition-colors">
                                                        <Package className="w-4 h-4 text-neutral-500 group-hover/item:text-orange-500" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm text-white font-black tracking-tighter">{order.items?.length || 0}</span>
                                                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Inventory</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 group/timer">
                                                    <div className="w-8 h-8 rounded-lg bg-neutral-800/50 flex items-center justify-center group-hover/timer:bg-emerald-600/20 transition-colors">
                                                        <Timer className="w-4 h-4 text-neutral-500 group-hover/timer:text-emerald-500" />
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-sm text-white font-black tracking-tighter">{order.estimatedTime}</span>
                                                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Eta Target</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="p-8 bg-black/40 border-t border-neutral-800/50 flex items-center justify-between relative z-10">
                                            <div>
                                                <span className="text-[9px] font-black text-neutral-600 uppercase tracking-[0.3em] block mb-1">Total Revenue</span>
                                                <p className="text-2xl font-black text-white tracking-tighter italic">Rs. {order.total?.toLocaleString()}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
                                                    <span className="text-[10px] font-black text-white tracking-widest">{getTimeAgo(order.created_at)}</span>
                                                </div>
                                                <span className="text-[8px] font-black text-neutral-700 uppercase tracking-widest">since intake</span>
                                            </div>
                                        </div>

                                        {/* New Pulse Effect */}
                                        {order.deliveryStatus === 'new' && (
                                            <div className="absolute inset-0 border-2 border-rose-500/50 rounded-[2.5rem] animate-ping" />
                                        )}
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                )}

                {/* Order Detail Modal */}
                <Modal
                    isOpen={!!selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    title={`PAYLOAD REPORT #${selectedOrder?.order_number}`}
                    size="lg"
                >
                    {selectedOrder && (
                        <div className="space-y-10 p-2">
                            {/* Status Timeline */}
                            <div className="relative p-8 bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                <div className="flex items-center justify-between relative z-10">
                                    {Object.entries(deliveryStatusConfig).slice(0, 5).map(([key, cfg], idx) => {
                                        const steps = Object.keys(deliveryStatusConfig)
                                        const currentIdx = steps.indexOf(selectedOrder.deliveryStatus)
                                        const isActive = currentIdx >= idx
                                        const isCurrent = selectedOrder.deliveryStatus === key

                                        return (
                                            <div key={key} className="flex flex-col items-center gap-4 relative">
                                                {/* Connecting Line */}
                                                {idx < 4 && (
                                                    <div className={cn(
                                                        "absolute left-[calc(100%+0.5rem)] top-5 w-[calc(100%-1rem)] xl:w-[calc(150%-1rem)] h-[2px] hidden md:block",
                                                        currentIdx > idx ? 'bg-orange-600' : 'bg-neutral-800'
                                                    )} />
                                                )}

                                                <div className={cn(
                                                    "w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 shadow-xl relative z-10",
                                                    isActive ? `${cfg.bg} ${cfg.color} border-current ring-4 ring-current/10` : 'bg-black border-neutral-800 text-neutral-700',
                                                    isCurrent && 'scale-110 shadow-[0_0_30px_rgba(234,88,12,0.2)]'
                                                )}>
                                                    <div className={cn("w-2 h-2 rounded-full", isActive ? 'bg-current' : 'bg-neutral-800')} />
                                                </div>
                                                <p className={cn(
                                                    "text-[8px] font-black uppercase tracking-[0.2em] text-center w-20",
                                                    isActive ? cfg.color : 'text-neutral-700'
                                                )}>
                                                    {cfg.label}
                                                </p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Customer Info */}
                            {(selectedOrder as any).isDelivery && (
                                <div className="p-8 bg-black/40 rounded-[2.5rem] border border-neutral-800/50 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Payload Consignee</h4>
                                        <Badge className="bg-orange-600/10 text-orange-600 border-orange-600/20 px-3 font-black text-[9px]">ACTIVE DISPATCH</Badge>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="flex items-center gap-4 p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800/50 group/phone">
                                            <div className="w-10 h-10 rounded-xl bg-orange-600/10 flex items-center justify-center text-orange-600 group-hover/phone:scale-110 transition-transform">
                                                <Phone className="w-5 h-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Contact Hash</span>
                                                <span className="text-white font-black tracking-tight italic">{(selectedOrder as any).customerPhone}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800/50 group/addr">
                                            <div className="w-10 h-10 rounded-xl bg-orange-600/10 flex items-center justify-center text-orange-600 group-hover/addr:scale-110 transition-transform">
                                                <Navigation className="w-5 h-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Drop Point</span>
                                                <span className="text-white font-black tracking-tight leading-tight">{(selectedOrder as any).customerAddress}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Order Items */}
                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Inventory Audit</h4>
                                <div className="space-y-3">
                                    {(selectedOrder.items || []).map((item, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="flex justify-between items-center p-6 bg-neutral-900/40 backdrop-blur-3xl rounded-[1.5rem] border border-neutral-800/50 group hover:border-orange-500/30 transition-all"
                                        >
                                            <div className="flex items-center gap-6">
                                                <div className="w-12 h-12 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <span className="text-xs font-black text-orange-500 relative z-10">x{item.quantity}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-white text-lg tracking-tighter uppercase">{item.menu_item?.name || 'Standard Item'}</span>
                                                    <span className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.2em]">Item Code: {Math.random().toString(36).substring(7).toUpperCase()}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest mb-1 font-mono text-zinc-500">Subtotal P/U</p>
                                                <span className="font-black text-white text-lg tracking-tighter italic">Rs. {item.subtotal}</span>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Grand Total */}
                            <div className="relative p-10 rounded-[3rem] bg-gradient-to-br from-orange-600 to-rose-700 border border-orange-500/30 shadow-[0_30px_60px_rgba(234,88,12,0.2)] overflow-hidden group">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
                                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 blur-[80px] rounded-full group-hover:scale-150 transition-transform duration-1000" />

                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                                    <div className="text-center md:text-left">
                                        <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.5em] block mb-2">Total Settlement Val</span>
                                        <h3 className="text-lg font-black text-white uppercase tracking-tighter">Gross Payload Amount</h3>
                                    </div>
                                    <div className="flex flex-col items-center md:items-end">
                                        <span className="text-5xl font-black text-white tracking-tighter italic drop-shadow-2xl">Rs. {selectedOrder.total?.toLocaleString()}</span>
                                        <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] mt-2">inclusive of tax & surcharges</span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col md:flex-row gap-4">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="h-20 flex-1 rounded-[2rem] bg-neutral-900 border border-neutral-800 text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] hover:text-white hover:border-neutral-600 transition-all shadow-xl font-mono"
                                    onClick={() => setSelectedOrder(null)}
                                >
                                    Dismiss Report
                                </motion.button>
                                {selectedOrder.deliveryStatus && deliveryStatusConfig[selectedOrder.deliveryStatus]?.next && (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="h-20 flex-[1.5] rounded-[2rem] bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-white/5 flex items-center justify-center gap-4 relative overflow-hidden group"
                                        onClick={() => updateDeliveryStatus(
                                            selectedOrder.id,
                                            deliveryStatusConfig[selectedOrder.deliveryStatus].next!
                                        )}
                                    >
                                        Proceed to {deliveryStatusConfig[deliveryStatusConfig[selectedOrder.deliveryStatus].next!].label}
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-500" />
                                    </motion.button>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>

                {/* New Order Modal Placeholder */}
                <Modal
                    isOpen={showNewOrderModal}
                    onClose={() => setShowNewOrderModal(false)}
                    title="ESTABLISH NEW PAYLOAD"
                    size="lg"
                >
                    <div className="p-12 text-center space-y-10">
                        <div className="relative w-32 h-32 mx-auto">
                            <div className="absolute inset-0 bg-orange-600/20 blur-3xl rounded-full animate-pulse" />
                            <div className="relative w-32 h-32 rounded-[2.5rem] bg-neutral-900 border border-neutral-800 flex items-center justify-center shadow-2xl">
                                <Zap className="w-12 h-12 text-orange-600" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-3xl font-black text-white tracking-tighter uppercase">Station Restricted</h3>
                            <p className="text-neutral-500 text-lg font-medium max-w-sm mx-auto leading-relaxed">
                                Manual order creation and station override protocols are currently being established for this terminal.
                            </p>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowNewOrderModal(false)}
                            className="h-16 px-12 rounded-2xl border border-neutral-800 text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] hover:text-white hover:border-neutral-600 transition-all"
                        >
                            Return to Desk
                        </motion.button>
                    </div>
                </Modal>
            </motion.div>
        </div>
    )
}
