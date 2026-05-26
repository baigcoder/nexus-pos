'use client'

import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useCallback } from 'react'
import type { Order, OrderItem } from '@/types/database'
import type { DisplayType } from '@/types/display'
import { OrderTicket } from './OrderTicket'
import { cn } from '@/lib/utils'
import {
  ChefHat, Wine, Monitor, Users, QrCode, RefreshCw,
  Volume2, VolumeX, Maximize, Clock, AlertTriangle, Megaphone, CreditCard
} from 'lucide-react'

interface DisplayViewerProps {
  display: {
    id: string
    name: string
    slug: string
    type: DisplayType
    template: 'list' | 'kanban' | 'grid' | 'compact'
    settings: {
      refresh_interval: number
      sound_enabled: boolean
      theme: 'dark' | 'light'
      show_timer: boolean
      priority_enabled: boolean
    }
  }
  restaurant: {
    id: string
    name: string
    currency: string
    slug: string
  }
}

const TYPE_ICONS = {
  kitchen: ChefHat,
  bar: Wine,
  counter: Monitor,
  cashier: CreditCard,
  waiting: Users,
  qr: QrCode,
  advertisement: Megaphone,
}

const TYPE_COLORS = {
  kitchen: { bg: 'from-orange-600 to-red-600', text: 'text-orange-500', badge: 'bg-orange-500/20 text-orange-400' },
  bar: { bg: 'from-purple-600 to-pink-600', text: 'text-purple-500', badge: 'bg-purple-500/20 text-purple-400' },
  counter: { bg: 'from-cyan-600 to-blue-600', text: 'text-cyan-500', badge: 'bg-cyan-500/20 text-cyan-400' },
  cashier: { bg: 'from-sky-600 to-indigo-600', text: 'text-sky-500', badge: 'bg-sky-500/20 text-sky-400' },
  waiting: { bg: 'from-emerald-600 to-green-600', text: 'text-emerald-500', badge: 'bg-emerald-500/20 text-emerald-400' },
  qr: { bg: 'from-amber-600 to-orange-600', text: 'text-amber-500', badge: 'bg-amber-500/20 text-amber-400' },
  advertisement: { bg: 'from-pink-600 to-purple-600', text: 'text-pink-500', badge: 'bg-pink-500/20 text-pink-400' },
}

export function DisplayViewer({ display, restaurant }: DisplayViewerProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isMuted, setIsMuted] = useState(!display.settings.sound_enabled)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  const colors = TYPE_COLORS[display.type]
  const TypeIcon = TYPE_ICONS[display.type]

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Load orders
  const loadOrders = useCallback(async () => {
    setIsRefreshing(true)
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(
          *,
          menu_item:menu_items(name, image_url)
        ),
        table:tables(table_number)
      `)
      .eq('restaurant_id', restaurant.id)
      .in('status', ['pending', 'preparing'])
      .order('created_at', { ascending: true })

    if (data) {
      // Filter by display type
      const filteredOrders = display.type === 'bar'
        ? data.filter((o: any) => o.items?.some((item: any) => isDrinkCategory(item?.menu_item?.category)))
        : data
      setOrders(filteredOrders)
    }
    setIsRefreshing(false)
    setIsLoading(false)
  }, [display.type, restaurant.id, supabase])

  // Initial load
  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(loadOrders, (display.settings.refresh_interval || 5) * 1000)
    return () => clearInterval(interval)
  }, [loadOrders, display.settings.refresh_interval])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`display_orders_${display.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id}`
      }, () => {
        loadOrders()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_items',
      }, () => {
        loadOrders()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [display.id, restaurant.id, loadOrders, supabase])

  const updateOrderStatus = async (orderId: string, status: 'preparing' | 'ready' | 'served') => {
    await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
    loadOrders()
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const preparingOrders = orders.filter(o => o.status === 'preparing')

  const renderTemplate = () => {
    switch (display.template) {
      case 'kanban':
        return (
          <div className="grid grid-cols-3 gap-6 h-full">
            <KanbanColumn
              title="Pending"
              orders={pendingOrders}
              color="yellow"
              onAction={(id) => updateOrderStatus(id, 'preparing')}
              actionLabel="Start"
              currency={restaurant.currency}
              showTimer={display.settings.show_timer}
            />
            <KanbanColumn
              title="Preparing"
              orders={preparingOrders}
              color="orange"
              onAction={(id) => updateOrderStatus(id, 'ready')}
              actionLabel="Ready"
              currency={restaurant.currency}
              showTimer={display.settings.show_timer}
            />
            <KanbanColumn
              title="Ready"
              orders={[]}
              color="green"
              onAction={() => {}}
              actionLabel=""
              currency={restaurant.currency}
              showTimer={display.settings.show_timer}
              isEmpty
            />
          </div>
        )

      case 'grid':
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 h-full">
            {orders.map((order) => (
              <OrderTicket
                key={order.id}
                order={order}
                currency={restaurant.currency}
                variant="grid"
                showTimer={display.settings.show_timer}
                priorityEnabled={display.settings.priority_enabled}
                onStatusChange={(status) => updateOrderStatus(order.id, status)}
              />
            ))}
          </div>
        )

      case 'compact':
        return (
          <div className="space-y-2 h-full">
            {orders.map((order) => (
              <OrderTicket
                key={order.id}
                order={order}
                currency={restaurant.currency}
                variant="compact"
                showTimer={display.settings.show_timer}
                priorityEnabled={display.settings.priority_enabled}
                onStatusChange={(status) => updateOrderStatus(order.id, status)}
              />
            ))}
          </div>
        )

      default: // list
        return (
          <div className="space-y-4 h-full overflow-y-auto pr-2 custom-scrollbar">
            {orders.map((order) => (
              <OrderTicket
                key={order.id}
                order={order}
                currency={restaurant.currency}
                variant="list"
                showTimer={display.settings.show_timer}
                priorityEnabled={display.settings.priority_enabled}
                onStatusChange={(status) => updateOrderStatus(order.id, status)}
              />
            ))}
          </div>
        )
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-xl font-bold">Loading display...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "min-h-screen flex flex-col",
      display.settings.theme === 'dark' ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-900'
    )}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center",
            colors.bg
          )}>
            <TypeIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">{display.name}</h1>
            <p className="text-sm text-neutral-500">{restaurant.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900/50 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-bold text-neutral-400">
              {orders.length} Active
            </span>
          </div>
          <div className="px-4 py-2 bg-neutral-900/50 rounded-full text-sm font-mono">
            {currentTime.toLocaleTimeString()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={cn(
              "p-3 rounded-xl transition-all",
              "bg-neutral-900/50 hover:bg-neutral-800"
            )}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            onClick={loadOrders}
            className={cn(
              "p-3 rounded-xl transition-all",
              "bg-neutral-900/50 hover:bg-neutral-800",
              isRefreshing && "animate-spin"
            )}
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className={cn(
              "p-3 rounded-xl transition-all",
              "bg-neutral-900/50 hover:bg-neutral-800"
            )}
          >
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 overflow-hidden">
        {orders.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <TypeIcon className="w-24 h-24 text-neutral-700 mx-auto mb-6" />
              <h2 className="text-3xl font-black text-neutral-600 mb-2">No Pending Orders</h2>
              <p className="text-neutral-500">All orders have been processed</p>
            </div>
          </div>
        ) : (
          renderTemplate()
        )}
      </main>
    </div>
  )
}

function KanbanColumn({
  title,
  orders,
  color,
  onAction,
  actionLabel,
  currency,
  showTimer,
  isEmpty
}: {
  title: string
  orders: Order[]
  color: string
  onAction: (id: string) => void
  actionLabel: string
  currency: string
  showTimer: boolean
  isEmpty?: boolean
}) {
  const colorMap: Record<string, { border: string; badge: string }> = {
    yellow: { border: 'border-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400' },
    orange: { border: 'border-orange-500', badge: 'bg-orange-500/20 text-orange-400' },
    green: { border: 'border-emerald-500', badge: 'bg-emerald-500/20 text-emerald-400' },
  }

  return (
    <div className={cn(
      "flex flex-col rounded-2xl border-2 p-4",
      colorMap[color].border,
      isEmpty ? "border-dashed opacity-50" : ""
    )}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black">{title}</h3>
        <span className={cn(
          "px-2 py-1 rounded-lg text-xs font-bold",
          colorMap[color].badge
        )}>
          {orders.length}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {orders.map((order) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neutral-900 rounded-xl p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-black text-orange-400">#{order.order_number}</span>
              <span className="text-xs text-neutral-500">
                {order.table?.table_number ? `T${order.table.table_number}` : ''}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              {(order.items as OrderItem[])?.slice(0, 3).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-bold text-orange-400">{item.quantity}x</span>
                  <span className="truncate">{item.menu_item?.name || 'Item'}</span>
                </div>
              ))}
              {(order.items?.length || 0) > 3 && (
                <p className="text-neutral-500 text-xs">+{(order.items?.length || 0) - 3} more</p>
              )}
            </div>
            {actionLabel && (
              <button
                onClick={() => onAction(order.id)}
                className={cn(
                  "w-full mt-3 px-4 py-2 rounded-lg font-bold text-sm transition-all",
                  "bg-orange-600 hover:bg-orange-700 text-white"
                )}
              >
                {actionLabel}
              </button>
            )}
          </motion.div>
        ))}
        {isEmpty && (
          <div className="h-full flex items-center justify-center text-neutral-600">
            <p className="text-sm">Drop orders here</p>
          </div>
        )}
      </div>
    </div>
  )
}

function isDrinkCategory(category: string | undefined): boolean {
  if (!category) return false
  const drinkKeywords = ['drinks', 'beverages', 'cocktails', 'wine', 'beer', 'coffee', 'tea', 'juice', 'soda', 'water']
  const cat = category.toLowerCase()
  return drinkKeywords.some(k => cat.includes(k))
}
