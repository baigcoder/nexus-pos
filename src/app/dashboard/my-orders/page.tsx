'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    ClipboardList,
    Clock,
    CheckCircle2,
    ChefHat,
    UtensilsCrossed,
    Loader2,
    Grid3X3,
    DollarSign,
    Filter
} from 'lucide-react'
import { useAuthStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Order {
    id: string
    table_id: string
    tables: {
        table_number: number
    }
    status: string
    total_amount: number
    created_at: string
    order_items: {
        id: string
        menu_item: {
            name: string
        }
        quantity: number
    }[]
}

const statusConfig: Record<string, { color: string; bgColor: string; label: string }> = {
    pending: { color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20', label: 'Pending' },
    preparing: { color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/20', label: 'Cooking' },
    ready: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20', label: 'Ready' },
    served: { color: 'text-cyan-400', bgColor: 'bg-cyan-500/10 border-cyan-500/20', label: 'Served' },
    paid: { color: 'text-green-400', bgColor: 'bg-green-500/10 border-green-500/20', label: 'Paid' },
    cancelled: { color: 'text-rose-400', bgColor: 'bg-rose-500/10 border-rose-500/20', label: 'Cancelled' },
}

export default function MyOrdersPage() {
    const { restaurant, staff } = useAuthStore()
    const supabase = createClient()

    const [orders, setOrders] = useState<Order[]>([])
    const [filter, setFilter] = useState<string>('today')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (restaurant?.id && staff?.id) {
            loadOrders()
        }
    }, [restaurant?.id, staff?.id, filter])

    async function loadOrders() {
        setIsLoading(true)
        try {
            let query = supabase
                .from('orders')
                .select(`
                    id,
                    table_id,
                    tables(table_number),
                    status,
                    total_amount,
                    created_at,
                    order_items(
                        id,
                        menu_item:menu_items(name),
                        quantity
                    )
                `)
                .eq('restaurant_id', restaurant!.id)
                .eq('staff_id', staff!.id)
                .order('created_at', { ascending: false })

            // Date filter
            if (filter === 'today') {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                query = query.gte('created_at', today.toISOString())
            } else if (filter === 'week') {
                const weekAgo = new Date()
                weekAgo.setDate(weekAgo.getDate() - 7)
                query = query.gte('created_at', weekAgo.toISOString())
            }

            const { data } = await query

            if (data) {
                setOrders(data as any)
            }
        } catch (err) {
            console.error('Error loading orders:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const filteredOrders = orders.filter(o =>
        statusFilter === 'all' || o.status === statusFilter
    )

    const todayTotal = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
    const orderCount = orders.length
    const completedCount = orders.filter(o => ['served', 'paid'].includes(o.status)).length

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#030303] flex items-center justify-center">
                <div className="flex items-center gap-3 text-neutral-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Loading orders...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#030303] text-white p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-black">
                    My <span className="text-orange-500">Orders</span>
                </h1>
                <p className="text-sm text-neutral-500">Orders you've created</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-neutral-900/50 border border-white/10 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-400">Total Orders</span>
                        <ClipboardList className="w-4 h-4 text-orange-500" />
                    </div>
                    <p className="text-2xl font-black text-white mt-1">{orderCount}</p>
                </div>
                <div className="p-4 bg-neutral-900/50 border border-white/10 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-400">Completed</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-black text-emerald-400 mt-1">{completedCount}</p>
                </div>
                <div className="p-4 bg-neutral-900/50 border border-white/10 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-400">Total Sales</span>
                        <DollarSign className="w-4 h-4 text-green-500" />
                    </div>
                    <p className="text-2xl font-black text-green-400 mt-1">Rs. {todayTotal.toLocaleString()}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
                <div className="flex bg-neutral-900/50 border border-white/10 rounded-xl p-1">
                    {['today', 'week', 'all'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize",
                                filter === f ? "bg-orange-500 text-white" : "text-neutral-400 hover:text-white"
                            )}
                        >
                            {f === 'all' ? 'All Time' : f}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2">
                    {Object.entries(statusConfig).slice(0, 4).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
                            className={cn(
                                "px-3 py-2 rounded-xl text-xs font-bold border transition-colors",
                                statusFilter === key
                                    ? config.bgColor + ' ' + config.color
                                    : "bg-neutral-900/50 border-white/10 text-neutral-400"
                            )}
                        >
                            {config.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
                {filteredOrders.map((order, i) => {
                    const config = statusConfig[order.status] || statusConfig.pending
                    return (
                        <motion.div
                            key={order.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="p-4 bg-neutral-900/50 border border-white/10 rounded-2xl"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center">
                                        <Grid3X3 className="w-6 h-6 text-orange-500" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">Table {order.tables?.table_number}</span>
                                            <span className="text-xs text-neutral-500">#{order.id.slice(-6)}</span>
                                        </div>
                                        <p className="text-xs text-neutral-500">
                                            {order.order_items?.length} items • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <Badge className={cn("text-xs font-bold", config.bgColor, config.color)}>
                                        {config.label}
                                    </Badge>
                                    <p className="text-lg font-bold text-orange-500 mt-1">
                                        Rs. {order.total_amount?.toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Items Preview */}
                            <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-2">
                                {order.order_items?.slice(0, 3).map(item => (
                                    <span key={item.id} className="px-2 py-1 bg-neutral-800 rounded text-xs text-neutral-300">
                                        {item.quantity}× {item.menu_item?.name}
                                    </span>
                                ))}
                                {order.order_items?.length > 3 && (
                                    <span className="px-2 py-1 text-xs text-neutral-500">
                                        +{order.order_items.length - 3} more
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {filteredOrders.length === 0 && (
                <div className="text-center py-20">
                    <ClipboardList className="w-16 h-16 mx-auto mb-4 text-neutral-700" />
                    <h3 className="text-lg font-bold text-neutral-500">No Orders Found</h3>
                    <p className="text-sm text-neutral-600">Start taking orders!</p>
                </div>
            )}
        </div>
    )
}
