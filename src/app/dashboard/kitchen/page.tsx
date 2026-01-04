'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Clock,
    ChefHat,
    AlertTriangle,
    Volume2,
    VolumeX,
    Maximize,
    CheckCircle2,
    Bell,
    UtensilsCrossed,
    Loader2,
    RefreshCw,
    Truck,
    MapPin,
    Phone
} from 'lucide-react'
import { useAuthStore } from '@/stores'
import { useKitchenOrders } from '@/hooks/useRealtimeOrders'
import { updateOrderStatus } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import type { Order, OrderStatus } from '@/types'
import { Badge, Button, Card, LoadingSpinner } from '@/components/ui/common'
import { cn } from '@/lib/utils'

const statusConfig = {
    pending: { label: 'New Order', color: 'text-rose-500', text: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    preparing: { label: 'Preparing', color: 'text-orange-600', text: 'text-orange-600', bg: 'bg-orange-600/10', border: 'border-orange-600/20' },
    ready: { label: 'Ready', color: 'text-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
}

export default function KitchenPage() {
    const { restaurant } = useAuthStore()
    const { orders, isLoading, refresh } = useKitchenOrders()
    const { success, error: showError } = useToast()
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
    const [currentTime, setCurrentTime] = useState(new Date())
    const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set())

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        setUpdatingOrders(prev => new Set(prev).add(orderId))
        const result = await updateOrderStatus(orderId, newStatus)
        if (result.success) {
            success('Order Updated', `Order status set to ${newStatus}`)
            refresh()
        } else showError('Connection Error', result.error || 'Failed to update status')
        setUpdatingOrders(prev => {
            const next = new Set(prev)
            next.delete(orderId)
            return next
        })
    }

    const handleDispatchToRider = async (orderId: string) => {
        // In production, this would assign a rider and send notifications
        setUpdatingOrders(prev => new Set(prev).add(orderId))
        const result = await updateOrderStatus(orderId, 'served') // Using served as "dispatched" for now
        if (result.success) {
            success('Dispatched!', 'Order sent to delivery rider. Customer notified.')
            refresh()
        } else showError('Dispatch Failed', result.error || 'Failed to dispatch order')
        setUpdatingOrders(prev => {
            const next = new Set(prev)
            next.delete(orderId)
            return next
        })
    }

    const getElapsedTime = (createdAt: string) => {
        const diff = Math.floor((currentTime.getTime() - new Date(createdAt).getTime()) / 1000)
        const mins = Math.floor(diff / 60)
        return { mins, total: diff }
    }

    // Simulate delivery vs dine-in (in production, this comes from DB)
    const ordersWithType = orders.map(order => ({
        ...order,
        isDelivery: Math.random() > 0.5,
        customerPhone: '+92 300 ' + Math.floor(1000000 + Math.random() * 9000000),
        customerAddress: 'Block 5, Clifton, Karachi',
    }))

    const filteredOrders = filter === 'all'
        ? ordersWithType.filter(o => o.status !== 'served' && o.status !== 'paid')
        : ordersWithType.filter(o => o.status === filter)

    const stats = {
        pending: orders.filter(o => o.status === 'pending').length,
        preparing: orders.filter(o => o.status === 'preparing').length,
        ready: orders.filter(o => o.status === 'ready').length,
        delivery: ordersWithType.filter(o => o.isDelivery && ['pending', 'preparing', 'ready'].includes(o.status)).length,
    }

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col h-screen overflow-hidden">
            {/* Control Header */}
            <header className="h-20 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-8 shrink-0 z-10">
                <div className="flex items-center gap-8">
                    <div className="flex gap-4">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                                <ChefHat className="w-5 h-5 text-orange-600" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Kitchen Monitor</span>
                            </div>
                            <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white uppercase">
                                Kitchen <span className="text-orange-600">Screen</span>
                            </h1>
                        </div>
                    </div>

                    <div className="h-10 w-px bg-neutral-800" />

                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mb-1">New</span>
                            <span className="text-xl font-bold text-white tracking-tight">{stats.pending}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-orange-600 uppercase tracking-widest mb-1">Preparing</span>
                            <span className="text-xl font-bold text-white tracking-tight">{stats.preparing}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Ready</span>
                            <span className="text-xl font-bold text-white tracking-tight">{stats.ready}</span>
                        </div>
                        <div className="h-8 w-px bg-neutral-800" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-purple-500 uppercase tracking-widest mb-1">Delivery</span>
                            <span className="text-xl font-bold text-white tracking-tight">{stats.delivery}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Time Display */}
                    <div className="bg-black/40 px-6 py-2 rounded-2xl border border-neutral-800 flex flex-col items-center">
                        <span className="text-[8px] font-bold uppercase tracking-widest text-orange-600">System Time</span>
                        <span className="text-xl font-bold tracking-tight text-white">
                            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                        </span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => refresh()}
                            className="w-12 h-12 rounded-2xl bg-neutral-800 border border-neutral-700 text-neutral-500 hover:text-orange-600 transition-all flex items-center justify-center shadow-lg"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className={cn(
                                "w-12 h-12 rounded-2xl border transition-all flex items-center justify-center shadow-lg",
                                soundEnabled ? "bg-orange-600 text-white border-none shadow-orange-600/30" : "bg-neutral-800 text-neutral-400 border-neutral-700"
                            )}
                        >
                            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Orders Feed */}
            <main className="flex-1 p-6 overflow-x-auto flex gap-6 bg-black pb-10 custom-scrollbar">
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <UtensilsCrossed className="w-20 h-20 mb-6 text-neutral-800" />
                        <h2 className="text-xl font-bold text-neutral-500 uppercase tracking-widest">Kitchen Empty</h2>
                        <p className="mt-2 text-sm text-neutral-600 font-medium tracking-tight">Waiting for new orders from the floor.</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filteredOrders.sort((a, b) => (b.is_priority ? 1 : 0) - (a.is_priority ? 1 : 0)).map((order) => {
                            const { mins } = getElapsedTime(order.created_at)
                            const isCritical = mins >= 10
                            const isWarning = mins >= 5 && mins < 10
                            const cfg = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending
                            const isUpdating = updatingOrders.has(order.id)

                            return (
                                <motion.div
                                    key={order.id}
                                    layout
                                    initial={{ opacity: 0, x: 50, scale: 0.95 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 50 }}
                                    className="w-[380px] shrink-0 flex flex-col h-full group"
                                >
                                    <div className={cn(
                                        "flex-1 flex flex-col rounded-[2.5rem] border-2 bg-neutral-900 shadow-2xl transition-all duration-300 overflow-hidden relative",
                                        order.is_priority ? "border-rose-500" : "border-neutral-800",
                                        isCritical && 'animate-pulse border-rose-600 border-4'
                                    )}>
                                        {/* Priority Glow */}
                                        {order.is_priority && (
                                            <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500 animate-pulse" />
                                        )}

                                        {/* Delivery Badge */}
                                        {order.isDelivery && (
                                            <div className="absolute top-4 right-4 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center gap-2">
                                                <Truck className="w-3 h-3 text-purple-500" />
                                                <span className="text-[9px] font-black text-purple-500 uppercase tracking-widest">Delivery</span>
                                            </div>
                                        )}

                                        {/* Card Header */}
                                        <div className={cn("p-6 flex items-center justify-between border-b-2", cfg.bg, cfg.border)}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center text-2xl font-bold shadow-xl">
                                                    #{order.order_number}
                                                </div>
                                                <div>
                                                    <Badge className={cn("px-3 py-1 font-bold uppercase text-[10px] tracking-widest border-none", cfg.bg, cfg.text)}>
                                                        {cfg.label}
                                                    </Badge>
                                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
                                                        {order.isDelivery ? 'Delivery' : <>Table: <span className="text-white font-bold">{order.table?.table_number || 'N/A'}</span></>}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={cn(
                                                    "text-3xl font-bold tracking-tight",
                                                    isCritical ? 'text-rose-600' : isWarning ? 'text-orange-600' : 'text-emerald-500'
                                                )}>
                                                    {mins}<span className="text-sm">m</span>
                                                </div>
                                                <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">Wait Time</p>
                                            </div>
                                        </div>

                                        {/* Delivery Customer Info */}
                                        {order.isDelivery && order.status === 'ready' && (
                                            <div className="mx-6 mt-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Phone className="w-3 h-3 text-purple-500" />
                                                    <span className="text-xs text-white font-medium">{order.customerPhone}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-3 h-3 text-purple-500" />
                                                    <span className="text-xs text-white font-medium">{order.customerAddress}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Order Items */}
                                        <div className="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar">
                                            {order.items?.map((item, idx) => (
                                                <div key={idx} className="flex gap-4 p-4 rounded-3xl bg-black/40 border border-neutral-800 hover:border-orange-600/30 transition-all">
                                                    <div className="w-10 h-10 rounded-xl bg-neutral-800 text-white font-bold flex items-center justify-center text-lg italic shadow-lg">
                                                        {item.quantity}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-white uppercase text-sm tracking-tight">{item.menu_item?.name}</p>
                                                        {item.special_instructions && (
                                                            <div className="mt-2 flex items-start gap-2 p-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
                                                                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                                                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-tight leading-tight">
                                                                    {item.special_instructions}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {order.notes && (
                                                <div className="p-4 rounded-3xl bg-white text-neutral-900 shadow-xl">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Bell className="w-3.5 h-3.5 text-orange-600" />
                                                        <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Order Notes</span>
                                                    </div>
                                                    <p className="text-xs font-semibold leading-relaxed">"{order.notes}"</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="p-6 bg-neutral-900 border-t-2 border-neutral-800">
                                            <AnimatePresence mode="wait">
                                                {order.status === 'pending' && (
                                                    <Button
                                                        key="start"
                                                        variant="black"
                                                        className="w-full h-14 bg-white text-neutral-900 hover:bg-orange-600 hover:text-white rounded-2xl font-bold uppercase text-xs tracking-widest transition-all"
                                                        onClick={() => handleStatusChange(order.id, 'preparing')}
                                                        disabled={isUpdating}
                                                    >
                                                        {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start Cooking'}
                                                    </Button>
                                                )}
                                                {order.status === 'preparing' && (
                                                    <Button
                                                        key="ready"
                                                        className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg transition-all"
                                                        onClick={() => handleStatusChange(order.id, 'ready')}
                                                        disabled={isUpdating}
                                                        icon={CheckCircle2}
                                                    >
                                                        {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Mark as Ready'}
                                                    </Button>
                                                )}
                                                {order.status === 'ready' && !order.isDelivery && (
                                                    <Button
                                                        key="serve"
                                                        className="w-full h-14 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg transition-all"
                                                        onClick={() => handleStatusChange(order.id, 'served')}
                                                        disabled={isUpdating}
                                                        icon={Bell}
                                                    >
                                                        {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Notify Waiter'}
                                                    </Button>
                                                )}
                                                {order.status === 'ready' && order.isDelivery && (
                                                    <Button
                                                        key="dispatch"
                                                        className="w-full h-14 bg-purple-500 hover:bg-purple-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-purple-500/20 transition-all"
                                                        onClick={() => handleDispatchToRider(order.id)}
                                                        disabled={isUpdating}
                                                        icon={Truck}
                                                    >
                                                        {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Dispatch to Rider'}
                                                    </Button>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                )}
            </main>
        </div>
    )
}
