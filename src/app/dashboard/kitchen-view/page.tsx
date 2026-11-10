'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Bell,
  Grid3X3
} from 'lucide-react'
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
  } | null
  status: string
  created_at: string
  order_items: OrderItem[]
}

const statusConfig: Record<string, { color: string; label: string; bgColor: string }> = {
  pending: { color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20', label: 'Pending' },
  preparing: { color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/20', label: 'Preparing' },
  ready: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20', label: 'Ready' },
  served: { color: 'text-[var(--text-muted)]', bgColor: 'bg-[var(--surface-hover)]0/10 border-[var(--border)]', label: 'Served' },
}

// Standalone Kitchen View - no auth store dependency
export default function KitchenViewPage() {
  const { success, error: showError } = useToast()
  const supabase = createClient()

  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const initialLoadDone = useRef(false)

  const pendingCount = orders.filter(o => o.status === 'pending').length
  const preparingCount = orders.filter(o => o.status === 'preparing').length
  const readyCount = orders.filter(o => o.status === 'ready').length

  // Get restaurant ID once on mount
  useEffect(() => {
    const getRestaurantId = async () => {
      // Try auth store first (for persistent users)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: rest } = await supabase
            .from('restaurants')
            .select('id')
            .eq('owner_id', user.id)
            .single()
          if (rest) {
            setRestaurantId(rest.id)
            return
          }
        }
      } catch (e) {
        console.warn('Auth check failed')
      }

      // Check localStorage for staff login
      try {
        const authStore = localStorage.getItem('orderflow-auth')
        if (authStore) {
          const parsed = JSON.parse(authStore)
          const restaurant = parsed.state?.restaurant
          if (restaurant?.id) {
            setRestaurantId(restaurant.id)
            return
          }
        }
      } catch (e) {
        console.warn('LocalStorage check failed')
      }
    }

    getRestaurantId()
  }, [supabase])

  // Load orders - called only when restaurantId is available
  const loadOrders = useCallback(async () => {
    if (!restaurantId) return

    setIsSyncing(true)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          tables(table_number),
          status,
          created_at,
          order_items(
            id,
            menu_item:menu_items(name),
            quantity,
            notes,
            status
          )
        `)
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'preparing', 'ready'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Orders fetch error:', error)
        const fallback = await supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .in('status', ['pending', 'preparing', 'ready'])
          .order('created_at', { ascending: false })
          .limit(100)

        if (fallback.data) {
          setOrders(fallback.data as unknown as Order[])
        }
      } else if (data) {
        setOrders(data as unknown as Order[])
      }

      setLastUpdate(new Date())
    } catch (err) {
      console.error('Error loading orders:', err)
    } finally {
      setIsLoading(false)
      setIsSyncing(false)
    }
  }, [restaurantId, supabase])

  // Initial load and periodic sync
  useEffect(() => {
    if (!restaurantId) return

    initialLoadDone.current = true
    loadOrders()

    // Manual sync every 30 seconds
    syncIntervalRef.current = setInterval(() => {
      loadOrders()
    }, 30000)

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [restaurantId, loadOrders])

  const markAsPickedUp = async (orderId: string) => {
    try {
      const response = await fetch('/api/order-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'serve_order', data: { order_id: orderId } }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not mark order as served')
      setOrders(prev => prev.filter(order => order.id !== orderId))
      success('Order Picked Up', 'Order marked as served')
    } catch (error) {
      showError('Pickup Failed', error instanceof Error ? error.message : 'Could not mark order as served')
      loadOrders()
    }
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

  if (!restaurantId) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[var(--text-muted)]">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[var(--text-muted)]">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
          <span className="text-sm">Loading kitchen view...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030303] text-[var(--text-primary)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <ChefHat className="w-7 h-7 text-brand" />
            Kitchen <span className="text-brand">View</span>
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Live order status from kitchen</p>
        </div>

        <div className="flex items-center gap-4">
          {isSyncing && (
            <div className="flex items-center gap-2 text-xs text-orange-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Syncing...
            </div>
          )}
          {lastUpdate && (
            <div className="text-xs text-[var(--text-muted)]">
              Updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={loadOrders}
            disabled={isSyncing}
            className={cn(
              "p-2.5 bg-[var(--surface-raised)] border border-white/10 rounded-xl hover:bg-[var(--surface-active)] transition-all flex items-center gap-2",
              isSyncing && "opacity-50 cursor-not-allowed"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            <span className="text-xs font-medium">Refresh</span>
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
            <Bell className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-3xl font-black text-blue-400 mt-2">{preparingCount}</p>
        </div>
        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-sm text-emerald-400 font-medium">Ready</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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
                ? "bg-brand text-[var(--text-primary)]"
                : "bg-[var(--surface-raised)]/50 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            {f.label}
            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--surface)]/20 rounded-full">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Orders Grid - No animations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOrders.map(order => {
          const config = statusConfig[order.status] || statusConfig.pending
          return (
            <div
              key={order.id}
              className={cn(
                "p-4 border rounded-2xl transition-all",
                config.bgColor,
                order.status === 'ready' && "ring-2 ring-emerald-500"
              )}
            >
              {/* Order Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-[var(--surface-active)] rounded-xl flex items-center justify-center">
                    <Grid3X3 className="w-5 h-5 text-brand" />
                  </div>
                  <div>
                    <p className="font-bold">Table {order.tables?.table_number || 'N/A'}</p>
                    <p className="text-xs text-[var(--text-muted)]">#{order.id.slice(-6)}</p>
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
                      <span className="w-5 h-5 bg-[var(--surface-active)] rounded text-xs flex items-center justify-center font-bold">
                        {item.quantity}
                      </span>
                      <span className="text-[var(--text-secondary)]">{item.menu_item?.name || 'Item'}</span>
                    </div>
                    {item.notes && (
                      <span className="text-xs text-amber-400 italic">{item.notes}</span>
                    )}
                  </div>
                ))}
                {(!order.order_items || order.order_items.length === 0) && (
                  <p className="text-xs text-[var(--text-muted)]">Loading items...</p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <Clock className="w-3 h-3" />
                  {getTimeAgo(order.created_at)}
                </div>

                {order.status === 'ready' && (
                  <button
                    onClick={() => markAsPickedUp(order.id)}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Pick Up
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-20">
          <ChefHat className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
          <h3 className="text-lg font-bold text-[var(--text-muted)]">No Active Orders</h3>
          <p className="text-sm text-[var(--text-muted)]">Kitchen is clear!</p>
        </div>
      )}
    </div>
  )
}