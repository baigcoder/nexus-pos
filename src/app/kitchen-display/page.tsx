'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChefHat,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Bell,
    RefreshCw,
    Loader2,
    ArrowUp,
    ArrowDown,
    Minus
} from 'lucide-react'
import { Card } from '@/components/ui/common'
import { useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'

interface KitchenOrder {
    id: string
    order_id: string
    priority: 'high' | 'normal' | 'low'
    status: 'pending' | 'preparing' | 'ready' | 'served'
    received_at: string
    started_at?: string
    ready_at?: string
    prep_time_seconds: number
    actual_prep_time_seconds?: number
    assigned_to?: string
    order?: {
        id: string
        order_number: number
        created_at: string
        table_number?: number
        customer_name?: string
        is_priority: boolean
    }
    items: {
        id: string
        quantity: number
        menu_item: { name: string }
        special_instructions?: string
    }[]
}

export default function KitchenViewPage() {
    const { user, staff } = useAuthStore()
    const [orders, setOrders] = useState<KitchenOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState<string | null>(null)

    const loadOrders = useCallback(async () => {
        try {
            const response = await fetch('/api/order-flow?view=kitchen')
            if (response.ok) {
                const data = await response.json()
                setOrders(data.queue || [])
            }
        } catch (err) {
            console.error('Load error:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadOrders()
        // Refresh every 10 seconds
        const interval = setInterval(loadOrders, 10000)
        return () => clearInterval(interval)
    }, [loadOrders])

    const updateOrderStatus = async (orderId: string, action: 'start' | 'ready') => {
        setUpdating(orderId)
        try {
            const response = await fetch('/api/order-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: action === 'start' ? 'kitchen_start' : 'kitchen_ready',
                    data: { order_id: orderId }
                })
            })
            if (response.ok) {
                await loadOrders()
            }
        } catch (err) {
            console.error('Update error:', err)
        } finally {
            setUpdating(null)
        }
    }

    const getElapsedTime = (startTime: string) => {
        const seconds = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
        const mins = Math.floor(seconds / 60)
        return `${mins}:${String(seconds % 60).padStart(2, '0')}`
    }

    const getTimeColor = (receivedAt: string, prepTimeSeconds: number) => {
        const elapsed = (Date.now() - new Date(receivedAt).getTime()) / 1000
        const warningTime = prepTimeSeconds * 0.8
        const dangerTime = prepTimeSeconds

        if (elapsed > dangerTime) return 'text-rose-500'
        if (elapsed > warningTime) return 'text-amber-500'
        return 'text-emerald-500'
    }

    // Stats
    const pendingCount = orders.filter(o => o.status === 'pending').length
    const preparingCount = orders.filter(o => o.status === 'preparing').length
    const readyCount = orders.filter(o => o.status === 'ready').length

    return (
        <div className="min-h-screen bg-neutral-950 p-6">
            {/* Header */}
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-500/20 rounded-xl">
                        <ChefHat className="w-8 h-8 text-rose-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">Kitchen Display</h1>
                        <p className="text-sm text-neutral-500">Real-time order management</p>
                    </div>
                </div>
                <button
                    onClick={loadOrders}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white hover:bg-neutral-700"
                >
                    <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                    Refresh
                </button>
            </header>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="bg-neutral-900/60 border-neutral-800 p-4 text-center">
                    <p className="text-3xl font-black text-amber-500">{pendingCount}</p>
                    <p className="text-sm text-neutral-500">Pending</p>
                </Card>
                <Card className="bg-neutral-900/60 border-neutral-800 p-4 text-center">
                    <p className="text-3xl font-black text-blue-500">{preparingCount}</p>
                    <p className="text-sm text-neutral-500">Preparing</p>
                </Card>
                <Card className="bg-neutral-900/60 border-neutral-800 p-4 text-center">
                    <p className="text-3xl font-black text-emerald-500">{readyCount}</p>
                    <p className="text-sm text-neutral-500">Ready</p>
                </Card>
            </div>

            {/* Order Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-neutral-500 animate-spin" />
                </div>
            ) : orders.length === 0 ? (
                <Card className="bg-neutral-900/60 border-neutral-800 p-12 text-center">
                    <ChefHat className="w-16 h-16 text-neutral-700 mx-auto mb-4" />
                    <p className="text-xl font-bold text-neutral-500">No orders in queue</p>
                    <p className="text-sm text-neutral-600">New orders will appear here</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <AnimatePresence>
                        {orders.map((order) => {
                            const isUpdating = updating === order.order_id
                            const isOverdue = order.received_at &&
                                (Date.now() - new Date(order.received_at).getTime()) / 1000 > order.prep_time_seconds

                            return (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className={cn(
                                        "rounded-2xl border-2 p-4",
                                        order.priority === 'high' && 'bg-rose-500/10 border-rose-500/50',
                                        order.priority === 'normal' && order.status === 'pending' && 'bg-amber-500/5 border-amber-500/30',
                                        order.status === 'preparing' && 'bg-blue-500/10 border-blue-500/50',
                                        order.status === 'ready' && 'bg-emerald-500/10 border-emerald-500/50',
                                        order.status === 'served' && 'bg-neutral-800/50 border-neutral-700'
                                    )}
                                >
                                    {/* Order Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-black text-white">
                                                #{order.order?.order_number}
                                            </span>
                                            {order.priority === 'high' && (
                                                <span className="px-2 py-0.5 bg-rose-500/30 text-rose-400 text-xs font-bold rounded">
                                                    RUSH
                                                </span>
                                            )}
                                        </div>
                                        <span className={cn(
                                            "text-xs font-bold px-2 py-1 rounded",
                                            order.status === 'pending' && 'bg-amber-500/20 text-amber-400',
                                            order.status === 'preparing' && 'bg-blue-500/20 text-blue-400',
                                            order.status === 'ready' && 'bg-emerald-500/20 text-emerald-400'
                                        )}>
                                            {order.status.toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Timer */}
                                    <div className="flex items-center gap-2 mb-4">
                                        <Clock className={cn("w-4 h-4", getTimeColor(order.received_at, order.prep_time_seconds))} />
                                        <span className={cn("font-mono font-bold", getTimeColor(order.received_at, order.prep_time_seconds))}>
                                            {order.received_at ? getElapsedTime(order.received_at) : '00:00'}
                                        </span>
                                        <span className="text-xs text-neutral-500">/ {Math.floor(order.prep_time_seconds / 60)}min</span>
                                        {isOverdue && (
                                            <AlertTriangle className="w-4 h-4 text-rose-500 ml-auto" />
                                        )}
                                    </div>

                                    {/* Table/Customer */}
                                    {order.order?.table_number && (
                                        <div className="text-sm text-neutral-400 mb-2">
                                            Table: <span className="text-white font-bold">T{order.order.table_number}</span>
                                        </div>
                                    )}
                                    {order.order?.customer_name && (
                                        <div className="text-sm text-neutral-400 mb-2">
                                            {order.order.customer_name}
                                        </div>
                                    )}

                                    {/* Items */}
                                    <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                                        {order.items?.map((item) => (
                                            <div key={item.id} className="flex items-start gap-2">
                                                <span className="bg-neutral-800 text-white text-xs font-bold px-2 py-0.5 rounded min-w-[24px] text-center">
                                                    {item.quantity}
                                                </span>
                                                <div className="flex-1">
                                                    <p className="text-white text-sm font-medium">{item.menu_item?.name}</p>
                                                    {item.special_instructions && (
                                                        <p className="text-amber-400 text-xs">{item.special_instructions}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action Button */}
                                    {order.status === 'pending' && (
                                        <button
                                            onClick={() => updateOrderStatus(order.order_id, 'start')}
                                            disabled={isUpdating}
                                            className="w-full h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                                        >
                                            {isUpdating ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <>
                                                    <ArrowDown className="w-5 h-5" />
                                                    START
                                                </>
                                            )}
                                        </button>
                                    )}

                                    {order.status === 'preparing' && (
                                        <button
                                            onClick={() => updateOrderStatus(order.order_id, 'ready')}
                                            disabled={isUpdating}
                                            className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                                        >
                                            {isUpdating ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="w-5 h-5" />
                                                    MARK READY
                                                </>
                                            )}
                                        </button>
                                    )}

                                    {order.status === 'ready' && (
                                        <div className="h-12 bg-emerald-500/20 border border-emerald-500/50 rounded-xl flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-2" />
                                            <span className="text-emerald-400 font-bold">READY FOR PICKUP</span>
                                        </div>
                                    )}
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* Audio Alert for New Orders */}
            <audio id="kitchen-alert" src="/sounds/new-order.mp3" preload="auto" />
        </div>
    )
}