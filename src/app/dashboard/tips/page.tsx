'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    DollarSign,
    TrendingUp,
    Calendar,
    Clock,
    Loader2,
    Receipt,
    Banknote,
    PiggyBank
} from 'lucide-react'
import { useAuthStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface TipEntry {
    id: string
    order_id: string
    amount: number
    created_at: string
    order: {
        table_id: string
        tables: {
            table_number: number
        }
    }
}

export default function TipsPage() {
    const { restaurant, staff } = useAuthStore()
    const supabase = createClient()

    const [tips, setTips] = useState<TipEntry[]>([])
    const [filter, setFilter] = useState<string>('today')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (restaurant?.id && staff?.id) {
            loadTips()
        }
    }, [restaurant?.id, staff?.id, filter])

    async function loadTips() {
        setIsLoading(true)
        try {
            // For now, simulate tips from orders
            // In real app, this would be a separate tips table
            let query = supabase
                .from('orders')
                .select(`
                    id,
                    tip_amount,
                    total_amount,
                    created_at,
                    tables(table_number)
                `)
                .eq('restaurant_id', restaurant!.id)
                .eq('staff_id', staff!.id)
                .gt('tip_amount', 0)
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
            } else if (filter === 'month') {
                const monthAgo = new Date()
                monthAgo.setMonth(monthAgo.getMonth() - 1)
                query = query.gte('created_at', monthAgo.toISOString())
            }

            const { data } = await query

            if (data) {
                const tipEntries = data.map((order: any) => ({
                    id: order.id,
                    order_id: order.id,
                    amount: order.tip_amount || 0,
                    created_at: order.created_at,
                    order: {
                        table_id: order.id,
                        tables: order.tables
                    }
                }))
                setTips(tipEntries as any)
            }
        } catch (err) {
            console.error('Error loading tips:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const totalTips = tips.reduce((sum, t) => sum + t.amount, 0)
    const avgTip = tips.length > 0 ? totalTips / tips.length : 0
    const orderCount = tips.length

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#030303] flex items-center justify-center">
                <div className="flex items-center gap-3 text-neutral-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Loading tips...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#030303] text-white p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-black">
                    <span className="text-orange-500">Tips</span> Tracker
                </h1>
                <p className="text-sm text-neutral-500">Track your earnings from tips</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-green-400 font-medium">Total Tips</span>
                        <DollarSign className="w-5 h-5 text-green-400" />
                    </div>
                    <p className="text-3xl font-black text-green-400">Rs. {totalTips.toLocaleString()}</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-5 bg-neutral-900/50 border border-white/10 rounded-2xl"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-neutral-400 font-medium">Avg per Order</span>
                        <TrendingUp className="w-5 h-5 text-orange-500" />
                    </div>
                    <p className="text-3xl font-black">Rs. {avgTip.toFixed(0)}</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-5 bg-neutral-900/50 border border-white/10 rounded-2xl"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-neutral-400 font-medium">Orders with Tips</span>
                        <Receipt className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-3xl font-black">{orderCount}</p>
                </motion.div>
            </div>

            {/* Filter */}
            <div className="flex bg-neutral-900/50 border border-white/10 rounded-xl p-1 w-fit mb-6">
                {['today', 'week', 'month', 'all'].map(f => (
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

            {/* Tips List */}
            <div className="space-y-3">
                {tips.map((tip, i) => (
                    <motion.div
                        key={tip.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-4 bg-neutral-900/50 border border-white/10 rounded-xl flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                                <Banknote className="w-6 h-6 text-green-400" />
                            </div>
                            <div>
                                <p className="font-bold">Table {tip.order?.tables?.table_number}</p>
                                <p className="text-xs text-neutral-500">
                                    {new Date(tip.created_at).toLocaleDateString()} • {new Date(tip.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xl font-bold text-green-400">+Rs. {tip.amount.toLocaleString()}</p>
                            <p className="text-xs text-neutral-500">#{tip.order_id.slice(-6)}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {tips.length === 0 && (
                <div className="text-center py-20">
                    <PiggyBank className="w-16 h-16 mx-auto mb-4 text-neutral-700" />
                    <h3 className="text-lg font-bold text-neutral-500">No Tips Yet</h3>
                    <p className="text-sm text-neutral-600">Tips from orders will appear here</p>
                </div>
            )}
        </div>
    )
}
