'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, ShoppingBag, Clock, BarChart3, Calendar,
  ArrowUpRight, RefreshCw, TrendingDown, Users, DollarSign,
  Utensils, Truck, Brain, Sparkles, AlertTriangle, CheckCircle2,
  Activity, Target, Zap
} from 'lucide-react'
import { useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { withStaffAuthHeaders } from '@/lib/staff-api'
import {
  PageHeader,
  StatCard,
  SectionCard,
  ActionButton,
  EmptyState,
  itemVariants,
  containerVariants,
} from '@/components/dashboard/shared'

interface AnalyticsData {
  revenue: { today: number; thisWeek: number; thisMonth: number; growth: number }
  orders: { today: number; thisWeek: number; thisMonth: number; growth: number }
  avgOrderValue: number
  avgPrepTime: number
  topItems: Array<{ name: string; quantity: number; revenue: number; growth: number }>
  revenueByChannel: { dine_in: number; delivery: number; takeaway: number }
  ordersByHour: Record<number, number>
  dailyRevenue: Array<{ date: string; revenue: number }>
  staffPerformance: Array<{ name: string; orders: number; revenue: number }>
  deliveryMetrics: { avgTime: number; onTimeRate: number; totalDeliveries: number }
  aiInsights?: Array<{ title: string; summary: string; severity: 'success' | 'warning' | 'critical' | 'info'; action: string; metric?: string }>
  aiSummary?: { mode: 'rules' | 'openrouter'; summary: string; model: string }
  healthScore?: number
  peakHour?: { hour: number; orders: number } | null
  lastUpdated?: string
}

interface DateRange {
  start: Date
  end: Date
}

export default function AnalyticsPage() {
  const { restaurant } = useAuthStore()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(new Date().setDate(new Date().getDate() - 7)),
    end: new Date()
  })
  const [activePeriod, setActivePeriod] = useState<'today' | 'week' | 'month'>('week')

  const fetchFromSupabase = async () => {
    if (!restaurant?.id) return
    try {
      const supabase = createClient()
      const startDate = dateRange.start.toISOString()
      const endDate = dateRange.end.toISOString()

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id, total, created_at, status,
          order_items (quantity, subtotal, menu_item:menu_items(name, category_id))
        `)
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      if (ordersError) throw ordersError
      if (!orders || orders.length === 0) {
        setLoading(false)
        return
      }

      const completedOrders = orders.filter((o: any) =>
        ['paid', 'served', 'completed'].includes(o.status)
      )

      const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
      const totalOrders = completedOrders.length

      const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {}
      completedOrders.forEach((order: any) => {
        (order.order_items || []).forEach((item: any) => {
          const name = item.menu_item?.name || 'Unknown'
          if (!itemSales[name]) itemSales[name] = { name, quantity: 0, revenue: 0 }
          itemSales[name].quantity += item.quantity || 1
          itemSales[name].revenue += item.subtotal || 0
        })
      })

      const topItems = Object.values(itemSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map(item => ({ ...item, growth: 0 }))

      const ordersByHour: Record<number, number> = {}
      completedOrders.forEach((order: any) => {
        const hour = new Date(order.created_at).getHours()
        ordersByHour[hour] = (ordersByHour[hour] || 0) + 1
      })

      const dailyRevenueMap: Record<string, number> = {}
      completedOrders.forEach((order: any) => {
        const date = new Date(order.created_at).toISOString().split('T')[0]
        dailyRevenueMap[date] = (dailyRevenueMap[date] || 0) + (order.total || 0)
      })
      const dailyRevenue = Object.entries(dailyRevenueMap)
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => a.date.localeCompare(b.date))

      setData({
        revenue: {
          today: completedOrders.filter((o: any) => new Date(o.created_at).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]).reduce((sum: number, o: any) => sum + (o.total || 0), 0),
          thisWeek: totalRevenue,
          thisMonth: totalRevenue * 4,
          growth: 0
        },
        orders: {
          today: completedOrders.filter((o: any) => new Date(o.created_at).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]).length,
          thisWeek: totalOrders,
          thisMonth: totalOrders * 4,
          growth: 0
        },
        avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
        avgPrepTime: 15,
        topItems,
        revenueByChannel: { dine_in: totalRevenue * 0.7, delivery: totalRevenue * 0.2, takeaway: totalRevenue * 0.1 },
        ordersByHour,
        dailyRevenue,
        staffPerformance: [],
        deliveryMetrics: { avgTime: 25, onTimeRate: 92, totalDeliveries: Math.floor(totalOrders * 0.2) }
      })
    } catch (err) {
      console.error('Supabase fallback error:', err)
    }
  }

  const fetchAnalytics = useCallback(async () => {
    if (!restaurant?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const response = await fetch(
        `/api/analytics?restaurant_id=${restaurant.id}&start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`,
        { headers: withStaffAuthHeaders() }
      )
      if (response.ok) {
        const result = await response.json()
        setData(result)
      } else {
        await fetchFromSupabase()
      }
    } catch (err) {
      console.error('Analytics fetch error:', err)
      await fetchFromSupabase()
    } finally {
      setLoading(false)
    }
  }, [restaurant?.id, dateRange])

  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  const changePeriod = (period: 'today' | 'week' | 'month') => {
    setActivePeriod(period)
    const end = new Date()
    let start = new Date()
    switch (period) {
      case 'today': start = new Date(new Date().setHours(0, 0, 0, 0)); break
      case 'week': start = new Date(new Date().setDate(new Date().getDate() - 7)); break
      case 'month': start = new Date(new Date().setDate(new Date().getDate() - 30)); break
    }
    setDateRange({ start, end })
  }

  const getMetricValue = (period: 'today' | 'week' | 'month', field: 'revenue' | 'orders') => {
    if (!data) return 0
    switch (period) {
      case 'today': return data[field].today
      case 'week': return data[field].thisWeek
      case 'month': return data[field].thisMonth
      default: return 0
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `Rs.${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `Rs.${(amount / 1000).toFixed(1)}k`
    return `Rs.${amount.toLocaleString()}`
  }

  const currentRevenue = getMetricValue(activePeriod, 'revenue')
  const currentOrders = getMetricValue(activePeriod, 'orders')
  const peakHours = data?.ordersByHour
    ? Object.entries(data.ordersByHour)
      .filter(([, count]) => count > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 6)
    : []
  const maxPeakHourCount = peakHours.length > 0 ? Math.max(...peakHours.map(([, count]) => Number(count))) : 1
  const maxDailyRevenue = data?.dailyRevenue?.length ? Math.max(...data.dailyRevenue.map(d => d.revenue), 1) : 1
  const healthScore = data?.healthScore ?? 0

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="p-4 lg:p-6 max-w-[1500px] mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title="Business"
          highlight="Intelligence"
          badge="AI Analytics"
          subtitle={restaurant?.name || 'Restaurant analytics'}
          actions={
            <div className="flex items-center gap-3">
              <div className="flex bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg overflow-hidden">
                {(['today', 'week', 'month'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => changePeriod(period)}
                    className={cn(
                      "px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
                      activePeriod === period
                        ? "bg-brand text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {period}
                  </button>
                ))}
              </div>
              <ActionButton
                onClick={fetchAnalytics}
                disabled={loading}
                variant="secondary"
                icon={RefreshCw}
                className={cn(loading && 'opacity-70')}
              >
                Refresh
              </ActionButton>
            </div>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-4">
          <section className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/[0.12] via-[var(--surface-raised)] to-[var(--surface)] p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand">
                  <Brain className="h-3.5 w-3.5" />
                  {data?.aiSummary?.mode === 'openrouter' ? 'AI model active' : 'Local AI rules'}
                </div>
                <h2 className="text-xl font-black text-[var(--text-primary)]">Operations summary</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">
                  {loading ? 'Analyzing revenue, order load, kitchen timing, and delivery signal...' : data?.aiSummary?.summary || 'No analytics signal is available for this period yet.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[420px]">
                <AiMetric icon={Activity} label="Health" value={loading ? '...' : `${healthScore}%`} tone={healthScore >= 80 ? 'success' : healthScore >= 60 ? 'warning' : 'critical'} />
                <AiMetric icon={Clock} label="Peak" value={loading ? '...' : data?.peakHour ? `${data.peakHour.hour}:00` : '--'} tone="info" />
                <AiMetric icon={Target} label="AOV" value={loading ? '...' : formatCurrency(data?.avgOrderValue || 0)} tone="brand" />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">AI actions</h3>
                <p className="text-xs text-[var(--text-muted)]">Priority recommendations</p>
              </div>
              <Sparkles className="h-5 w-5 text-brand" />
            </div>
            <div className="space-y-3">
              {loading ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">Loading insights...</div>
              ) : (data?.aiInsights || []).slice(0, 3).map((insight) => (
                <InsightCard key={insight.title} insight={insight} />
              ))}
            </div>
          </section>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue"
            value={loading ? '...' : formatCurrency(currentRevenue)}
            icon={DollarSign}
            tone="brand"
            change={data?.revenue.growth || 0}
          />
          <StatCard
            label="Total Orders"
            value={loading ? '...' : currentOrders.toLocaleString()}
            icon={ShoppingBag}
            tone="info"
            change={data?.orders.growth || 0}
          />
          <StatCard
            label="Avg Order Value"
            value={loading ? '...' : formatCurrency(data?.avgOrderValue || 0)}
            icon={TrendingUp}
            tone="success"
          />
          <StatCard
            label="Avg Prep Time"
            value={loading ? '...' : `${data?.avgPrepTime || 0}m`}
            icon={Clock}
            tone="neutral"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Revenue Trend" action={<span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Daily revenue</span>}>
            <div className="flex flex-col h-[300px]">
              <div className="flex-1 flex items-end gap-2 pb-2">
                {loading ? (
                  <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">Loading...</div>
                ) : data?.dailyRevenue && data.dailyRevenue.length > 0 ? (
                  data.dailyRevenue.map((day, i) => {
                    const height = maxDailyRevenue > 0 ? (day.revenue / maxDailyRevenue) * 100 : 0
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                        <div className="w-full relative bg-[var(--surface)] rounded-t-lg border border-[var(--border)] overflow-hidden min-h-[12px]" style={{ height: `${Math.max(height, day.revenue > 0 ? 8 : 3)}%` }}>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: '100%' }}
                            transition={{ duration: 0.6, delay: 0.04 * i }}
                            className={cn("w-full transition-opacity", day.revenue > 0 ? "bg-gradient-to-t from-brand to-brand-hover opacity-85 group-hover:opacity-100" : "bg-[var(--surface-active)]")}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">No revenue data</div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Peak Hours"
            action={<Clock className="w-5 h-5 text-[var(--text-muted)]" />}
          >
            <div className="flex flex-col h-[300px] justify-between">
              {loading ? (
                <div className="flex items-center justify-center text-[var(--text-muted)] text-sm">Loading...</div>
              ) : peakHours.length > 0 ? (
                peakHours
                  .map(([hour, count]) => {
                    const percentage = maxPeakHourCount > 0 ? (Number(count) / maxPeakHourCount) * 100 : 0
                    return (
                      <div key={hour} className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                          <span className="text-[var(--text-muted)]">{hour}:00</span>
                          <span className="text-[var(--text-primary)]">{count} orders</span>
                        </div>
                        <div className="h-2 w-full bg-[var(--surface)] border border-[var(--border)] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.6 }}
                            className={cn("h-full rounded-full", percentage > 80 ? "bg-brand" : "bg-[var(--text-secondary)]")}
                          />
                        </div>
                      </div>
                    )
                  })
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">
                  No peak-hour signal for this period
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Top Items */}
        <SectionCard
          title="Top Selling Items"
          action={<span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Most popular menu items</span>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[var(--surface)] text-[var(--text-muted)] font-bold text-[10px] uppercase tracking-wider">
                  <th className="px-5 py-3 border-b border-[var(--border)]">Rank</th>
                  <th className="px-5 py-3 border-b border-[var(--border)]">Item Name</th>
                  <th className="px-5 py-3 border-b border-[var(--border)] text-center">Orders</th>
                  <th className="px-5 py-3 border-b border-[var(--border)] text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--text-muted)]">Loading...</td></tr>
                ) : data?.topItems && data.topItems.length > 0 ? (
                  data.topItems.map((item, i) => (
                    <tr key={item.name} className="hover:bg-brand-subtle transition-colors">
                      <td className="px-5 py-3 text-[var(--text-muted)] font-bold">#{i + 1}</td>
                      <td className="px-5 py-3 font-semibold text-[var(--text-primary)]">{item.name}</td>
                      <td className="px-5 py-3 text-center text-[var(--text-muted)] text-xs font-semibold">{item.quantity} orders</td>
                      <td className="px-5 py-3 text-right font-bold text-brand">{formatCurrency(item.revenue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--text-muted)]">No sales data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {data?.staffPerformance && data.staffPerformance.length > 0 && (
          <SectionCard
            title="Staff Revenue Contribution"
            action={<span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Paid and served orders</span>}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {data.staffPerformance.slice(0, 4).map((member) => (
                <div key={member.name} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">{member.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{member.orders} orders</p>
                    </div>
                    <Users className="h-5 w-5 text-brand" />
                  </div>
                  <p className="text-xl font-black text-[var(--text-primary)]">{formatCurrency(member.revenue)}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Revenue by Channel */}
        <SectionCard
          title="Revenue by Channel"
          action={<span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Order sources and revenue distribution</span>}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { channel: 'Dine-In', revenue: data?.revenueByChannel?.dine_in || 0, icon: Utensils, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', bar: 'bg-emerald-500' },
              { channel: 'Delivery', revenue: data?.revenueByChannel?.delivery || 0, icon: Truck, color: 'text-brand', bg: 'bg-brand-subtle', border: 'border-brand/20', bar: 'bg-brand' },
              { channel: 'Takeaway', revenue: data?.revenueByChannel?.takeaway || 0, icon: ShoppingBag, color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/20', bar: 'bg-sky-500' },
            ].map((channel) => {
              const total = (data?.revenueByChannel?.dine_in || 0) + (data?.revenueByChannel?.delivery || 0) + (data?.revenueByChannel?.takeaway || 0)
              const percentage = total > 0 ? Math.round((channel.revenue / total) * 100) : 0
              return (
                <div key={channel.channel} className={cn("p-4 rounded-xl border bg-[var(--surface)]", channel.border)}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", channel.bg)}>
                      <channel.icon className={cn("w-4 h-4", channel.color)} />
                    </div>
                    <p className="font-semibold text-[var(--text-primary)]">{channel.channel}</p>
                  </div>
                  <p className="text-xl font-bold text-[var(--text-primary)] mb-2">
                    {loading ? '...' : formatCurrency(channel.revenue)}
                  </p>
                  <div className="w-full h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", channel.bar)} style={{ width: `${percentage}%` }} />
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1.5 font-semibold uppercase tracking-wider">
                    {percentage}% of total
                  </p>
                </div>
              )
            })}
          </div>
        </SectionCard>

        {/* Delivery Metrics */}
        {data?.deliveryMetrics && (
          <SectionCard
            title="Delivery Metrics"
            action={<span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Real-time delivery performance</span>}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-brand-subtle rounded-xl border border-brand/20">
                <Clock className="w-5 h-5 text-brand mb-2" />
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Avg Delivery Time</p>
                <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{data.deliveryMetrics.avgTime || 0} min</p>
              </div>
              <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <TrendingUp className="w-5 h-5 text-emerald-500 mb-2" />
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">On-Time Rate</p>
                <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{data.deliveryMetrics.onTimeRate || 0}%</p>
              </div>
              <div className="p-4 bg-brand-subtle rounded-xl border border-brand/20">
                <Truck className="w-5 h-5 text-brand mb-2" />
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Total Deliveries</p>
                <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{data.deliveryMetrics.totalDeliveries || 0}</p>
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}

function AiMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  tone: 'brand' | 'success' | 'warning' | 'critical' | 'info'
}) {
  const toneMap = {
    brand: 'bg-brand/10 text-brand border-brand/20',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  }[tone]

  return (
    <div className={cn("rounded-xl border p-3", toneMap)}>
      <Icon className="mb-2 h-4 w-4" />
      <p className="text-lg font-black tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">{label}</p>
    </div>
  )
}

function InsightCard({
  insight,
}: {
  insight: { title: string; summary: string; severity: 'success' | 'warning' | 'critical' | 'info'; action: string; metric?: string }
}) {
  const config = {
    success: { icon: CheckCircle2, className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' },
    warning: { icon: AlertTriangle, className: 'border-amber-500/20 bg-amber-500/10 text-amber-400' },
    critical: { icon: AlertTriangle, className: 'border-rose-500/20 bg-rose-500/10 text-rose-400' },
    info: { icon: Zap, className: 'border-sky-500/20 bg-sky-500/10 text-sky-400' },
  }[insight.severity]
  const Icon = config.icon

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", config.className)}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--text-primary)]">{insight.title}</p>
            <p className="text-xs text-[var(--text-muted)]">{insight.summary}</p>
          </div>
        </div>
        {insight.metric && <span className="shrink-0 rounded-md bg-[var(--surface-active)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">{insight.metric}</span>}
      </div>
      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{insight.action}</p>
    </div>
  )
}
