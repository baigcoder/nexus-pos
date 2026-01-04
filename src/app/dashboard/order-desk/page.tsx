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
        <div className="min-h-screen pb-20">
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-10">

                {/* Command Center Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <motion.div variants={itemVariant} className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-xl shadow-orange-600/30">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <Badge variant="outline" className="border-orange-600/20 text-orange-600 bg-orange-600/5 px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                                COMMAND CENTER
                            </Badge>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </motion.div>
                        <motion.h1 variants={itemVariant} className="text-4xl lg:text-6xl font-display font-bold text-white tracking-tight uppercase">
                            Order <span className="text-orange-600">Desk</span>
                        </motion.h1>
                        <motion.p variants={itemVariant} className="text-neutral-500 text-lg font-medium max-w-xl">
                            Unified order intake and dispatch control. Manage website, phone, and walk-in orders in one place.
                        </motion.p>
                    </div>

                    <motion.div variants={itemVariant} className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowNewOrderModal(true)}
                            className="h-16 px-8 border-neutral-800 text-neutral-400 hover:border-white hover:text-white rounded-2xl font-bold uppercase tracking-widest text-xs transition-all"
                        >
                            <PhoneCall className="w-5 h-5 mr-3" />
                            Log Call Order
                        </Button>
                        <Button
                            onClick={() => setShowNewOrderModal(true)}
                            className="h-16 px-10 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-2xl shadow-orange-600/20 group transition-all"
                        >
                            <Plus className="w-5 h-5 mr-3 group-hover:rotate-90 transition-transform duration-300" />
                            New Order
                        </Button>
                    </motion.div>
                </div>

                {/* Live Stats Bar */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {[
                        { label: 'Active Orders', value: stats.total, icon: Package, color: 'text-white', glow: '' },
                        { label: 'New Orders', value: stats.new, icon: Clock, color: 'text-rose-500', glow: 'shadow-rose-500/10' },
                        { label: 'In Kitchen', value: stats.inKitchen, icon: ChefHat, color: 'text-orange-500', glow: 'shadow-orange-500/10' },
                        { label: 'Out for Delivery', value: stats.outForDelivery, icon: Truck, color: 'text-purple-500', glow: 'shadow-purple-500/10' },
                        { label: 'Delivery Orders', value: stats.delivery, icon: Navigation, color: 'text-emerald-500', glow: 'shadow-emerald-500/10' },
                    ].map((stat, idx) => (
                        <motion.div key={idx} variants={itemVariant}>
                            <Card className={cn(
                                "group p-5 bg-neutral-950 border-neutral-900 hover:border-neutral-800 transition-all rounded-2xl",
                                stat.glow
                            )}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-black border border-neutral-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <stat.icon className={cn("w-5 h-5", stat.color)} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">{stat.label}</p>
                                        <h3 className="text-2xl font-black text-white">{stat.value}</h3>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Filter Bar */}
                <motion.div variants={itemVariant} className="flex flex-wrap items-center gap-4 p-5 bg-neutral-950/50 backdrop-blur-xl rounded-2xl border border-neutral-900">
                    <div className="flex items-center gap-2 mr-4">
                        <Filter className="w-4 h-4 text-orange-600" />
                        <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Filter</span>
                    </div>

                    {/* Order Type Filter */}
                    <div className="flex gap-2">
                        {(['all', 'delivery', 'dine-in'] as const).map(filter => (
                            <button
                                key={filter}
                                onClick={() => setActiveFilter(filter)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                    activeFilter === filter
                                        ? 'bg-white text-black border-white'
                                        : 'bg-black border-neutral-800 text-neutral-500 hover:border-neutral-700'
                                )}
                            >
                                {filter === 'all' ? 'All Orders' : filter}
                            </button>
                        ))}
                    </div>

                    <div className="h-6 w-[1px] bg-neutral-800 mx-2" />

                    {/* Source Filter */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSourceFilter('all')}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                sourceFilter === 'all'
                                    ? 'bg-orange-600 text-white border-orange-600'
                                    : 'bg-black border-neutral-800 text-neutral-500 hover:border-neutral-700'
                            )}
                        >
                            All Sources
                        </button>
                        {Object.entries(sourceConfig).map(([key, cfg]) => (
                            <button
                                key={key}
                                onClick={() => setSourceFilter(key as OrderSource)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center gap-2",
                                    sourceFilter === key
                                        ? `${cfg.bg} ${cfg.color} border-current`
                                        : 'bg-black border-neutral-800 text-neutral-500 hover:border-neutral-700'
                                )}
                            >
                                <cfg.icon className="w-3 h-3" />
                                {cfg.label}
                            </button>
                        ))}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredOrders.map((order) => {
                            const statusCfg = deliveryStatusConfig[order.deliveryStatus]
                            const sourceCfg = sourceConfig[order.source]

                            return (
                                <motion.div key={order.id} variants={itemVariant} layout>
                                    <Card
                                        className={cn(
                                            "group p-0 bg-neutral-950 border-neutral-900 hover:border-neutral-800 transition-all rounded-[2rem] overflow-hidden cursor-pointer",
                                            order.deliveryStatus === 'new' && 'border-rose-500/30 animate-pulse'
                                        )}
                                        onClick={() => setSelectedOrder(order)}
                                    >
                                        {/* Header */}
                                        <div className="p-6 border-b border-neutral-900 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", sourceCfg.bg)}>
                                                    <sourceCfg.icon className={cn("w-5 h-5", sourceCfg.color)} />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-white text-lg">#{order.order_number}</h3>
                                                    <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">{sourceCfg.label}</p>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest",
                                                statusCfg.bg, statusCfg.color
                                            )}>
                                                {statusCfg.label}
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="p-6 space-y-4">
                                            {order.isDelivery && (
                                                <div className="flex items-start gap-3 p-4 bg-black/40 rounded-xl border border-neutral-900">
                                                    <MapPin className="w-4 h-4 text-orange-600 mt-0.5" />
                                                    <div>
                                                        <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Delivery Address</p>
                                                        <p className="text-sm text-white font-medium">{order.customerAddress}</p>
                                                        <p className="text-xs text-neutral-500 mt-1">{order.customerPhone}</p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Package className="w-4 h-4 text-neutral-600" />
                                                    <span className="text-sm text-neutral-400 font-medium">{order.items?.length || 0} items</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Timer className="w-4 h-4 text-neutral-600" />
                                                    <span className="text-sm text-neutral-400 font-medium">{order.estimatedTime}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="p-6 bg-black/20 border-t border-neutral-900 flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Total</p>
                                                <p className="text-xl font-black text-white">Rs. {order.total?.toLocaleString()}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3 h-3 text-neutral-600" />
                                                <span className="text-[10px] font-bold text-neutral-500">{getTimeAgo(order.created_at)}</span>
                                            </div>
                                        </div>
                                    </Card>
                                </motion.div>
                            )
                        })}
                    </div>
                )}

                {/* Order Detail Modal */}
                <Modal
                    isOpen={!!selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    title={`ORDER #${selectedOrder?.order_number}`}
                    size="lg"
                >
                    {selectedOrder && (
                        <div className="space-y-8 p-2">
                            {/* Status Timeline */}
                            <div className="flex items-center justify-between p-6 bg-black rounded-2xl border border-neutral-900">
                                {Object.entries(deliveryStatusConfig).slice(0, 5).map(([key, cfg], idx) => {
                                    const isActive = Object.keys(deliveryStatusConfig).indexOf(selectedOrder.deliveryStatus) >= idx
                                    const isCurrent = selectedOrder.deliveryStatus === key
                                    return (
                                        <div key={key} className="flex flex-col items-center gap-2">
                                            <div className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                                                isActive ? `${cfg.bg} ${cfg.color} border-current` : 'bg-neutral-900 border-neutral-800 text-neutral-700',
                                                isCurrent && 'ring-4 ring-current/20'
                                            )}>
                                                <CheckCircle2 className="w-5 h-5" />
                                            </div>
                                            <p className={cn(
                                                "text-[8px] font-bold uppercase tracking-widest text-center",
                                                isActive ? cfg.color : 'text-neutral-700'
                                            )}>
                                                {cfg.label}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Customer Info */}
                            {(selectedOrder as any).isDelivery && (
                                <div className="p-6 bg-neutral-900/50 rounded-2xl border border-neutral-800 space-y-4">
                                    <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Customer Details</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4 text-orange-600" />
                                            <span className="text-white font-medium">{(selectedOrder as any).customerPhone}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <MapPin className="w-4 h-4 text-orange-600" />
                                            <span className="text-white font-medium">{(selectedOrder as any).customerAddress}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Order Items */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Order Items</h4>
                                {(selectedOrder.items || []).map((item, i) => (
                                    <div key={i} className="flex justify-between items-center p-4 bg-black rounded-xl border border-neutral-900">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-orange-600/10 border border-orange-600/20 flex items-center justify-center">
                                                <span className="text-xs font-black text-orange-600">x{item.quantity}</span>
                                            </div>
                                            <span className="font-bold text-white">{item.menu_item?.name || 'Item'}</span>
                                        </div>
                                        <span className="font-bold text-white">Rs. {item.subtotal}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Total */}
                            <div className="flex justify-between items-center p-6 bg-orange-600/10 rounded-2xl border border-orange-600/20">
                                <span className="text-lg font-bold text-white uppercase">Grand Total</span>
                                <span className="text-3xl font-black text-orange-600">Rs. {selectedOrder.total?.toLocaleString()}</span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-4">
                                <Button
                                    variant="outline"
                                    className="flex-1 h-16 rounded-2xl border-neutral-800 text-neutral-500 font-bold uppercase tracking-widest text-xs hover:text-white"
                                    onClick={() => setSelectedOrder(null)}
                                >
                                    Close
                                </Button>
                                {selectedOrder.deliveryStatus && deliveryStatusConfig[selectedOrder.deliveryStatus]?.next && (
                                    <Button
                                        className="flex-1 h-16 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase tracking-widest text-xs shadow-xl shadow-orange-600/20 group"
                                        onClick={() => updateDeliveryStatus(
                                            selectedOrder.id,
                                            deliveryStatusConfig[selectedOrder.deliveryStatus].next!
                                        )}
                                    >
                                        Move to {deliveryStatusConfig[deliveryStatusConfig[selectedOrder.deliveryStatus].next!].label}
                                        <ArrowRight className="ml-3 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>

                {/* New Order Modal Placeholder */}
                <Modal
                    isOpen={showNewOrderModal}
                    onClose={() => setShowNewOrderModal(false)}
                    title="CREATE NEW ORDER"
                    size="lg"
                >
                    <div className="p-6 text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-orange-600/10 mx-auto flex items-center justify-center">
                            <PhoneCall className="w-10 h-10 text-orange-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white mb-2">Coming Soon</h3>
                            <p className="text-neutral-500">
                                Manual order creation for phone calls and walk-ins will be available in the next phase.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setShowNewOrderModal(false)}
                            className="h-14 px-10 rounded-2xl border-neutral-800 text-neutral-400 font-bold uppercase tracking-widest text-xs"
                        >
                            Close
                        </Button>
                    </div>
                </Modal>
            </motion.div>
        </div>
    )
}
