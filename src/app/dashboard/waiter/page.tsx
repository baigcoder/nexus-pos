'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Grid3X3,
    Plus,
    Clock,
    CheckCircle2,
    AlertCircle,
    ChefHat,
    ArrowRight,
    Users,
    Receipt
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { Card, Badge, Button } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import type { Table, Order } from '@/types'

const statusConfig = {
    available: { label: 'Available', color: 'bg-emerald-500', text: 'text-emerald-500' },
    occupied: { label: 'Occupied', color: 'bg-orange-600', text: 'text-orange-600' },
    reserved: { label: 'Reserved', color: 'bg-neutral-500', text: 'text-neutral-400' },
    billing: { label: 'Billing', color: 'bg-rose-500', text: 'text-rose-500' },
}

const orderStatusColors = {
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    preparing: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    ready: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    served: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
}

export default function WaiterDashboard() {
    const { restaurant, staff } = useAuthStore()
    const [tables, setTables] = useState<Table[]>([])
    const [myOrders, setMyOrders] = useState<Order[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState('')

    useEffect(() => {
        const updateTime = () => setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        updateTime()
        const interval = setInterval(updateTime, 60000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (restaurant?.id) {
            fetchData()
        }
    }, [restaurant?.id])

    const fetchData = async () => {
        if (!restaurant?.id) return
        setIsLoading(true)
        try {
            const supabase = createClient()

            // Fetch tables
            const { data: tablesData } = await supabase
                .from('tables')
                .select('*')
                .eq('restaurant_id', restaurant.id)
                .order('table_number')

            setTables(tablesData || [])

            // Fetch orders for this waiter (if staff is set)
            if (staff?.id) {
                const { data: ordersData } = await supabase
                    .from('orders')
                    .select('*, table:tables(*), items:order_items(*, menu_item:menu_items(*))')
                    .eq('restaurant_id', restaurant.id)
                    .eq('staff_id', staff.id)
                    .in('status', ['pending', 'preparing', 'ready'])
                    .order('created_at', { ascending: false })
                    .limit(10)

                setMyOrders(ordersData || [])
            }
        } finally {
            setIsLoading(false)
        }
    }

    const stats = {
        totalTables: tables.length,
        occupied: tables.filter(t => t.status === 'occupied').length,
        available: tables.filter(t => t.status === 'available').length,
        activeOrders: myOrders.length,
    }

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
            className="space-y-10 pb-24"
        >
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-orange-600/10 text-orange-600 border-orange-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            ● On Duty
                        </Badge>
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{currentTime}</span>
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white uppercase">
                        Waiter <span className="text-orange-600">Station</span>
                    </h1>
                    <p className="text-neutral-400 text-lg font-medium">
                        Welcome back, <span className="text-white font-bold">{staff?.name || 'Waiter'}</span>
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <Link href="/dashboard/tables">
                        <Button variant="outline" className="h-14 px-8 border-neutral-800 text-neutral-400 font-bold text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-all" icon={Grid3X3}>
                            All Tables
                        </Button>
                    </Link>
                    <Link href="/dashboard/orders">
                        <Button className="h-14 px-10 bg-orange-600 hover:bg-orange-500 text-white shadow-lg font-bold uppercase tracking-widest text-xs border-none group">
                            New Order <Plus className="ml-2 w-4 h-4" />
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'My Active Orders', value: stats.activeOrders, icon: Receipt, color: 'text-orange-600' },
                    { label: 'Tables Occupied', value: stats.occupied, icon: Users, color: 'text-white' },
                    { label: 'Tables Available', value: stats.available, icon: CheckCircle2, color: 'text-emerald-500' },
                    { label: 'Total Tables', value: stats.totalTables, icon: Grid3X3, color: 'text-neutral-400' },
                ].map((stat, idx) => (
                    <motion.div key={idx} variants={item}>
                        <Card className="p-5 bg-neutral-900 border-neutral-800 shadow-xl relative overflow-hidden group">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">{stat.label}</p>
                                    <h3 className={cn("text-3xl font-bold tracking-tight", stat.color)}>{stat.value}</h3>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-orange-600 group-hover:border-orange-600 transition-all">
                                    <stat.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Tables Grid */}
                <motion.div variants={item} className="xl:col-span-7">
                    <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white uppercase tracking-tight">Floor <span className="text-orange-600">View</span></h2>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Quick table status overview</p>
                            </div>
                            <Link href="/dashboard/tables">
                                <Button variant="outline" size="sm" className="border-neutral-800 text-neutral-400 text-[10px] uppercase tracking-widest">
                                    Manage <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                            </Link>
                        </div>

                        {isLoading ? (
                            <div className="h-48 flex items-center justify-center">
                                <div className="animate-spin w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full" />
                            </div>
                        ) : tables.length === 0 ? (
                            <div className="h-48 flex flex-col items-center justify-center text-neutral-600">
                                <Grid3X3 className="w-12 h-12 mb-4" />
                                <p className="font-bold text-sm">No tables configured</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                                {tables.map((table) => {
                                    const cfg = statusConfig[table.status]
                                    return (
                                        <Link key={table.id} href={`/dashboard/tables`}>
                                            <div className={cn(
                                                "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 cursor-pointer group",
                                                table.status === 'available' ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10' :
                                                    table.status === 'occupied' ? 'border-orange-600/30 bg-orange-600/5 hover:bg-orange-600/10' :
                                                        table.status === 'billing' ? 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10' :
                                                            'border-neutral-800 bg-neutral-900 hover:bg-neutral-800'
                                            )}>
                                                <span className={cn("text-lg font-bold", cfg.text)}>{table.table_number}</span>
                                                <div className={cn("w-2 h-2 rounded-full", cfg.color)} />
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        )}

                        {/* Legend */}
                        <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-neutral-800">
                            {Object.entries(statusConfig).map(([key, cfg]) => (
                                <div key={key} className="flex items-center gap-2">
                                    <div className={cn("w-2 h-2 rounded-full", cfg.color)} />
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{cfg.label}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </motion.div>

                {/* My Orders */}
                <motion.div variants={item} className="xl:col-span-5">
                    <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-xl h-full">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white uppercase tracking-tight">My <span className="text-orange-600">Orders</span></h2>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Orders you've placed</p>
                            </div>
                            <Badge className="bg-orange-600/10 text-orange-600 border-none font-bold">{myOrders.length}</Badge>
                        </div>

                        {myOrders.length === 0 ? (
                            <div className="h-48 flex flex-col items-center justify-center text-neutral-600">
                                <Receipt className="w-12 h-12 mb-4" />
                                <p className="font-bold text-sm">No active orders</p>
                                <p className="text-[10px] mt-2 text-neutral-700">Place an order to see it here</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {myOrders.map((order) => (
                                    <div key={order.id} className="p-4 bg-black border border-neutral-800 rounded-xl hover:border-orange-600/50 transition-colors group">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center font-bold text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                                    {order.table?.table_number || '?'}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-white">Order #{order.order_number}</span>
                                                    <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">
                                                        {order.items?.length || 0} items
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge className={cn("border font-bold text-[10px] uppercase", orderStatusColors[order.status as keyof typeof orderStatusColors] || '')}>
                                                {order.status}
                                            </Badge>
                                        </div>
                                        {order.status === 'ready' && (
                                            <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Ready for pickup!</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </motion.div>
            </div>

            {/* Quick Actions */}
            <motion.div variants={item}>
                <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-xl">
                    <h2 className="text-lg font-bold text-white uppercase tracking-tight mb-6">Quick <span className="text-orange-600">Actions</span></h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'New Order', icon: Plus, href: '/dashboard/orders', color: 'bg-orange-600 hover:bg-orange-500' },
                            { label: 'View Tables', icon: Grid3X3, href: '/dashboard/tables', color: 'bg-neutral-800 hover:bg-neutral-700' },
                            { label: 'Kitchen Status', icon: ChefHat, href: '/dashboard/kitchen', color: 'bg-neutral-800 hover:bg-neutral-700' },
                            { label: 'Call Manager', icon: AlertCircle, href: '#', color: 'bg-neutral-800 hover:bg-neutral-700' },
                        ].map((action, idx) => (
                            <Link key={idx} href={action.href}>
                                <div className={cn(
                                    "p-5 rounded-xl flex flex-col items-center gap-3 transition-all text-white",
                                    action.color
                                )}>
                                    <action.icon className="w-6 h-6" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{action.label}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </Card>
            </motion.div>
        </motion.div>
    )
}
