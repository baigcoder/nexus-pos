'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  TrendingUp,
  Clock,
  DollarSign,
  ShoppingCart,
  Award,
  ChevronLeft,
  ChevronRight,
  Star,
  RefreshCw,
  Gift,
  Sparkles,
  Trophy,
  Target,
  Zap,
  TrendingDown,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { Badge, Button, Modal } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface StaffPerformance {
  id: string
  name: string
  email: string | null
  role: string
  ordersToday: number
  ordersThisWeek: number
  ordersThisMonth: number
  revenueToday: number
  revenueWeek: number
  revenueMonth: number
  avgOrderValue: number
  performanceScore: number
  is_active: boolean
}

interface BonusSuggestion {
  staffId: string
  staffName: string
  bonus: number
  reason: string
  performanceLevel: 'excellent' | 'good' | 'improving'
}

interface BonusRecord {
  id: string
  staff_id: string
  staff_name?: string
  amount: number
  reason: string
  given_by: string
  created_at: string
}

export default function StaffPerformancePage() {
  const { restaurant, staff: currentStaff } = useAuthStore()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week')
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([])
  const [bonusSuggestions, setBonusSuggestions] = useState<BonusSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showBonusModal, setShowBonusModal] = useState(false)
  const [selectedStaffForBonus, setSelectedStaffForBonus] = useState<StaffPerformance | null>(null)
  const [bonusHistory, setBonusHistory] = useState<BonusRecord[]>([])
  const [bonusForm, setBonusForm] = useState({ amount: '', reason: '' })

  const loadPerformance = async () => {
    if (!restaurant?.id) return
    setIsLoading(true)

    try {
      const supabase = createClient()
      const today = selectedDate
      const todayStart = `${today}T00:00:00`
      const todayEnd = `${today}T23:59:59`

      // Get week start (Sunday)
      const todayDate = new Date(selectedDate)
      const weekStart = new Date(todayDate)
      weekStart.setDate(todayDate.getDate() - todayDate.getDay())
      const weekStartStr = weekStart.toISOString().split('T')[0]

      // Get month start
      const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
      const monthStartStr = monthStart.toISOString().split('T')[0]

      // Period range for primary display based on selector
      const periodStart = period === 'day' ? todayStart
        : period === 'week' ? `${weekStartStr}T00:00:00`
        : `${monthStartStr}T00:00:00`

      // Fetch all staff
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name, email, role, is_active')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('name')

      // Only 'paid' and 'served' are truly completed orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, staff_id, total, created_at, status')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', monthStartStr)
        .in('status', ['paid', 'served'])

      // Fetch bonus history
      const { data: bonusData } = await supabase
        .from('staff_bonuses')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', monthStartStr)
        .order('created_at', { ascending: false })

      setBonusHistory(bonusData || [])

      // Calculate performance for each staff
      const performance = (staffData || []).map((staff: { id: string; name: string; email: string | null; role: string; is_active: boolean }) => {
        const staffOrders = (ordersData || []).filter((o: { staff_id: string }) => o.staff_id === staff.id)
        const todayOrders = staffOrders.filter((o: { created_at: string }) => {
          const orderDate = new Date(o.created_at)
          return orderDate >= new Date(todayStart) && orderDate <= new Date(todayEnd)
        })
        const weekOrders = staffOrders.filter((o: { created_at: string }) =>
          o.created_at >= `${weekStartStr}T00:00:00`
        )
        const monthOrders = staffOrders

        // Period-aware primary metrics
        const periodOrders = period === 'day' ? todayOrders : period === 'week' ? weekOrders : monthOrders

        const revenueToday = todayOrders.reduce((sum: number, o: { total: number }) => sum + Number(o.total || 0), 0)
        const revenueWeek = weekOrders.reduce((sum: number, o: { total: number }) => sum + Number(o.total || 0), 0)
        const revenueMonth = monthOrders.reduce((sum: number, o: { total: number }) => sum + Number(o.total || 0), 0)

        // Calculate performance score (0-100) based on selected period
        const periodRevenue = period === 'day' ? revenueToday : period === 'week' ? revenueWeek : revenueMonth
        const revenueTarget = period === 'day' ? 5000 : period === 'week' ? 35000 : 150000
        const orderTarget = period === 'day' ? 5 : period === 'week' ? 35 : 150

        const orderCountScore = Math.min((periodOrders.length / orderTarget) * 30, 30)
        const revenueScore = Math.min((periodRevenue / revenueTarget) * 40, 40)
        const consistencyScore = weekOrders.length > 0 ? Math.min((weekOrders.length / 7) * 10, 10) : 0
        const avgOrderScore = periodOrders.length > 0 ? Math.min((periodRevenue / periodOrders.length) / 500 * 20, 20) : 0
        const performanceScore = Math.round(orderCountScore + revenueScore + consistencyScore + avgOrderScore)

        return {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          is_active: staff.is_active,
          ordersToday: todayOrders.length,
          ordersThisWeek: weekOrders.length,
          ordersThisMonth: monthOrders.length,
          revenueToday,
          revenueWeek,
          revenueMonth,
          avgOrderValue: periodOrders.length > 0 ? periodRevenue / periodOrders.length : 0,
          performanceScore
        }
      }).sort((a: StaffPerformance, b: StaffPerformance) => b.performanceScore - a.performanceScore)

      setStaffPerformance(performance)

      // Generate AI bonus suggestions
      const suggestions: BonusSuggestion[] = []
      const avgRevenue = performance.reduce((sum: number, p: StaffPerformance) => sum + p.revenueWeek, 0) / performance.length || 1

      performance.forEach((staff: StaffPerformance) => {
        if (staff.performanceScore >= 80) {
          // Excellent performance
          const bonus = Math.round((staff.revenueWeek / avgRevenue) * 500)
          suggestions.push({
            staffId: staff.id,
            staffName: staff.name,
            bonus: Math.min(bonus, 2000),
            reason: `Outstanding weekly performance: ${staff.ordersThisWeek} orders, Rs.${staff.revenueWeek.toLocaleString()} revenue`,
            performanceLevel: 'excellent'
          })
        } else if (staff.performanceScore >= 60 && staff.revenueWeek > avgRevenue * 0.8) {
          // Good performance
          const bonus = Math.round((staff.revenueWeek / avgRevenue) * 300)
          suggestions.push({
            staffId: staff.id,
            staffName: staff.name,
            bonus: Math.min(bonus, 1000),
            reason: `Good performance this week with ${staff.ordersThisWeek} orders`,
            performanceLevel: 'good'
          })
        } else if (staff.ordersThisWeek > 5 && staff.revenueWeek > staff.revenueToday * 5) {
          // Improving
          suggestions.push({
            staffId: staff.id,
            staffName: staff.name,
            bonus: 500,
            reason: `Consistent performer with ${staff.ordersThisWeek} orders this week`,
            performanceLevel: 'improving'
          })
        }
      })

      setBonusSuggestions(suggestions)

    } catch (err) {
      console.error('Failed to load performance:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPerformance()
  }, [restaurant?.id, selectedDate, period])

  const handleDateChange = (days: number) => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + days)
    setSelectedDate(date.toISOString().split('T')[0])
  }

  const handleGiveBonus = async () => {
    if (!selectedStaffForBonus || !bonusForm.amount || !restaurant?.id) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('staff_bonuses')
        .insert({
          restaurant_id: restaurant.id,
          staff_id: selectedStaffForBonus.id,
          amount: parseFloat(bonusForm.amount),
          reason: bonusForm.reason || 'Performance bonus',
          given_by: currentStaff?.id || 'owner'
        })

      if (error) throw error

      setShowBonusModal(false)
      setBonusForm({ amount: '', reason: '' })
      setSelectedStaffForBonus(null)
      loadPerformance()
    } catch (err) {
      console.error('Failed to give bonus:', err)
    }
  }

  const roleColors: Record<string, string> = {
    owner: 'bg-brand-subtle text-orange-400',
    manager: 'bg-emerald-500/10 text-emerald-400',
    waiter: 'bg-blue-500/10 text-blue-400',
    kitchen: 'bg-rose-500/10 text-rose-400',
    cashier: 'bg-brand-subtle text-purple-400',
    delivery: 'bg-brand-subtle text-cyan-400',
  }

  const topPerformer = staffPerformance[0]
  const totalRevenue = staffPerformance.reduce((sum: number, s) => sum + s.revenueWeek, 0)
  const totalOrders = staffPerformance.reduce((sum: number, s) => sum + s.ordersThisWeek, 0)
  const activeStaff = staffPerformance.filter(s => s.is_active).length

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-brand-subtle text-brand border-brand/20 px-3 py-1">
              AI Performance
            </Badge>
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">
            Staff <span className="text-brand">Analytics</span>
          </h1>
          <p className="text-[var(--text-muted)] text-sm">
            Monitor performance and award bonuses based on AI insights
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <div className="flex bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-1.5">
            {(['day', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all',
                  period === p ? 'bg-cyan-500 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={loadPerformance}
            disabled={isLoading}
            className="h-11 px-4 rounded-xl bg-[var(--surface-active)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--surface-active)] flex items-center gap-2 transition-all text-sm"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Refresh
          </button>

          <div className="flex items-center gap-2 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-1.5">
            <button
              onClick={() => handleDateChange(period === 'day' ? -1 : period === 'week' ? -7 : -30)}
              className="w-9 h-9 rounded-lg hover:bg-[var(--surface-active)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-medium text-[var(--text-primary)] text-sm min-w-[120px] text-center">
              {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <button
              onClick={() => handleDateChange(period === 'day' ? 1 : period === 'week' ? 7 : 30)}
              className="w-9 h-9 rounded-lg hover:bg-[var(--surface-active)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* AI Bonus Suggestions */}
      {bonusSuggestions.length > 0 && (
        <div className="p-5 bg-gradient-to-r from-cyan-600/10 via-[var(--surface-raised)] to-[var(--surface-raised)] border border-cyan-600/30 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-[var(--text-primary)]">AI Bonus Suggestions</h3>
            <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">{bonusSuggestions.length} recommendations</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bonusSuggestions.slice(0, 3).map((suggestion, idx) => {
              const staff = staffPerformance.find(s => s.id === suggestion.staffId)
              return (
                <div
                  key={idx}
                  className={cn(
                    'p-4 rounded-xl border',
                    suggestion.performanceLevel === 'excellent' ? 'bg-emerald-500/5 border-emerald-500/20' :
                      suggestion.performanceLevel === 'good' ? 'bg-blue-500/5 border-blue-500/20' :
                        'bg-amber-500/5 border-amber-500/20'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                        suggestion.performanceLevel === 'excellent' ? 'bg-emerald-500/20 text-emerald-400' :
                          suggestion.performanceLevel === 'good' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-amber-500/20 text-amber-400'
                      )}>
                        {suggestion.staffName.charAt(0)}
                      </div>
                      <span className="font-semibold text-[var(--text-primary)]">{suggestion.staffName}</span>
                    </div>
                    <Badge className={cn(
                      'text-xs',
                      suggestion.performanceLevel === 'excellent' ? 'bg-emerald-500/20 text-emerald-400' :
                        suggestion.performanceLevel === 'good' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-amber-500/20 text-amber-400'
                    )}>
                      Rs.{suggestion.bonus}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mb-3">{suggestion.reason}</p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedStaffForBonus(staff || null)
                      setBonusForm({ amount: suggestion.bonus.toString(), reason: suggestion.reason })
                      setShowBonusModal(true)
                    }}
                    className={cn(
                      'w-full h-9 text-xs font-bold',
                      suggestion.performanceLevel === 'excellent' ? 'bg-emerald-500 hover:bg-emerald-600' :
                        suggestion.performanceLevel === 'good' ? 'bg-blue-500 hover:bg-blue-600' :
                          'bg-amber-500 hover:bg-amber-600'
                    )}
                  >
                    <Gift className="w-3 h-3 mr-2" />
                    Award Bonus
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top Performer Card */}
      {topPerformer && (
        <div className="p-6 bg-gradient-to-r from-yellow-500/20 via-[var(--surface-raised)] to-[var(--surface-raised)] border border-yellow-500/30 rounded-2xl">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-yellow-500 flex items-center justify-center">
              <Trophy className="w-7 h-7 text-[var(--text-primary)]" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-yellow-400 uppercase tracking-wide mb-1">Top Performer</p>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{topPerformer.name}</h2>
              <div className="flex items-center gap-5 mt-2 text-sm text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-brand" />
                  <span className="text-[var(--text-primary)] font-medium">{topPerformer.ordersThisWeek}</span> orders
                </span>
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="text-[var(--text-primary)] font-medium">Rs.{topPerformer.revenueWeek.toLocaleString()}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-[var(--text-primary)] font-medium">{topPerformer.performanceScore}</span> score
                </span>
              </div>
            </div>
            <div className="text-center px-4">
              <div className="text-3xl font-bold text-yellow-400">{topPerformer.performanceScore}</div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Performance</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide">Total Orders</span>
            <ShoppingCart className="w-4 h-4 text-brand" />
          </div>
          <p className="text-3xl font-bold text-[var(--text-primary)]">{totalOrders}</p>
        </div>
        <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide">Total Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-emerald-500">Rs.{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide">Active Staff</span>
            <Users className="w-4 h-4 text-brand" />
          </div>
          <p className="text-3xl font-bold text-brand">{activeStaff}</p>
        </div>
        <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide">Avg Order Value</span>
            <TrendingUp className="w-4 h-4 text-brand" />
          </div>
          <p className="text-3xl font-bold text-brand">
            Rs.{totalOrders > 0 ? Math.round(totalRevenue / totalOrders).toLocaleString() : 0}
          </p>
        </div>
      </div>

      {/* Performance Table */}
      <div className="bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Staff Performance</h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-emerald-400">Excellent (80+)</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-blue-400">Good (60-79)</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-amber-400">Improving (&lt;60)</span>
            </span>
          </div>
        </div>
        {isLoading ? (
          <div className="p-10 text-center text-[var(--text-muted)]">Loading performance data...</div>
        ) : staffPerformance.length === 0 ? (
          <div className="p-10 text-center text-[var(--text-muted)]">
            <Users className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
            <p>No staff data available for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                  <th className="text-left py-4 px-5">Staff</th>
                  <th className="text-left py-4 px-5">Role</th>
                  <th className="text-center py-4 px-5">Score</th>
                  <th className="text-center py-4 px-5">Orders</th>
                  <th className="text-center py-4 px-5">Revenue</th>
                  <th className="text-center py-4 px-5">Avg Order</th>
                  <th className="text-center py-4 px-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-active)]">
                {staffPerformance.map((staff, idx) => (
                  <tr key={staff.id} className="hover:bg-[var(--surface-active)]/30 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold",
                          staff.performanceScore >= 80 ? 'bg-emerald-500/20 text-emerald-500' :
                            staff.performanceScore >= 60 ? 'bg-blue-500/20 text-blue-500' :
                              'bg-amber-500/20 text-amber-500'
                        )}>
                          {idx + 1}
                        </div>
                        <div>
                          <span className="font-medium text-[var(--text-primary)]">{staff.name}</span>
                          <p className="text-xs text-[var(--text-muted)]">{staff.email || 'No email'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <span className={cn(
                        "text-xs font-medium px-2.5 py-1 rounded-full",
                        roleColors[staff.role] || roleColors.waiter
                      )}>
                        {staff.role}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className={cn(
                        "font-bold text-lg",
                        staff.performanceScore >= 80 ? 'text-emerald-500' :
                          staff.performanceScore >= 60 ? 'text-blue-500' :
                            'text-amber-500'
                      )}>
                        {staff.performanceScore}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <div>
                        <span className="font-semibold text-[var(--text-primary)]">{staff.ordersThisWeek}</span>
                        <span className="text-xs text-[var(--text-muted)]"> / week</span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {staff.ordersThisMonth} / month
                      </div>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <div>
                        <span className="font-semibold text-emerald-500">Rs.{staff.revenueWeek.toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Rs.{staff.revenueMonth.toLocaleString()} / month
                      </div>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className="font-semibold text-[var(--text-muted)]">
                        Rs.{Math.round(staff.avgOrderValue).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedStaffForBonus(staff)
                          setShowBonusModal(true)
                        }}
                        className="h-9 px-4 bg-brand-subtle text-cyan-400 border border-brand/20 hover:bg-cyan-500 hover:text-[var(--text-primary)]"
                      >
                        <Gift className="w-4 h-4 mr-2" />
                        Bonus
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bonus History */}
      {bonusHistory.length > 0 && (
        <div className="bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[var(--border)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Recent Bonuses</h3>
          </div>
          <div className="divide-y divide-[var(--surface-active)]">
            {bonusHistory.slice(0, 5).map((bonus) => (
              <div key={bonus.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{bonus.staff_name || 'Staff'}</p>
                    <p className="text-xs text-[var(--text-muted)]">{bonus.reason}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-500">Rs.{bonus.amount.toLocaleString()}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {new Date(bonus.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bonus Modal */}
      <Modal isOpen={showBonusModal} onClose={() => { setShowBonusModal(false); setSelectedStaffForBonus(null) }} title="Award Bonus" size="md">
        {selectedStaffForBonus && (
          <div className="space-y-5 py-4">
            <div className="flex items-center gap-4 p-4 bg-[var(--surface-raised)] rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-lg">
                {selectedStaffForBonus.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)]">{selectedStaffForBonus.name}</p>
                <p className="text-sm text-[var(--text-muted)]">
                  Score: {selectedStaffForBonus.performanceScore} | {selectedStaffForBonus.ordersThisWeek} orders this week
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2 block">
                Bonus Amount (Rs.)
              </label>
              <input
                type="number"
                value={bonusForm.amount}
                onChange={(e) => setBonusForm({ ...bonusForm, amount: e.target.value })}
                placeholder="500"
                className="w-full h-12 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl px-4 text-[var(--text-primary)] text-lg font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2 block">
                Reason
              </label>
              <textarea
                value={bonusForm.reason}
                onChange={(e) => setBonusForm({ ...bonusForm, reason: e.target.value })}
                placeholder="Performance bonus for excellent work..."
                rows={3}
                className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { setShowBonusModal(false); setSelectedStaffForBonus(null) }}
                className="flex-1 h-12 border-[var(--border-strong)] text-[var(--text-muted)]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGiveBonus}
                disabled={!bonusForm.amount}
                className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600"
              >
                <Gift className="w-4 h-4 mr-2" />
                Award Bonus
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}