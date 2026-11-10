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
  Receipt,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { Card, Badge, Button } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import type { Table, Order } from '@/types'

const statusConfig = {
  available: { label: 'Available', color: 'bg-emerald-500 shadow-emerald-500/20', text: 'text-emerald-400' },
  occupied: { label: 'Occupied', color: 'bg-brand shadow-brand/20', text: 'text-brand' },
  reserved: { label: 'Reserved', color: 'bg-slate-700', text: 'text-slate-400' },
  billing: { label: 'Billing', color: 'bg-rose-500 shadow-rose-500/20', text: 'text-rose-400' },
}

const orderStatusColors = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shadow-yellow-500/5',
  preparing: 'bg-brand-subtle text-brand border-brand/20 shadow-brand/5',
  ready: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5',
  served: 'bg-white/5 text-slate-400 border-white/5',
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
    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
  }

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-24 bg-mesh-glow select-none text-slate-300"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-brand-subtle text-brand border-brand/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest shadow-glow">
              ● On Duty
            </Badge>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{currentTime}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display">
            Waiter <span className="text-brand">Station</span>
          </h1>
          <p className="text-slate-400 text-sm font-semibold">
            Welcome back, <span className="text-white font-bold">{staff?.name || 'Waiter'}</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/dashboard/tables">
            <Button variant="outline" className="h-12 px-6 border-white/5 bg-white/5 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/10 hover:border-brand/20 transition-all cursor-pointer" icon={Grid3X3}>
              All Tables
            </Button>
          </Link>
          <Link href="/dashboard/orders">
            <Button className="h-12 px-8 bg-brand hover:bg-brand-hover text-white font-bold uppercase tracking-widest text-xs border-none shadow-glow cursor-pointer group transition-all active:scale-[0.98]">
              New Order <Plus className="ml-2 w-4 h-4 transition-transform group-hover:rotate-90" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'My Active Orders', value: stats.activeOrders, icon: Receipt, color: 'text-brand' },
          { label: 'Tables Occupied', value: stats.occupied, icon: Users, color: 'text-white' },
          { label: 'Tables Available', value: stats.available, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Total Tables', value: stats.totalTables, icon: Grid3X3, color: 'text-slate-500' },
        ].map((stat, idx) => (
          <motion.div key={idx} variants={item}>
            <Card className="p-5 bg-slate-950/60 border border-white/5 rounded-2xl relative overflow-hidden group backdrop-blur-md shadow-premium">
              <div className="absolute top-0 right-0 w-20 h-20 bg-brand/5 rounded-full blur-2xl group-hover:bg-brand/10 transition-all pointer-events-none" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{stat.label}</p>
                  <h3 className={cn("text-3xl font-black font-display tracking-tight", stat.color)}>{stat.value}</h3>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 group-hover:text-brand group-hover:border-brand/20 transition-all shadow-md">
                  <stat.icon className="w-4.5 h-4.5" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Tables Grid */}
        <motion.div variants={item} className="xl:col-span-7">
          <Card className="p-6 bg-slate-950/60 border border-white/5 rounded-2xl backdrop-blur-md shadow-premium">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-widest font-display">Floor View</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Quick table layout overview</p>
              </div>
              <Link href="/dashboard/tables">
                <Button variant="outline" size="sm" className="border-white/5 bg-white/5 hover:bg-white/10 text-white text-[9px] font-bold uppercase tracking-widest cursor-pointer">
                  Manage <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>

            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-brand border-t-transparent rounded-full shadow-glow" />
              </div>
            ) : tables.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-500">
                <Grid3X3 className="w-10 h-10 mb-4" />
                <p className="font-bold text-xs uppercase tracking-widest">No tables configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {tables.map((table) => {
                  const cfg = statusConfig[table.status as keyof typeof statusConfig] || statusConfig.available
                  return (
                    <Link key={table.id} href={`/dashboard/tables`}>
                      <div className={cn(
                        "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-105 cursor-pointer group shadow-md",
                        table.status === 'available' ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10' :
                          table.status === 'occupied' ? 'border-brand/20 bg-brand/5 hover:bg-brand-hover/10 shadow-glow shadow-brand/5' :
                            table.status === 'billing' ? 'border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 shadow-glow shadow-rose-500/5' :
                              'border-white/5 bg-white/5 hover:bg-white/10'
                      )}>
                        <span className={cn("text-base font-black font-display", cfg.text)}>{table.table_number}</span>
                        <div className={cn("w-2 h-2 rounded-full shadow-glow", cfg.color)} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-8 pt-4 border-t border-white/5">
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full shadow-glow", cfg.color)} />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{cfg.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* My Orders */}
        <motion.div variants={item} className="xl:col-span-5">
          <Card className="p-6 bg-slate-950/60 border border-white/5 rounded-2xl backdrop-blur-md shadow-premium h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-widest font-display">My Orders</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Pending kitchen tickets</p>
                </div>
                <Badge className="bg-brand-subtle text-brand border border-brand/20 font-bold px-2.5 py-0.5 rounded-full">{myOrders.length}</Badge>
              </div>

              {myOrders.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-500">
                  <Receipt className="w-10 h-10 mb-4" />
                  <p className="font-bold text-xs uppercase tracking-widest">No active orders</p>
                  <p className="text-[10px] mt-2 text-slate-600 font-semibold">Place a new table ticket to monitor status</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                  {myOrders.map((order) => (
                    <div key={order.id} className="p-4 bg-white/5 border border-white/5 rounded-xl hover:border-brand/30 transition-all group relative overflow-hidden">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center font-black font-display text-brand group-hover:bg-brand group-hover:text-white transition-colors shadow-glow">
                            {order.table?.table_number || '?'}
                          </div>
                          <div>
                            <span className="font-bold text-white text-xs">Order #{order.order_number}</span>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                              {order.items?.length || 0} items
                            </p>
                          </div>
                        </div>
                        <Badge className={cn("border font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md", orderStatusColors[order.status as keyof typeof orderStatusColors] || '')}>
                          {order.status}
                        </Badge>
                      </div>
                      {order.status === 'ready' && (
                        <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg shadow-glow shadow-emerald-500/5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Ready for pickup!</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={item}>
        <Card className="p-6 bg-slate-950/60 border border-white/5 rounded-2xl backdrop-blur-md shadow-premium">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6 font-display flex items-center gap-2">
            <Sparkles className="w-4.5 h-4.5 text-brand" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'New Order', icon: Plus, href: '/dashboard/orders', color: 'bg-brand hover:bg-brand-hover shadow-glow shadow-brand/10' },
              { label: 'View Tables', icon: Grid3X3, href: '/dashboard/tables', color: 'bg-white/5 hover:bg-white/10' },
              { label: 'Kitchen Status', icon: ChefHat, href: '/dashboard/kitchen', color: 'bg-white/5 hover:bg-white/10' },
              { label: 'Call Manager', icon: AlertCircle, href: '#', color: 'bg-white/5 hover:bg-white/10' },
            ].map((action, idx) => (
              <Link key={idx} href={action.href}>
                <div className={cn(
                  "p-5 rounded-2xl flex flex-col items-center gap-3 transition-all text-white border border-white/5 hover:border-brand/20 cursor-pointer shadow-md",
                  action.color
                )}>
                  <action.icon className="w-5 h-5 shrink-0" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">{action.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
