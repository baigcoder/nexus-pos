import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireManagerOrOwner } from '@/lib/api-auth'

const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY || ''
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'liquid/lfm-2.5-1.2b-instruct:free'

type InsightSeverity = 'success' | 'warning' | 'critical' | 'info'

interface AnalyticsInsight {
  title: string
  summary: string
  severity: InsightSeverity
  action: string
  metric?: string
}

const PAID_STATUSES = ['paid', 'served', 'completed']

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}

function daysBetween(start: Date, end: Date) {
  const days: string[] = []
  const cursor = startOfDay(start)
  const last = startOfDay(end)
  while (cursor <= last) {
    days.push(cursor.toISOString().split('T')[0])
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function growth(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function sumOrders(orders: any[]) {
  return orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
}

function minutesBetween(startValue?: string | null, endValue?: string | null) {
  if (!startValue || !endValue) return 0
  const start = new Date(startValue).getTime()
  const end = new Date(endValue).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return Math.round((end - start) / 60000)
}

function buildLocalInsights({
  totalRevenue,
  totalOrders,
  revenueGrowth,
  ordersGrowth,
  avgOrderValue,
  avgPrepTime,
  topItems,
  ordersByHour,
  revenueByChannel,
  deliveryMetrics,
}: any): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []

  if (revenueGrowth < 0) {
    insights.push({
      title: 'Revenue is down',
      summary: `Revenue is ${Math.abs(revenueGrowth)}% lower than the previous matching period.`,
      severity: revenueGrowth <= -20 ? 'critical' : 'warning',
      action: 'Check discounts, low-stock items, and table turnover before the next rush.',
      metric: `${revenueGrowth}%`,
    })
  } else if (totalRevenue > 0) {
    insights.push({
      title: 'Revenue trend is healthy',
      summary: `Revenue is ${revenueGrowth}% above the previous matching period.`,
      severity: 'success',
      action: 'Keep best-selling items visible and staffed during peak hours.',
      metric: `+${revenueGrowth}%`,
    })
  }

  if (ordersGrowth < 0) {
    insights.push({
      title: 'Order count needs attention',
      summary: `Order volume is ${Math.abs(ordersGrowth)}% lower than the previous period.`,
      severity: 'warning',
      action: 'Review dine-in traffic and push quick combos during slow windows.',
      metric: `${ordersGrowth}%`,
    })
  }

  const peakHour = Object.entries(ordersByHour || {}).sort((a: any, b: any) => b[1] - a[1])[0]
  if (peakHour) {
    insights.push({
      title: 'Peak hour detected',
      summary: `${peakHour[0]}:00 has the highest order load for this period.`,
      severity: 'info',
      action: 'Schedule kitchen and cashier coverage around this hour.',
      metric: `${peakHour[1]} orders`,
    })
  }

  if (avgPrepTime >= 18) {
    insights.push({
      title: 'Kitchen prep time is high',
      summary: `Average prep time is ${avgPrepTime} minutes.`,
      severity: avgPrepTime >= 25 ? 'critical' : 'warning',
      action: 'Split long-prep items and prioritize ready-to-serve orders.',
      metric: `${avgPrepTime}m`,
    })
  }

  const topItem = topItems?.[0]
  if (topItem && totalRevenue > 0) {
    const contribution = Math.round((topItem.revenue / totalRevenue) * 100)
    insights.push({
      title: 'Top item contribution',
      summary: `${topItem.name} contributes ${contribution}% of selected-period revenue.`,
      severity: contribution >= 40 ? 'warning' : 'info',
      action: contribution >= 40 ? 'Protect stock for this item and avoid kitchen delays.' : 'Use this item in combos or upsell prompts.',
      metric: `${contribution}%`,
    })
  }

  const totalChannelRevenue = Object.values(revenueByChannel || {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0)
  if (totalChannelRevenue > 0) {
    const deliveryShare = Math.round((Number(revenueByChannel.delivery || 0) / totalChannelRevenue) * 100)
    if (deliveryShare >= 35) {
      insights.push({
        title: 'Delivery share is significant',
        summary: `Delivery is ${deliveryShare}% of revenue.`,
        severity: 'info',
        action: 'Keep rider assignment and packaging stock visible during rush.',
        metric: `${deliveryShare}%`,
      })
    }
  }

  if (deliveryMetrics?.totalDeliveries > 0 && deliveryMetrics.onTimeRate < 85) {
    insights.push({
      title: 'Delivery on-time rate is low',
      summary: `${deliveryMetrics.onTimeRate}% of deliveries are on time.`,
      severity: 'warning',
      action: 'Assign riders earlier and flag delayed pickup orders.',
      metric: `${deliveryMetrics.onTimeRate}%`,
    })
  }

  if (insights.length === 0) {
    insights.push({
      title: 'Not enough signal yet',
      summary: totalOrders === 0 ? 'No paid or served orders were found in this date range.' : 'Metrics are stable for this period.',
      severity: totalOrders === 0 ? 'info' : 'success',
      action: totalOrders === 0 ? 'Select a wider period or complete payments to unlock trend insights.' : 'Continue monitoring peak hours and top items.',
      metric: totalOrders === 0 ? '0 orders' : `${avgOrderValue} AOV`,
    })
  }

  return insights.slice(0, 6)
}

async function getAIExecutiveSummary(metrics: Record<string, unknown>, insights: AnalyticsInsight[]) {
  if (!OPENROUTER_API_KEY) {
    return {
      mode: 'rules',
      summary: insights[0]?.summary || 'Analytics are ready for review.',
      model: 'local-rules',
    }
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'OrderFlow POS Analytics',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a restaurant operations analyst. Return one concise executive summary sentence and one practical next action. No markdown.',
          },
          {
            role: 'user',
            content: JSON.stringify({ metrics, insights }),
          },
        ],
        temperature: 0.2,
        max_tokens: 120,
      }),
    })

    if (!response.ok) throw new Error(`OpenRouter ${response.status}`)
    const result = await response.json()
    const summary = result.choices?.[0]?.message?.content?.trim()
    if (!summary) throw new Error('Empty AI response')
    return { mode: 'openrouter', summary, model: OPENROUTER_MODEL }
  } catch (error) {
    console.warn('Analytics AI summary fallback:', error)
    return {
      mode: 'rules',
      summary: insights[0]?.summary || 'Analytics are ready for review.',
      model: 'local-rules',
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { auth, response } = await requireManagerOrOwner()(request)
    if (response) return response

    const { searchParams } = new URL(request.url)
    const requestedRestaurantId = searchParams.get('restaurant_id')
    const targetRestaurantId = requestedRestaurantId || auth.restaurantId

    if (targetRestaurantId !== auth.restaurantId && auth.role !== 'owner') {
      return NextResponse.json({ success: false, error: 'Cannot access another restaurant analytics' }, { status: 403 })
    }

    const end = endOfDay(searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date())
    const start = startOfDay(searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000))
    const periodLength = Math.max(1, end.getTime() - start.getTime())
    const prevStart = new Date(start.getTime() - periodLength)
    const prevEnd = new Date(start.getTime() - 1)
    const supabase = createAdminClient()

    const [ordersResult, previousOrdersResult, staffResult] = await Promise.all([
      supabase
        .from('orders')
        .select('id, total, status, created_at, table_id')
        .eq('restaurant_id', targetRestaurantId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString()),
      supabase
        .from('orders')
        .select('id, total, status')
        .eq('restaurant_id', targetRestaurantId)
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd.toISOString()),
      supabase
        .from('staff')
        .select('id, name, role, is_active')
        .eq('restaurant_id', targetRestaurantId),
    ])

    if (ordersResult.error) throw ordersResult.error

    const orders = ordersResult.data || []
    const previousOrders = previousOrdersResult.data || []
    const paidOrders = orders.filter((order: any) => PAID_STATUSES.includes(order.status))
    const previousPaidOrders = previousOrders.filter((order: any) => PAID_STATUSES.includes(order.status))
    const totalRevenue = sumOrders(paidOrders)
    const previousRevenue = sumOrders(previousPaidOrders)
    const totalOrders = paidOrders.length

    const orderIds = paidOrders.map((order: any) => order.id)
    const orderItemsResult = orderIds.length > 0
      ? await supabase
        .from('order_items')
        .select('order_id, menu_item_id, quantity, subtotal, menu_item:menu_items(name)')
        .in('order_id', orderIds)
      : { data: [], error: null }

    const itemStats = new Map<string, { name: string; quantity: number; revenue: number }>()
    ;(orderItemsResult.data || []).forEach((item: any) => {
      const name = item.menu_item?.name || 'Unknown item'
      const existing = itemStats.get(name) || { name, quantity: 0, revenue: 0 }
      existing.quantity += Number(item.quantity || 0)
      existing.revenue += Number(item.subtotal || 0)
      itemStats.set(name, existing)
    })

    const topItems = Array.from(itemStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(item => ({ ...item, growth: 0 }))

    const dailyRevenueMap = new Map(daysBetween(start, end).map(date => [date, 0]))
    paidOrders.forEach((order: any) => {
      const date = new Date(order.created_at).toISOString().split('T')[0]
      dailyRevenueMap.set(date, (dailyRevenueMap.get(date) || 0) + Number(order.total || 0))
    })
    const dailyRevenue = Array.from(dailyRevenueMap.entries()).map(([date, revenue]) => ({ date, revenue }))

    const ordersByHour: Record<number, number> = {}
    for (let hour = 0; hour < 24; hour++) ordersByHour[hour] = 0
    paidOrders.forEach((order: any) => {
      const hour = new Date(order.created_at).getHours()
      ordersByHour[hour] += 1
    })

    const revenueByChannel = {
      dine_in: sumOrders(paidOrders.filter((order: any) => order.table_id)),
      delivery: 0,
      takeaway: sumOrders(paidOrders.filter((order: any) => !order.table_id)),
    }

    const staff = staffResult.data || []
    const cashierTransactionsResult = await supabase
      .from('cashier_transactions')
      .select('staff_id, total_amount, transaction_type, created_at')
      .eq('restaurant_id', targetRestaurantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    const transactionsByStaff = new Map<string, { orders: number; revenue: number }>()
    ;(cashierTransactionsResult.data || []).forEach((transaction: any) => {
      const staffId = transaction.staff_id
      if (!staffId) return
      const existing = transactionsByStaff.get(staffId) || { orders: 0, revenue: 0 }
      existing.orders += 1
      existing.revenue += Number(transaction.total_amount || 0)
      transactionsByStaff.set(staffId, existing)
    })

    const staffPerformance = staff
      .map((member: any) => {
        const stats = transactionsByStaff.get(member.id) || { orders: 0, revenue: 0 }
        return {
          name: member.name,
          role: member.role,
          orders: stats.orders,
          revenue: stats.revenue,
        }
      })
      .filter((member: any) => member.orders > 0 || member.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)

    const kitchenQueueResult = await supabase
      .from('kitchen_order_queue')
      .select('actual_prep_time_seconds, ready_at, created_at')
      .eq('restaurant_id', targetRestaurantId)
      .eq('status', 'served')
      .gte('ready_at', start.toISOString())
      .lte('ready_at', end.toISOString())

    const prepTimes = (kitchenQueueResult.data || [])
      .map((item: any) => Number(item.actual_prep_time_seconds || 0))
      .filter((seconds: number) => seconds > 0)
    const avgPrepTime = prepTimes.length > 0
      ? Math.round(prepTimes.reduce((sum: number, seconds: number) => sum + seconds, 0) / prepTimes.length / 60)
      : 0

    const deliveryResult = await supabase
      .from('delivery_assignments')
      .select('status, created_at, actual_delivery_time')
      .eq('restaurant_id', targetRestaurantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    const deliveries = deliveryResult.data || []
    const delivered = deliveries.filter((delivery: any) => ['delivered', 'completed'].includes(delivery.status))
    const deliveryTimes = delivered
      .map((delivery: any) => minutesBetween(delivery.created_at, delivery.actual_delivery_time))
      .filter((minutes: number) => minutes > 0)
    const avgDeliveryTime = deliveryTimes.length > 0
      ? Math.round(deliveryTimes.reduce((sum: number, minutes: number) => sum + minutes, 0) / deliveryTimes.length)
      : 0
    const onTimeRate = deliveryTimes.length > 0
      ? Math.round((deliveryTimes.filter((minutes: number) => minutes <= 30).length / deliveryTimes.length) * 100)
      : 100

    const revenueGrowth = growth(totalRevenue, previousRevenue)
    const ordersGrowth = growth(totalOrders, previousPaidOrders.length)
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
    const peakHour = Object.entries(ordersByHour).sort((a: any, b: any) => b[1] - a[1])[0]

    const insightInput = {
      totalRevenue,
      totalOrders,
      revenueGrowth,
      ordersGrowth,
      avgOrderValue,
      avgPrepTime,
      topItems,
      ordersByHour,
      revenueByChannel,
      deliveryMetrics: { avgTime: avgDeliveryTime, onTimeRate, totalDeliveries: delivered.length },
    }
    const aiInsights = buildLocalInsights(insightInput)
    const aiSummary = await getAIExecutiveSummary({
      revenue: totalRevenue,
      orders: totalOrders,
      revenueGrowth,
      ordersGrowth,
      avgOrderValue,
      avgPrepTime,
      peakHour: peakHour ? `${peakHour[0]}:00` : null,
    }, aiInsights)

    const healthScore = Math.max(0, Math.min(100,
      70 +
      (revenueGrowth > 0 ? 10 : revenueGrowth < -10 ? -15 : 0) +
      (ordersGrowth > 0 ? 8 : ordersGrowth < -10 ? -10 : 0) +
      (avgPrepTime > 0 && avgPrepTime <= 15 ? 6 : avgPrepTime >= 25 ? -10 : 0) +
      (onTimeRate >= 90 ? 6 : onTimeRate < 80 ? -8 : 0)
    ))

    return NextResponse.json({
      success: true,
      revenue: {
        today: totalRevenue,
        thisWeek: totalRevenue,
        thisMonth: totalRevenue,
        growth: revenueGrowth,
      },
      orders: {
        today: totalOrders,
        thisWeek: totalOrders,
        thisMonth: totalOrders,
        growth: ordersGrowth,
      },
      avgOrderValue,
      avgPrepTime,
      topItems,
      revenueByChannel,
      ordersByHour,
      dailyRevenue,
      staffPerformance,
      deliveryMetrics: {
        avgTime: avgDeliveryTime,
        onTimeRate,
        totalDeliveries: delivered.length,
      },
      aiInsights,
      aiSummary,
      healthScore,
      peakHour: peakHour ? { hour: Number(peakHour[0]), orders: Number(peakHour[1]) } : null,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      periodDays: Math.ceil(periodLength / (24 * 60 * 60 * 1000)),
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
