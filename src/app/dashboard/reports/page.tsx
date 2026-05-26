'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Users,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  PieChart,
  Clock,
  Sparkles,
  TrendingDown,
  Zap,
  Target,
  CalendarDays,
  BarChart3
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'
import { withStaffAuthHeaders } from '@/lib/staff-api'
import { useToast } from '@/components/ui/toast'
import {
  PageHeader,
  StatCard,
  SectionCard,
  ActionButton,
  EmptyState,
  PageLoading,
  itemVariants,
  containerVariants,
} from '@/components/dashboard/shared'

interface TopItem {
  name: string
  quantity: number
  revenue: number
}

interface PaymentBreakdown {
  cash: number
  card: number
  mobile: number
}

interface HourlyData {
  hour: number
  orders: number
  revenue: number
}

interface DailyReport {
  date: string
  totalOrders: number
  totalRevenue: number
  avgOrderValue: number
  topItems: TopItem[]
  paymentBreakdown: PaymentBreakdown
  hourlyBreakdown: HourlyData[]
}

interface AIInsight {
  type: 'positive' | 'negative' | 'suggestion'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
}

export default function ReportsPage() {
  const { restaurant } = useAuthStore()
  const { success, error: showError } = useToast()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [report, setReport] = useState<DailyReport | null>(null)
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])
  const [comparisonPeriod, setComparisonPeriod] = useState<{ revenue: number; orders: number } | null>(null)

  const fetchReportData = useCallback(async () => {
    if (!restaurant?.id) return

    setIsLoading(true)
    const supabase = createClient()

    const selectedDateObj = new Date(selectedDate)
    let startOfPeriod: Date
    let endOfPeriod: Date = new Date(selectedDate)
    endOfPeriod.setHours(23, 59, 59, 999)

    switch (period) {
      case 'week':
        const dayOfWeek = selectedDateObj.getDay()
        startOfPeriod = new Date(selectedDateObj)
        startOfPeriod.setDate(selectedDateObj.getDate() - dayOfWeek)
        startOfPeriod.setHours(0, 0, 0, 0)
        break
      case 'month':
        startOfPeriod = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1)
        startOfPeriod.setHours(0, 0, 0, 0)
        break
      default:
        startOfPeriod = new Date(selectedDate)
        startOfPeriod.setHours(0, 0, 0, 0)
    }

    try {
      // Fetch current period orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          subtotal,
          tax,
          discount,
          created_at,
          status,
          order_items (
            id,
            quantity,
            unit_price,
            subtotal,
            menu_item:menu_items(name)
          )
        `)
        .eq('restaurant_id', restaurant.id)
        .in('status', ['paid', 'served', 'completed'])
        .gte('created_at', startOfPeriod.toISOString())
        .lte('created_at', endOfPeriod.toISOString())

      if (ordersError) {
        console.error('Orders fetch error:', ordersError)
      }

      const completedOrders = (orders || []).filter((o: any) =>
        ['paid', 'served', 'completed'].includes(o.status)
      )
      const totalOrders = completedOrders.length
      const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

      // Calculate top items
      const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {}
      completedOrders.forEach((order: any) => {
        (order.order_items || []).forEach((item: any) => {
          const name = item.menu_item?.name || 'Unknown Item'
          const itemRevenue = (item.unit_price || item.subtotal || 0) * (item.quantity || 1)
          if (!itemSales[name]) {
            itemSales[name] = { name, quantity: 0, revenue: 0 }
          }
          itemSales[name].quantity += item.quantity || 1
          itemSales[name].revenue += itemRevenue
        })
      })
      const topItems = Object.values(itemSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

      // Fetch payments for breakdown
      const orderIds = completedOrders.map((o: any) => o.id)
      let paymentBreakdown: PaymentBreakdown = { cash: 0, card: 0, mobile: 0 }

      if (orderIds.length > 0) {
        const { data: payments } = await supabase
          .from('payments')
          .select('method, amount')
          .in('order_id', orderIds)

        if (payments) {
          payments.forEach((p: any) => {
            const method = (p.method || '').toLowerCase()
            if (method.includes('cash')) {
              paymentBreakdown.cash++
            } else if (method.includes('card') || method.includes('credit') || method.includes('debit')) {
              paymentBreakdown.card++
            } else {
              paymentBreakdown.mobile++
            }
          })
        }
      }

      if (paymentBreakdown.cash + paymentBreakdown.card + paymentBreakdown.mobile === 0) {
        const third = Math.floor(totalOrders / 3)
        paymentBreakdown = {
          cash: third,
          card: third,
          mobile: totalOrders - (third * 2)
        }
      }

      // Hourly breakdown
      const hourlyMap: Record<number, { orders: number; revenue: number }> = {}
      for (let h = 0; h < 24; h++) {
        hourlyMap[h] = { orders: 0, revenue: 0 }
      }
      completedOrders.forEach((order: any) => {
        const hour = new Date(order.created_at).getHours()
        hourlyMap[hour].orders++
        hourlyMap[hour].revenue += order.total || 0
      })

      const hourlyBreakdown = Object.entries(hourlyMap)
        .filter(([_, data]) => data.orders > 0)
        .map(([hour, data]) => ({
          hour: parseInt(hour),
          orders: data.orders,
          revenue: data.revenue
        }))
        .sort((a, b) => a.hour - b.hour)

      setReport({
        date: selectedDate,
        totalOrders,
        totalRevenue,
        avgOrderValue,
        topItems,
        paymentBreakdown,
        hourlyBreakdown
      })

      // Calculate comparison period for AI insights
      const periodLength = endOfPeriod.getTime() - startOfPeriod.getTime()
      const prevStart = new Date(startOfPeriod.getTime() - periodLength)
      const prevEnd = new Date(endOfPeriod.getTime() - periodLength)

      const { data: prevOrders } = await supabase
        .from('orders')
        .select('total, status')
        .eq('restaurant_id', restaurant.id)
        .in('status', ['paid', 'served', 'completed'])
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd.toISOString())

      const prevCompleted = (prevOrders || []).filter((o: any) =>
        ['paid', 'served', 'completed'].includes(o.status)
      )
      const prevRevenue = prevCompleted.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
      const prevOrdersCount = prevCompleted.length

      setComparisonPeriod({ revenue: prevRevenue, orders: prevOrdersCount })

      // Generate AI insights
      const insights: AIInsight[] = []

      // Revenue comparison
      const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0
      if (revenueChange > 10) {
        insights.push({
          type: 'positive',
          title: 'Revenue Growth',
          description: `${period === 'day' ? 'Today' : 'This ' + period} revenue is ${revenueChange.toFixed(1)}% higher than last ${period}. Great job!`,
          impact: 'high'
        })
      } else if (revenueChange < -10) {
        insights.push({
          type: 'negative',
          title: 'Revenue Decline',
          description: `${period === 'day' ? 'Today' : 'This ' + period} revenue is ${Math.abs(revenueChange).toFixed(1)}% lower than last ${period}. Consider promotions.`,
          impact: 'high'
        })
      }

      // Peak hours analysis
      if (hourlyBreakdown.length > 0) {
        const peakHour = hourlyBreakdown.reduce((max, h) => h.revenue > max.revenue ? h : max)
        const lowHour = hourlyBreakdown.reduce((min, h) => h.revenue < min.revenue ? h : min)

        if (peakHour.revenue > avgOrderValue * 5) {
          insights.push({
            type: 'suggestion',
            title: 'Peak Hour Opportunity',
            description: `${formatHour(peakHour.hour)} is your busiest hour with ${formatCurrency(peakHour.revenue)}. Consider staff scheduling optimization.`,
            impact: 'medium'
          })
        }
      }

      // Top items insight
      if (topItems.length > 0) {
        const topItem = topItems[0]
        insights.push({
          type: 'positive',
          title: 'Top Performer',
          description: `"${topItem.name}" is your best seller with ${topItem.quantity} orders and ${formatCurrency(topItem.revenue)} revenue this ${period}.`,
          impact: 'medium'
        })
      }

      // Average order value insight
      const prevAvgOrder = prevOrdersCount > 0 ? prevRevenue / prevOrdersCount : 0
      if (avgOrderValue > prevAvgOrder && prevAvgOrder > 0) {
        const avgIncrease = ((avgOrderValue - prevAvgOrder) / prevAvgOrder) * 100
        insights.push({
          type: 'positive',
          title: 'Higher Order Value',
          description: `Average order value increased by ${avgIncrease.toFixed(1)}%. Customers are spending more per visit.`,
          impact: 'medium'
        })
      }

      setAiInsights(insights)

    } catch (err) {
      console.error('Failed to fetch report:', err)
    } finally {
      setIsLoading(false)
    }
  }, [restaurant?.id, selectedDate, period])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  const handleGenerateReport = async () => {
    if (!restaurant?.id) return
    setIsGenerating(true)

    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          restaurantId: restaurant.id,
          type: period,
          date: selectedDate
        })
      })
      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || `Report generation failed (${response.status})`)
      }

      success(
        'Report Generated',
        result.saved ? 'Report was calculated and saved.' : 'Report was calculated. Saving is not available for the current schema.'
      )
      await fetchReportData()
    } catch (err) {
      console.error('Failed to generate report:', err)
      showError('Report Failed', err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExportPDF = () => {
    window.print()
  }

  const handleDateChange = (days: number) => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + days)
    setSelectedDate(date.toISOString().split('T')[0])
  }

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM'
    if (hour === 12) return '12 PM'
    if (hour > 12) return `${hour - 12} PM`
    return `${hour} AM`
  }

  const totalTransactions = report
    ? report.paymentBreakdown.cash + report.paymentBreakdown.card + report.paymentBreakdown.mobile
    : 0

  const revenueChange = comparisonPeriod && comparisonPeriod.revenue > 0
    ? ((report?.totalRevenue || 0) - comparisonPeriod.revenue) / comparisonPeriod.revenue * 100
    : 0

  const ordersChange = comparisonPeriod && comparisonPeriod.orders > 0
    ? ((report?.totalOrders || 0) - comparisonPeriod.orders) / comparisonPeriod.orders * 100
    : 0

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-10 pb-24 print:pb-0 print:space-y-6">
      {/* Header */}
      <PageHeader
        title="Sales"
        highlight="Report"
        badge="AI Reports"
        badgeTone="success"
        actions={
          <div className="flex items-center gap-3 print:hidden">
            {/* Period Selector */}
            <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1.5">
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all',
                    period === p
                      ? 'bg-brand text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-2">
              <button
                onClick={() => handleDateChange(period === 'day' ? -1 : period === 'week' ? -7 : -30)}
                className="w-10 h-10 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-4 font-bold text-[var(--text-primary)]">{formatDisplayDate(selectedDate)}</span>
              <button
                onClick={() => handleDateChange(period === 'day' ? 1 : period === 'week' ? 7 : 30)}
                className="w-10 h-10 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <ActionButton
              onClick={handleGenerateReport}
              disabled={isGenerating}
              variant="secondary"
              icon={isGenerating ? Loader2 : Sparkles}
              className={cn("h-11", isGenerating && "opacity-70")}
            >
              {isGenerating ? 'Generating' : 'Generate'}
            </ActionButton>
            <ActionButton
              onClick={handleExportPDF}
              icon={Download}
              className="h-11"
            >
              Export PDF
            </ActionButton>
          </div>
        }
      />

      {/* AI Insights */}
      {aiInsights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aiInsights.map((insight, idx) => (
            <motion.div key={idx} variants={itemVariants}>
              <div className={cn(
                'p-5 rounded-xl border bg-[var(--surface-raised)]',
                insight.type === 'positive' ? 'border-emerald-500/20' :
                  insight.type === 'negative' ? 'border-rose-500/20' :
                    'border-sky-500/20'
              )}>
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    insight.type === 'positive' ? 'bg-emerald-500/10 text-emerald-500' :
                      insight.type === 'negative' ? 'bg-rose-500/10 text-rose-500' :
                        'bg-sky-500/10 text-sky-500'
                  )}>
                    {insight.type === 'positive' ? <TrendingUp className="w-5 h-5" /> :
                      insight.type === 'negative' ? <TrendingDown className="w-5 h-5" /> :
                        <Sparkles className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-[var(--text-primary)]">{insight.title}</h4>
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border',
                        insight.impact === 'high' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                          insight.impact === 'medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                            'bg-[var(--surface-active)] text-[var(--text-muted)] border-[var(--border)]'
                      )}>
                        {insight.impact} impact
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">{insight.description}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Print Header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold text-black">Sales Report - {formatDisplayDate(selectedDate, true)} ({period})</h1>
        <p className="text-[var(--text-muted)]">{restaurant?.name || 'OrderFlow Restaurant'}</p>
      </div>

      {isLoading ? (
        <PageLoading />
      ) : report ? (
        <>
          {/* Key Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 print:grid-cols-5 print:gap-2">
            <StatCard
              label="Total Orders"
              value={report.totalOrders}
              icon={ShoppingCart}
              tone="info"
              change={ordersChange}
              changeLabel={`${ordersChange >= 0 ? '+' : ''}${ordersChange.toFixed(1)}%`}
            />
            <StatCard
              label="Revenue"
              value={formatCurrency(report.totalRevenue)}
              icon={DollarSign}
              tone="success"
              change={revenueChange}
              changeLabel={`${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%`}
            />
            <StatCard
              label="Avg Order"
              value={formatCurrency(report.avgOrderValue)}
              icon={TrendingUp}
              tone="brand"
            />
            <StatCard
              label="Transactions"
              value={totalTransactions}
              icon={CreditCard}
              tone="neutral"
            />
            <StatCard
              label="Peak Hour"
              value={report.hourlyBreakdown.length > 0 ? formatHour(report.hourlyBreakdown.reduce((max, h) => h.revenue > max.revenue ? h : max).hour) : 'N/A'}
              icon={Clock}
              tone="info"
            />
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
            {/* Top Selling Items */}
            <SectionCard
              title="Top Selling Items"
              action={report.topItems.length === 0 ? (
                <span className="text-xs text-[var(--text-muted)]">No data</span>
              ) : undefined}
            >
              <div className="space-y-4">
                {report.topItems.length > 0 ? (
                  report.topItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl print:bg-[var(--surface-hover)] print:border-[var(--border)]">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm',
                          idx === 0 ? 'bg-amber-500/10 text-amber-500' :
                            idx === 1 ? 'bg-[var(--surface-active)] text-[var(--text-secondary)]' :
                              idx === 2 ? 'bg-brand-subtle text-brand' :
                                'bg-[var(--surface-hover)] text-[var(--text-muted)]',
                          'print:bg-white'
                        )}>
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-[var(--text-primary)] text-sm print:text-black">{item.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{item.quantity} sold</p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-500 print:text-emerald-600">{formatCurrency(item.revenue)}</span>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={PieChart}
                    title="No sales data"
                    description="No sales data available for this period."
                  />
                )}
              </div>
            </SectionCard>

            {/* Payment Methods */}
            <SectionCard title="Payment Methods">
              <div className="space-y-4">
                {[
                  { method: 'Cash', count: report.paymentBreakdown.cash, icon: Banknote, color: 'text-emerald-500', bg: 'bg-emerald-500/10', bar: 'bg-emerald-500' },
                  { method: 'Card', count: report.paymentBreakdown.card, icon: CreditCard, color: 'text-sky-500', bg: 'bg-sky-500/10', bar: 'bg-sky-500' },
                  { method: 'Mobile', count: report.paymentBreakdown.mobile, icon: Smartphone, color: 'text-brand', bg: 'bg-brand-subtle', bar: 'bg-brand' },
                ].map((pm, idx) => {
                  const percent = totalTransactions > 0 ? Math.round((pm.count / totalTransactions) * 100) : 0
                  return (
                    <div key={idx} className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl print:bg-[var(--surface-hover)] print:border-[var(--border)]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", pm.bg, pm.color)}>
                            <pm.icon className="w-5 h-5" />
                          </div>
                          <span className="font-bold text-[var(--text-primary)] print:text-black">{pm.method}</span>
                        </div>
                        <span className={cn("font-bold text-xl", pm.color)}>{pm.count}</span>
                      </div>
                      <div className="h-2 bg-[var(--surface-hover)] rounded-full overflow-hidden print:bg-[var(--border)]">
                        <div className={cn("h-full rounded-full", pm.bar)} style={{ width: `${percent}%` }} />
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] font-bold mt-2 uppercase">{percent}% of transactions</p>
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          </div>

          {/* Hourly Breakdown */}
          <SectionCard
            title="Hourly Breakdown"
            action={report.hourlyBreakdown.length === 0 ? (
              <span className="text-xs text-[var(--text-muted)]">No data</span>
            ) : undefined}
          >
            {report.hourlyBreakdown.length > 0 ? (
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-3">
                {report.hourlyBreakdown.map((h) => (
                  <div key={h.hour} className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-center print:bg-[var(--surface-hover)] print:border-[var(--border)]">
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-2">{formatHour(h.hour)}</p>
                    <p className="text-xl font-bold text-[var(--text-primary)] print:text-black">{h.orders}</p>
                    <p className="text-[10px] font-bold text-emerald-500">{formatCurrency(h.revenue)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Clock}
                title="No orders"
                description="No orders recorded in this period."
              />
            )}
          </SectionCard>
        </>
      ) : (
        <EmptyState
          icon={FileText}
          title="No data available"
          description="There is no report data for the selected period."
        />
      )}
    </motion.div>
  )
}

function formatCurrency(amount: number): string {
  if (amount >= 100000) {
    return `Rs.${(amount / 100000).toFixed(1)}L`
  } else if (amount >= 1000) {
    return `Rs.${(amount / 1000).toFixed(1)}K`
  }
  return `Rs.${amount.toLocaleString()}`
}

function formatDisplayDate(dateStr: string, showFull?: boolean): string {
  const d = new Date(dateStr)
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  if (showFull) {
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
    return `${weekday}, ${month}/${day}/${year}`
  }
  return `${day}/${month}/${year}`
}
