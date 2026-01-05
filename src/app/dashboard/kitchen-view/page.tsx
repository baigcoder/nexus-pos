'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChefHat,
    Clock,
    CheckCircle2,
    Loader2,
    RefreshCw,
    User,
    UtensilsCrossed,
    Bell,
    Grid3X3
} from 'lucide-react'
import { useAuthStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface OrderItem {
    id: string
    menu_item: {
        name: string
    }
    quantity: number
    notes?: string
    status: string
}

interface Order {
    id: string
    table_id: string
    tables: {
        table_number: number
    }
    status: string
    created_at: string
    order_items: OrderItem[]
    staff: {
        name: string
    }
}

const statusConfig: Record<string, { color: string; label: string; bgColor: string }> = {
    pending: { color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20', label: 'Pending' },
    preparing: { color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/20', label: 'Preparing' },
    ready: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20', label: 'Ready' },
    served: { color: 'text-neutral-400', bgColor: 'bg-neutral-500/10 border-neutral-500/20', label: 'Served' },
}

export default function KitchenViewPage() {
    const { restaurant, staff } = useAuthStore()
    const { success } = useToast()
    const supabase = createClient()

    const [orders, setOrders] = useState<Order[]>([])
    const [filter, setFilter] = useState<string>('all')
    const [isLoading, setIsLoading] = useState(true)
    const [lastUpdate, setLastUpdate] = useState(new Date())

    useEffect(() => {
        if (restaurant?.id) {
            loadOrders()
            // Set up real-time subscription
            const channel = supabase
                .channel('kitchen-orders')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
                    () => {
                        loadOrders()
                    }
                )
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'order_items' },
                    () => {
                        loadOrders()
                    }
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [restaurant?.id])

    async function loadOrders() {
        try {
            const { data } = await supabase
                .from('orders')
                .select(`
                    id,
                    table_id,
                    tables(table_number),
                    status,
                    created_at,
                    staff(name),
                    order_items(
                        id,
                        menu_item:menu_items(name),
                        quantity,
                        notes,
                        status
                    )
                `)
                .eq('restaurant_id', restaurant!.id)
                .in('status', ['pending', 'preparing', 'ready'])
                .order('created_at', { ascending: false })

            if (data) {
                setOrders(data as any)
            }
            setLastUpdate(new Date())
        } catch (err) {
            console.error('Error loading orders:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const markAsPickedUp = async (orderId: string) => {
        await supabase
            .from('orders')
            .update({ status: 'served' })
            .eq('id', orderId)

        success('Order Picked Up', 'Order marked as served')
        loadOrders()
    }

    const getTimeAgo = (dateStr: string) => {
        const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
        if (mins < 1) return 'Just now'
        if (mins < 60) return `${mins}m ago`
        return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
    }

    const filteredOrders = orders.filter(order =>
        filter === 'all' || order.status === filter
    )

    const pendingCount = orders.filter(o => o.status === 'pending').length
    const preparingCount = orders.filter(o => o.status === 'preparing').length
    const readyCount = orders.filter(o => o.status === 'ready').length

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#030303] flex items-center justify-center">
                <div className="flex items-center gap-3 text-neutral-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Loading kitchen view...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#030303] text-white p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-black">
                        Kitchen <span className="text-orange-500">View</span>
                    </h1>
                    <p className="text-sm text-neutral-500">Live order status from kitchen</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-xs text-neutral-500">
                        Last update: {lastUpdate.toLocaleTimeString()}
                    </div>
                    <button
                        onClick={loadOrders}
                        className="p-2 bg-neutral-900 border border-white/10 rounded-xl hover:bg-neutral-800 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-amber-400 font-medium">Pending</span>
                        <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <p className="text-3xl font-black text-amber-400 mt-2">{pendingCount}</p>
                </div>
                <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-blue-400 font-medium">Preparing</span>
                        <ChefHat className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-3xl font-black text-blue-400 mt-2">{preparingCount}</p>
                </div>
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-emerald-400 font-medium">Ready</span>
                        <Bell className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-3xl font-black text-emerald-400 mt-2">{readyCount}</p>
                </div>
            </div>

            {/* Filter */}
            <div className="flex gap-2 mb-6">
                {[
                    { value: 'all', label: 'All Orders', count: orders.length },
                    { value: 'pending', label: 'Pending', count: pendingCount },
                    { value: 'preparing', label: 'Preparing', count: preparingCount },
                    { value: 'ready', label: 'Ready', count: readyCount },
                ].map(f => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={cn(
                            "px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2",
                            filter === f.value
                                ? "bg-orange-500 text-white"
                                : "bg-neutral-900/50 text-neutral-400 hover:text-white"
                        )}
                    >
                        {f.label}
                        <span className="text-[10px] px-1.5 py-0.5 bg-black/20 rounded-full">{f.count}</span>
                    </button>
                ))}
            </div>

            {/* Orders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                    {filteredOrders.map(order => {
                        const config = statusConfig[order.status] || statusConfig.pending
                        return (
                            <motion.div
                                key={order.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className={cn(
                                    "p-4 border rounded-2xl",
                                    config.bgColor,
                                    order.status === 'ready' && "ring-2 ring-emerald-500 animate-pulse"
                                )}
                            >
                                {/* Order Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center">
                                            <Grid3X3 className="w-5 h-5 text-orange-500" />
                                        </div>
                                        <div>
                                            <p className="font-bold">Table {order.tables?.table_number}</p>
                                            <p className="text-xs text-neutral-500">#{order.id.slice(-6)}</p>
                                        </div>
                                    </div>
                                    <Badge className={cn("text-xs font-bold", config.bgColor, config.color)}>
                                        {config.label}
                                    </Badge>
                                </div>

                                {/* Order Items */}
                                <div className="space-y-2 mb-3">
                                    {order.order_items?.map(item => (
                                        <div key={item.id} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 bg-neutral-800 rounded text-xs flex items-center justify-center font-bold">
                                                    {item.quantity}
                                                </span>
                                                <span className="text-neutral-300">{item.menu_item?.name}</span>
                                            </div>
                                            {item.notes && (
                                                <span className="text-xs text-amber-400 italic">{item.notes}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                                        <Clock className="w-3 h-3" />
                                        {getTimeAgo(order.created_at)}
                                    </div>

                                    {order.status === 'ready' && (
                                        <button
                                            onClick={() => markAsPickedUp(order.id)}
                                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-xs font-bold flex items-center gap-1.5"
                                        >
                                            <CheckCircle2 className="w-3 h-3" />
                                            Pick Up
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>

            {filteredOrders.length === 0 && (
                <div className="text-center py-20">
                    <ChefHat className="w-16 h-16 mx-auto mb-4 text-neutral-700" />
                    <h3 className="text-lg font-bold text-neutral-500">No Active Orders</h3>
                    <p className="text-sm text-neutral-600">Kitchen is clear!</p>
                </div>
            )}
        </div>
    )
}
