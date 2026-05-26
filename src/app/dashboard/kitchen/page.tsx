'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Clock, ChefHat, Volume2, VolumeX, CheckCircle2, Bell,
  UtensilsCrossed, Loader2, RefreshCw, Truck, LayoutGrid,
  Flame, Timer, Info, Maximize, Minimize, BarChart3,
  TrendingUp, Target, Pause, Play, X, Zap, Monitor, CreditCard, ShieldCheck
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { getDisplayRoleLabels } from '@/lib/display-access'
import type { DisplayType } from '@/types/display'

/* ============================================
  TYPES
  ============================================ */

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled'

interface OrderItem {
  id: string
  quantity: number
  menu_item?: { name: string }
  special_instructions?: string
  customizations?: Array<{ selected_options?: Array<{ option_name: string }> }>
}

interface Order {
  id: string
  order_number: number
  table_id: string | null
  status: OrderStatus
  created_at: string
  notes?: string
  is_priority?: boolean
  items?: OrderItem[]
  table?: { table_number: number }
}

interface KitchenStats {
  avgPrepTime: number
  ordersToday: number
  completedOrders: number
  onTimeRate: number
}

interface LinkedDisplay {
  id: string
  name: string
  slug: string
  type: DisplayType
  is_active: boolean
}

/* ============================================
  STATUS CONFIG
  ============================================ */

const statusConfig = {
  pending:  { label: 'NEW',   color: 'text-rose-500',  bg: 'bg-rose-500/10',  border: 'border-rose-500/20',  bar: 'bg-rose-500' },
  preparing: { label: 'COOKING', color: 'text-amber-500',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  bar: 'bg-amber-500' },
  ready:   { label: 'READY',  color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', bar: 'bg-emerald-500' },
}

/* ============================================
  KITCHEN PAGE
  ============================================ */

export default function KitchenPage() {
  const { success, error: showError } = useToast()
  const supabase = createClient()

  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [stats, setStats] = useState<KitchenStats>({ avgPrepTime: 0, ordersToday: 0, completedOrders: 0, onTimeRate: 100 })
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [mode, setMode] = useState<'kitchen' | 'owner'>('kitchen')
  const [isPaused, setIsPaused] = useState(false)
  const [linkedDisplays, setLinkedDisplays] = useState<LinkedDisplay[]>([])
  const lastOrderCount = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  /* ---- Get restaurant ID ---- */
  useEffect(() => {
    const getRestaurantId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: rest } = await supabase
            .from('restaurants')
            .select('id')
            .eq('owner_id', user.id)
            .single()
          if (rest) { setRestaurantId(rest.id); return }
        }
      } catch (e) { /* skip */ }

      try {
        const authStore = localStorage.getItem('orderflow-auth')
        if (authStore) {
          const parsed = JSON.parse(authStore)
          const restaurant = parsed.state?.restaurant
          if (restaurant?.id) setRestaurantId(restaurant.id)
        }
      } catch (e) { /* skip */ }
    }
    getRestaurantId()
  }, [supabase])

  /* ---- Load orders ---- */
  const loadOrders = useCallback(async () => {
    if (!restaurantId) return
    setIsSyncing(true)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          table_id,
          status,
          created_at,
          notes,
          is_priority,
          items:order_items(id, quantity, menu_item:menu_items(name), special_instructions, customizations),
          table:tables(table_number)
        `)
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'preparing', 'ready'])
        .gte('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })

      if (!error && data) {
        setOrders(data as unknown as Order[])

        // Sound for new orders
        if (soundEnabled && data.length > lastOrderCount.current) {
          playNotificationSound()
        }
        lastOrderCount.current = data.length

        // Calculate stats
        const today = new Date().toISOString().split('T')[0]
        const completedToday = data.filter((o: any) =>
          o.status === 'served' && o.created_at.startsWith(today)
        )
        const pendingTime = data.filter((o: any) => o.status === 'pending')
        const avgPrep = pendingTime.length > 0
          ? Math.floor(pendingTime.reduce((acc: number, o: any) =>
            acc + (Date.now() - new Date(o.created_at).getTime()) / 60000, 0) / pendingTime.length)
          : 0

        setStats(prev => ({
          ...prev,
          avgPrepTime: avgPrep,
          ordersToday: completedToday.length + pendingTime.length,
          completedOrders: completedToday.length
        }))
      }
    } catch (err) {
      console.error('Load orders error:', err)
    } finally {
      setIsLoading(false)
      setIsSyncing(false)
      setLastUpdate(new Date())
    }
  }, [restaurantId, supabase, soundEnabled])

  const loadLinkedDisplays = useCallback(async () => {
    if (!restaurantId) return
    const { data } = await supabase
      .from('displays')
      .select('id, name, slug, type, is_active')
      .eq('restaurant_id', restaurantId)
      .in('type', ['kitchen', 'counter', 'cashier'])
      .order('created_at', { ascending: false })

    if (data) setLinkedDisplays(data as LinkedDisplay[])
  }, [restaurantId, supabase])

  /* ---- Real-time subscription ---- */
  useEffect(() => {
    if (!restaurantId) return

    loadOrders()
    loadLinkedDisplays()

    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload: { new: any; old: any }) => {
          if (isPaused) return
          const newOrder = payload.new
          const oldOrder = payload.old
          // Only react to relevant status changes
          if (['pending', 'preparing', 'ready'].includes(newOrder?.status) ||
            ['pending', 'preparing', 'ready'].includes(oldOrder?.status)) {
            loadOrders()
            loadLinkedDisplays()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, loadOrders, loadLinkedDisplays, supabase, isPaused])

  /* ---- Clock tick ---- */
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  /* ---- Fullscreen handling ---- */
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { })
    } else {
      document.exitFullscreen().catch(() => { })
    }
  }

  /* ---- Sound ---- */
  const playNotificationSound = () => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/notification.mp3')
      }
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => { })
    } catch (e) { /* skip */ }
  }

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrders(prev => new Set(prev).add(orderId))
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (error) {
      showError('Error', 'Failed to update status')
      loadOrders()
    } else {
      success('Updated', `Order moved to ${newStatus}`)
    }

    setUpdatingOrders(prev => {
      const next = new Set(prev)
      next.delete(orderId)
      return next
    })
  }

  const getElapsedTime = (createdAt: string) => {
    const diff = Math.floor((currentTime.getTime() - new Date(createdAt).getTime()) / 1000)
    return {
      mins: Math.floor(diff / 60),
      secs: diff % 60
    }
  }

  const filteredOrders = useMemo(() => {
    let filtered = filter === 'all'
      ? orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status))
      : orders.filter(o => o.status === filter)

    return filtered.sort((a, b) => {
      if (a.is_priority !== b.is_priority) return b.is_priority ? 1 : -1
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  }, [orders, filter])

  const stats2 = useMemo(() => ({
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
  }), [orders])

  const kitchenDisplays = linkedDisplays.filter(display => display.type === 'kitchen')
  const counterDisplays = linkedDisplays.filter(display => display.type === 'counter')
  const cashierDisplays = linkedDisplays.filter(display => display.type === 'cashier')

  if (!restaurantId) {
    return (
      <div className="h-screen bg-[var(--background)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="h-screen bg-[var(--background)] text-[var(--text-secondary)] flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="relative h-20 px-6 flex items-center justify-between z-20 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-2 h-2 rounded-full bg-brand shadow-glow animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand/80">Nexus KDS Live</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
              KITCHEN <span className="text-brand">STATION</span>
            </h1>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg">
            <button
              onClick={() => setMode('kitchen')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                mode === 'kitchen' ? "bg-brand text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              <ChefHat className="w-3.5 h-3.5" />
              Kitchen
            </button>
            <button
              onClick={() => setMode('owner')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                mode === 'owner' ? "bg-brand text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Owner
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg">
            <StatsTab label="New" count={stats2.pending} color="rose" active={filter === 'pending' || filter === 'all'} onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')} />
            <StatsTab label="Prep" count={stats2.preparing} color="amber" active={filter === 'preparing' || filter === 'all'} onClick={() => setFilter(filter === 'preparing' ? 'all' : 'preparing')} />
            <StatsTab label="Ready" count={stats2.ready} color="emerald" active={filter === 'ready' || filter === 'all'} onClick={() => setFilter(filter === 'ready' ? 'all' : 'ready')} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Clock */}
          <div className="flex flex-col items-end px-4 py-1.5 border-r border-[var(--border)]">
            <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Clock</span>
            <div className="text-xl font-bold tabular-nums tracking-tight text-[var(--text-primary)]">
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
          </div>

          {lastUpdate && (
            <span className="text-[10px] text-[var(--text-muted)]">
              Synced {lastUpdate.toLocaleTimeString()}
            </span>
          )}

          <div className="flex gap-2">
            <HeaderButton onClick={toggleFullscreen} icon={isFullscreen ? Minimize : Maximize} tooltip="Fullscreen" />
            <HeaderButton onClick={() => setIsPaused(!isPaused)} icon={isPaused ? Play : Pause} active={isPaused} tooltip={isPaused ? 'Resume' : 'Pause'} />
            <HeaderButton onClick={loadOrders} icon={RefreshCw} active={isSyncing} tooltip="Refresh" />
            <HeaderButton onClick={() => setSoundEnabled(!soundEnabled)} icon={soundEnabled ? Volume2 : VolumeX} active={soundEnabled} tooltip={soundEnabled ? 'Mute' : 'Sound On'} />
          </div>
        </div>
      </header>

      <section className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/70 px-6 py-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StationSyncCard
            icon={ChefHat}
            title="Kitchen displays"
            value={kitchenDisplays.length.toString().padStart(2, '0')}
            tone="orange"
            roles={getDisplayRoleLabels('kitchen')}
            status={kitchenDisplays.some(display => display.is_active) ? 'Live sync' : 'Needs display'}
          />
          <StationSyncCard
            icon={Monitor}
            title="Counter handoff"
            value={counterDisplays.length.toString().padStart(2, '0')}
            tone="cyan"
            roles={getDisplayRoleLabels('counter')}
            status={counterDisplays.some(display => display.is_active) ? 'Ready queue synced' : 'No counter screen'}
          />
          <StationSyncCard
            icon={CreditCard}
            title="Cashier display"
            value={cashierDisplays.length.toString().padStart(2, '0')}
            tone="sky"
            roles={getDisplayRoleLabels('cashier')}
            status={cashierDisplays.some(display => display.is_active) ? 'Billing synced' : 'No cashier screen'}
          />
          <StationSyncCard
            icon={ShieldCheck}
            title="Staff account sync"
            value={isPaused ? 'PAUSED' : 'ON'}
            tone="emerald"
            roles={['Owner', 'Manager', 'Kitchen']}
            status={lastUpdate ? `Last ${lastUpdate.toLocaleTimeString()}` : 'Waiting for first sync'}
          />
        </div>
      </section>

      {/* Main Content */}
      <main className="relative flex-1 flex overflow-hidden z-10">
        {/* Owner Analytics Panel */}
        {mode === 'owner' && (
          <div className="w-72 border-r border-[var(--border)] bg-[var(--surface)] p-5 overflow-y-auto">
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-5 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand" />
              Kitchen Analytics
            </h3>

            <div className="space-y-3">
              <StatCard icon={Target} label="Avg Prep Time" value={`${stats.avgPrepTime} min`} subtext="Current queue" color="text-amber-500" />
              <StatCard icon={TrendingUp} label="Orders Today" value={stats.ordersToday.toString()} subtext="Active + completed" color="text-emerald-500" />
              <StatCard icon={CheckCircle2} label="Completed" value={stats.completedOrders.toString()} subtext="Finished today" color="text-sky-500" />
              <StatCard icon={Clock} label="On-Time Rate" value={`${stats.onTimeRate}%`} subtext="Within target" color="text-brand" />
            </div>

            <div className="mt-6">
              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Recent Activity</h4>
              <div className="space-y-2">
                {orders.slice(0, 5).map(order => (
                  <div key={order.id} className="p-3 bg-[var(--surface-raised)] rounded-lg border border-[var(--border)]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[var(--text-primary)]">#{order.order_number}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-1">
                      {getElapsedTime(order.created_at).mins}m elapsed
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Orders Feed */}
        <div className={cn("flex-1 p-6 overflow-x-auto flex gap-5", mode === 'owner' ? 'scroll-smooth' : 'scroll-smooth')}>
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-brand animate-spin mb-4" />
              <p className="text-[var(--text-muted)]">Loading kitchen orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
              <div className="w-24 h-24 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center mb-6">
                <UtensilsCrossed className="w-10 h-10 text-[var(--text-muted)]" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Station Clear</h2>
              <p className="text-[var(--text-muted)] max-w-sm text-sm">
                No active tickets. New orders will appear automatically.
              </p>
              <div className="mt-6 grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-3">
                <EmptyStateMetric label="Kitchen screens" value={kitchenDisplays.filter(display => display.is_active).length} />
                <EmptyStateMetric label="Counter screens" value={counterDisplays.filter(display => display.is_active).length} />
                <EmptyStateMetric label="Cashier screens" value={cashierDisplays.filter(display => display.is_active).length} />
              </div>
            </div>
          ) : (
            filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                elapsed={getElapsedTime(order.created_at)}
                onAction={handleStatusChange}
                isUpdating={updatingOrders.has(order.id)}
              />
            ))
          )}
        </div>
      </main>
    </div>
  )
}

/* ============================================
  STATION SUMMARY
  ============================================ */

function StationSyncCard({
  icon: Icon,
  title,
  value,
  tone,
  roles,
  status,
}: {
  icon: React.ElementType
  title: string
  value: string
  tone: 'orange' | 'cyan' | 'sky' | 'emerald'
  roles: string[]
  status: string
}) {
  const toneMap = {
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
    sky: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  }[tone]

  return (
    <div className={cn("rounded-xl border bg-[var(--surface-raised)] p-4", toneMap.border)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneMap.bg, toneMap.text)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--text-primary)]">{title}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{status}</p>
          </div>
        </div>
        <p className={cn("text-2xl font-black leading-none tabular-nums", toneMap.text)}>{value}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {roles.map(role => (
          <span key={role} className="rounded-md bg-[var(--surface-active)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
            {role}
          </span>
        ))}
      </div>
    </div>
  )
}

function EmptyStateMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3">
      <p className="text-xl font-black text-[var(--text-primary)]">{value.toString().padStart(2, '0')}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
    </div>
  )
}

/* ============================================
  ORDER CARD
  ============================================ */

function OrderCard({ order, elapsed, onAction, isUpdating }: {
  order: Order
  elapsed: { mins: number, secs: number }
  onAction: (id: string, s: OrderStatus) => void
  isUpdating: boolean
}) {
  const isCritical = elapsed.mins >= 12
  const isWarning = elapsed.mins >= 8 && elapsed.mins < 12
  const cfg = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending

  return (
    <div className="w-[380px] shrink-0 h-full flex flex-col">
      <div className={cn(
        "flex-1 flex flex-col rounded-xl border bg-[var(--surface-raised)] transition-all overflow-hidden",
        order.is_priority ? "border-rose-500/40 shadow-glow" : "border-[var(--border)]",
        isCritical && "border-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.15)]"
      )}>
        {/* Status Bar */}
        <div className={cn("h-1.5", cfg.bar)} />

        {/* Header */}
        <div className="p-5 pb-3 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col items-center justify-center">
              <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase">Order</span>
              <span className="text-xl font-bold text-[var(--text-primary)]">#{order.order_number}</span>
            </div>
            <div className="pt-1">
              <span className={cn("inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider border mb-1.5", cfg.bg, cfg.color, cfg.border)}>
                {cfg.label}
              </span>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase">
                {order.table_id ? (
                  <>
                    <LayoutGrid className="w-3 h-3" />
                    Table {order.table?.table_number || '#'}
                  </>
                ) : (
                  <>
                    <Truck className="w-3 h-3 text-brand" />
                    <span className="text-purple-400">Delivery</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Timer */}
          <div className={cn(
            "flex items-center gap-1.5 text-xl font-bold tabular-nums",
            isCritical ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-[var(--text-primary)]'
          )}>
            <Timer className="w-4 h-4 opacity-40" />
            {elapsed.mins.toString().padStart(2, '0')}:
            <span className="text-base opacity-60">{elapsed.secs.toString().padStart(2, '0')}</span>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 px-5 py-3 space-y-2 overflow-y-auto">
          {order.is_priority && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex gap-2">
              <Flame className="w-4 h-4 text-rose-500 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Priority</p>
                <p className="text-xs text-rose-300/80">Rush order</p>
              </div>
            </div>
          )}

          {order.items?.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <div className="w-9 h-9 rounded-md bg-[var(--surface-active)] flex items-center justify-center text-sm font-bold text-brand">
                {item.quantity}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{item.menu_item?.name || 'Item'}</p>
                {item.special_instructions && (
                  <p className="text-[10px] text-rose-400 mt-0.5 flex items-center gap-1">
                    <Info className="w-3 h-3" /> {item.special_instructions}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Footer */}
        <div className="p-5 bg-[var(--surface)] border-t border-[var(--border)]">
          {order.status === 'pending' && (
            <button
              onClick={() => onAction(order.id, 'preparing')}
              disabled={isUpdating}
              className="w-full h-12 rounded-xl bg-brand hover:bg-brand-hover text-[var(--text-primary)] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 shadow-glow transition-all"
            >
              <ChefHat className="w-5 h-5" /> Cook Now
            </button>
          )}
          {order.status === 'preparing' && (
            <button
              onClick={() => onAction(order.id, 'ready')}
              disabled={isUpdating}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-[var(--text-primary)] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              <CheckCircle2 className="w-5 h-5" /> Order Ready
            </button>
          )}
          {order.status === 'ready' && (
            <button
              onClick={() => onAction(order.id, 'served')}
              disabled={isUpdating}
              className="w-full h-12 rounded-xl bg-sky-600 hover:bg-sky-500 text-[var(--text-primary)] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {order.table_id ? <Bell className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
              {order.table_id ? 'Call Waiter' : 'Hand Off'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================
  HELPER COMPONENTS
  ============================================ */

function StatsTab({ label, count, color, active, onClick }: { label: string, count: number, color: string, active: boolean, onClick: () => void }) {
  const dotColor = color === 'rose' ? 'bg-rose-500' : color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
  const textColor = active ? (color === 'rose' ? 'text-rose-500' : color === 'amber' ? 'text-amber-500' : 'text-emerald-500') : 'text-[var(--text-primary)]'

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all",
        active ? "bg-[var(--surface-hover)] border border-[var(--border-strong)]" : "opacity-50 hover:opacity-100"
      )}
    >
      <div className="flex flex-col items-start">
        <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)] leading-none mb-0.5">{label}</span>
        <span className={cn("text-base font-bold tabular-nums leading-none", textColor)}>
          {count.toString().padStart(2, '0')}
        </span>
      </div>
      <div className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
    </button>
  )
}

function HeaderButton({ onClick, icon: Icon, active = false, tooltip }: { onClick: () => void, icon: React.ElementType, active?: boolean, tooltip?: string }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
      className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center transition-all border",
        active
          ? "bg-brand border-brand text-[var(--text-primary)]"
          : "bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

function StatCard({ icon: Icon, label, value, subtext, color }: { icon: React.ElementType, label: string, value: string, subtext: string, color: string }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)]">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={cn("p-1.5 rounded-md bg-[var(--surface)]", color)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-semibold text-[var(--text-muted)]">{label}</span>
      </div>
      <p className={cn("text-xl font-bold", color)}>{value}</p>
      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{subtext}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status as keyof typeof statusConfig]
  return (
    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border", cfg?.bg, cfg?.color, cfg?.border)}>
      {cfg?.label || status}
    </span>
  )
}
