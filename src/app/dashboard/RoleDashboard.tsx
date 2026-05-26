'use client'

import { useState } from 'react'
import { useAuthStore, useUserRole } from '@/stores/auth-store'
import { motion } from 'framer-motion'
import {
    LayoutDashboard, Users, BarChart3, ClipboardList, ChefHat, Truck,
    Receipt, Activity, Clock, TrendingUp, DollarSign, Star, RefreshCw,
    ShoppingBag, MapPin, Calendar, ChevronRight, ArrowUpRight, ArrowDownRight,
    Zap, Table2, Percent, Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercentage } from '@/lib/format'
import {
    useDashboardStats, useRevenueChart, useOrdersByStatus,
    useHourlyOrders, useCategoryBreakdown, useRecentOrders,
} from '@/hooks/use-dashboard-data'
import { useWaiterStats } from '@/hooks/use-waiter-stats'
import { useDeliveryStats } from '@/hooks/use-delivery-stats'
import {
    RevenueChart, OrdersStatusChart, HourlyOrdersChart, CategoryChart, RecentActivity,
} from '@/components/charts/DashboardCharts'
import { containerVariants, itemVariants } from '@/components/dashboard/shared'

/* ============================================
   STAT CARD
   ============================================ */

function StatCard({
    title, value, change, icon: Icon, trend, delay = 0, loading = false
}: {
    title: string
    value: string | number
    change?: string
    icon: React.ElementType
    trend?: 'up' | 'down'
    delay?: number
    loading?: boolean
}) {
    if (loading) {
        return (
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-5 animate-pulse">
                <div className="w-10 h-10 bg-[var(--surface-active)] rounded-lg mb-4" />
                <div className="h-7 bg-[var(--surface-active)] rounded w-2/3 mb-2" />
                <div className="h-4 bg-[var(--surface-active)] rounded w-1/2" />
            </div>
        )
    }
    return (
        <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="show"
            transition={{ delay }}
            className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-strong)] transition-all duration-300 group"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-brand-subtle flex items-center justify-center">
                    <Icon className="w-5 h-5 text-brand" />
                </div>
                {change && (
                    <div className={cn(
                        "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                        trend === 'up' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                    )}>
                        {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {change}
                    </div>
                )}
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{value}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">{title}</p>
        </motion.div>
    )
}

/* ============================================
   STATUS PILL
   ============================================ */

function StatusPill({ icon: Icon, label, value, color, delay = 0 }: {
    icon: React.ElementType
    label: string
    value: string | number
    color: string
    delay?: number
}) {
    const colorMap: Record<string, { text: string; ring: string }> = {
        yellow: { text: 'text-amber-400', ring: 'ring-amber-500/20' },
        blue:   { text: 'text-sky-400',     ring: 'ring-sky-500/20' },
        emerald:{ text: 'text-emerald-400', ring: 'ring-emerald-500/20' },
        violet: { text: 'text-violet-400',  ring: 'ring-violet-500/20' },
    }
    const c = colorMap[color] || colorMap.blue
    return (
        <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="show"
            transition={{ delay }}
            className="flex items-center gap-3 p-4 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all"
        >
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center bg-[var(--surface)] ring-1", c.ring)}>
                <Icon className={cn("w-4 h-4", c.text)} />
            </div>
            <div>
                <p className={cn("text-lg font-bold", c.text)}>{value}</p>
                <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
            </div>
        </motion.div>
    )
}

/* ============================================
   QUICK ACTION
   ============================================ */

function QuickAction({ href, icon: Icon, label, desc }: {
    href: string
    icon: React.ElementType
    label: string
    desc: string
}) {
    return (
        <Link
            href={href}
            className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] transition-all group"
        >
            <div className="w-9 h-9 rounded-lg bg-brand-subtle flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-brand transition-colors">{label}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-brand transition-colors flex-shrink-0" />
        </Link>
    )
}

/* ============================================
   OWNER DASHBOARD
   ============================================ */

function OwnerDashboard() {
    const restaurant = useAuthStore(state => state.restaurant)
    const [dateRange, setDateRange] = useState(7)

    const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats()
    const { data: revenueData, loading: revenueLoading, refetch: refetchRevenue } = useRevenueChart(dateRange)
    const { data: statusData, loading: statusLoading, refetch: refetchStatus } = useOrdersByStatus()
    const { data: hourlyData, loading: hourlyLoading, refetch: refetchHourly } = useHourlyOrders()
    const { data: categoryData, loading: categoryLoading, refetch: refetchCategory } = useCategoryBreakdown()
    const { orders: recentOrders, loading: recentLoading, refetch: refetchRecent } = useRecentOrders(10)

    const isLoading = statsLoading
    const refreshAll = () => {
        refetchStats(); refetchRevenue(); refetchStatus(); refetchHourly(); refetchCategory(); refetchRecent()
    }

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-6 min-w-0"
        >
            {/* Header */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                        Welcome back, <span className="text-brand">{restaurant?.name?.split(' ')[0] || 'Owner'}</span>
                    </h1>
                    <p className="text-sm text-[var(--text-muted)] mt-1 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={dateRange}
                        onChange={e => setDateRange(Number(e.target.value))}
                        className="h-9 px-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] outline-none focus:border-brand cursor-pointer"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                    </select>
                    <button
                        onClick={refreshAll}
                        disabled={isLoading}
                        className="h-9 px-3 rounded-lg bg-brand-subtle text-brand hover:bg-brand/20 border border-brand/20 transition-colors disabled:opacity-50 flex items-center gap-2 text-xs font-medium"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                        Refresh
                    </button>
                </div>
            </motion.div>

            {statsError && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-red-500" />
                        <div>
                            <p className="text-sm font-medium text-red-400">Failed to load dashboard data</p>
                            <p className="text-xs text-[var(--text-muted)]">{statsError}</p>
                        </div>
                    </div>
                    <button onClick={refreshAll} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors">Retry</button>
                </motion.div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Today's Revenue" value={stats ? formatCurrency(stats.todayRevenue) : 'PKR 0'}
                    change={stats?.revenueChange != null ? formatPercentage(Math.abs(stats.revenueChange)) : undefined}
                    trend={stats?.revenueChange != null ? (stats.revenueChange >= 0 ? 'up' : 'down') : undefined}
                    icon={DollarSign} loading={isLoading} delay={0} />
                <StatCard title="Total Orders" value={stats?.todayOrders ?? 0}
                    change={stats?.orderChange != null ? formatPercentage(Math.abs(stats.orderChange)) : undefined}
                    trend={stats?.orderChange != null ? (stats.orderChange >= 0 ? 'up' : 'down') : undefined}
                    icon={ClipboardList} loading={isLoading} delay={0.05} />
                <StatCard title="Avg Order Value" value={stats ? formatCurrency(stats.avgOrderValue) : 'PKR 0'}
                    icon={TrendingUp} loading={isLoading} delay={0.1} />
                <StatCard title="Active Staff" value={`${stats?.activeStaff ?? 0}/${stats?.totalStaff ?? 0}`}
                    icon={Users} loading={isLoading} delay={0.15} />
            </div>

            {/* Status pills */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatusPill icon={Clock} label="Pending" value={stats?.pendingOrders ?? 0} color="yellow" delay={0.2} />
                <StatusPill icon={ChefHat} label="Preparing" value={stats?.preparingOrders ?? 0} color="blue" delay={0.25} />
                <StatusPill icon={Receipt} label="Completed" value={stats?.completedOrders ?? 0} color="emerald" delay={0.3} />
                <StatusPill icon={MapPin} label="Tables" value={`${stats?.activeTables ?? 0}/${stats?.totalTables ?? 0}`} color="violet" delay={0.35} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <RevenueChart data={revenueData} loading={revenueLoading} error={null} onRefresh={refetchRevenue} />
                <OrdersStatusChart data={statusData} loading={statusLoading} error={null} onRefresh={refetchStatus} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <HourlyOrdersChart data={hourlyData} loading={hourlyLoading} error={null} onRefresh={refetchHourly} />
                <CategoryChart data={categoryData} loading={categoryLoading} error={null} onRefresh={refetchCategory} />
            </div>

            {/* Bottom section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                    <RecentActivity orders={recentOrders} loading={recentLoading} error={null} onRefresh={refetchRecent} />
                </div>
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Quick Actions</h3>
                    <QuickAction href="/dashboard/take-order" icon={Zap} label="Take Order" desc="Create a new order quickly" />
                    <QuickAction href="/dashboard/tables" icon={Table2} label="Manage Tables" desc="View and update table status" />
                    <QuickAction href="/dashboard/menu" icon={ShoppingBag} label="Update Menu" desc="Edit items and availability" />
                    <QuickAction href="/dashboard/staff" icon={Users} label="Manage Staff" desc="Add or edit team members" />
                </div>
            </div>
        </motion.div>
    )
}

/* ============================================
   WAITER DASHBOARD
   ============================================ */

function WaiterDashboard() {
    const { stats } = useDashboardStats()
    const { stats: waiterStats, loading } = useWaiterStats()
    const today = new Date().toISOString().split('T')[0]

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Waiter Station</h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">{today}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard title="My Orders" value={waiterStats?.myOrders ?? 0} icon={MapPin} loading={loading} />
                <StatCard title="Completed" value={waiterStats?.completedToday ?? 0} icon={ClipboardList} loading={loading} />
                <StatCard title="Tips Today" value={formatCurrency(waiterStats?.myTips ?? 0)} icon={DollarSign} loading={loading} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <QuickAction href="/dashboard/take-order" icon={Zap} label="Take Order" desc="Create a new order" />
                <QuickAction href="/dashboard/tables" icon={Table2} label="My Tables" desc="View assigned tables" />
            </div>
        </div>
    )
}

/* ============================================
   KITCHEN DASHBOARD
   ============================================ */

function KitchenDashboard() {
    const { stats } = useDashboardStats()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Kitchen Overview</h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">Real-time queue status</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard title="Pending" value={stats?.pendingOrders ?? 0} icon={Clock} loading={!stats} />
                <StatCard title="Preparing" value={stats?.preparingOrders ?? 0} icon={ChefHat} loading={!stats} />
                <StatCard title="Completed" value={stats?.completedOrders ?? 0} icon={Receipt} loading={!stats} />
            </div>
            <QuickAction href="/dashboard/kitchen" icon={ChefHat} label="Open KDS" desc="Full-screen kitchen display" />
        </div>
    )
}

/* ============================================
   CASHIER DASHBOARD
   ============================================ */

function CashierDashboard() {
    const { stats, loading } = useDashboardStats()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Cashier Station</h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">Process payments and manage bills</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard title="Today's Revenue" value={stats ? formatCurrency(stats.todayRevenue) : 'PKR 0'} icon={DollarSign} loading={loading} />
                <StatCard title="Transactions" value={stats?.todayOrders ?? 0} icon={ClipboardList} loading={loading} />
                <StatCard title="Avg Order" value={stats ? formatCurrency(stats.avgOrderValue) : 'PKR 0'} icon={Percent} loading={loading} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <QuickAction href="/dashboard/billing" icon={Wallet} label="Process Payments" desc="View and settle bills" />
                <QuickAction href="/dashboard/cashier" icon={DollarSign} label="Cashier POS" desc="Quick payment terminal" />
            </div>
        </div>
    )
}

/* ============================================
   DELIVERY DASHBOARD
   ============================================ */

function DeliveryDashboard() {
    const { stats: deliveryStats, loading } = useDeliveryStats()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Delivery Dashboard</h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">Track deliveries and earnings</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard title="Active Deliveries" value={deliveryStats?.activeDeliveries ?? 0} icon={Truck} loading={loading} />
                <StatCard title="Completed" value={deliveryStats?.completedToday ?? 0} icon={Receipt} loading={loading} />
                <StatCard title="Earnings" value={formatCurrency(deliveryStats?.myEarnings ?? 0)} icon={DollarSign} loading={loading} />
            </div>
            <QuickAction href="/dashboard/delivery-boy" icon={MapPin} label="My Deliveries" desc="View assigned delivery orders" />
        </div>
    )
}

/* ============================================
   MAIN DISPATCH
   ============================================ */

export default function RoleBasedDashboard() {
    const role = useUserRole()

    switch (role) {
        case 'waiter': return <WaiterDashboard />
        case 'kitchen': return <KitchenDashboard />
        case 'cashier': return <CashierDashboard />
        case 'delivery':
        case 'rider': return <DeliveryDashboard />
        case 'owner':
        case 'manager':
        default: return <OwnerDashboard />
    }
}
