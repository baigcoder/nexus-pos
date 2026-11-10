'use client'

import { useState } from 'react'
import { hasPermission, useAuthStore, useRestaurantId, useUserRole } from '@/stores/auth-store'
import { motion } from 'framer-motion'
import {
    ClipboardList, ChefHat, Truck, Plus,
    Receipt, Clock, DollarSign, RefreshCw,
    MapPin, ChevronRight, ArrowUpRight, ArrowDownRight,
    Zap, Table2, Percent, Wallet
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, formatPercentage, formatTime } from '@/lib/format'
import type { OrderStatus } from '@/types/database'
import {
    useDashboardStats, useRevenueChart, useOrdersByStatus,
    useHourlyOrders, useCategoryBreakdown, useRecentOrders,
} from '@/hooks/use-dashboard-data'
import { useWaiterStats } from '@/hooks/use-waiter-stats'
import { useDeliveryStats } from '@/hooks/use-delivery-stats'
import {
    RevenueChart, OrdersStatusChart, HourlyOrdersChart, CategoryChart,
} from '@/components/charts/DashboardCharts'
import { itemVariants } from '@/components/dashboard/shared'

/* ============================================
   STAT CARD WITH TELEMETRY SPARKLINES
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
            <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-5 animate-pulse space-y-4 backdrop-blur-md">
                <div className="w-10 h-10 bg-white/5 rounded-xl border border-white/5" />
                <div className="h-6 bg-white/5 rounded-lg w-2/3" />
                <div className="h-3 bg-white/5 rounded-lg w-1/2" />
            </div>
        )
    }
    return (
        <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="show"
            transition={{ delay }}
            className="bg-slate-950/60 border border-white/5 rounded-2xl p-5 shadow-premium hover:border-brand/40 hover:shadow-lg transition-all duration-300 group backdrop-blur-md relative overflow-hidden flex flex-col justify-between"
        >
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand/5 rounded-full blur-2xl pointer-events-none group-hover:bg-brand/10 transition-colors" />

            <div>
                <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-xl bg-brand/5 border border-brand/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shadow-glow">
                        <Icon className="w-4.5 h-4.5 text-brand" />
                    </div>
                    {change && (
                        <div className={cn(
                            "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            trend === 'up'
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                        )}>
                            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {change}
                        </div>
                    )}
                </div>

                <p className="text-2xl font-black text-white font-display tracking-tight mt-4">{value}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-widest">{title}</p>
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
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-brand/40 hover:bg-slate-900/60 hover:shadow-md transition-all duration-250 group cursor-pointer backdrop-blur-md"
        >
            <div className="w-9 h-9 rounded-xl bg-brand/5 border border-brand/20 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 shadow-glow">
                <Icon className="w-4.5 h-4.5 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white group-hover:text-brand transition-colors font-display uppercase tracking-wider">{label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-brand transition-colors flex-shrink-0" />
        </Link>
    )
}

/* ============================================
   OWNER DASHBOARD
   ============================================ */

const serviceStatuses: Record<OrderStatus, { label: string; tone: string }> = {
    pending: { label: 'Received', tone: 'bg-orange-100 text-orange-900' },
    preparing: { label: 'In prep', tone: 'bg-amber-100 text-amber-950' },
    ready: { label: 'Ready', tone: 'bg-emerald-100 text-emerald-900' },
    served: { label: 'Served', tone: 'bg-sky-100 text-sky-900' },
    paid: { label: 'Paid', tone: 'bg-emerald-100 text-emerald-900' },
    cancelled: { label: 'Cancelled', tone: 'bg-rose-100 text-rose-900' },
}

const ownerControl = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-60'

function OwnerDashboard() {
    const restaurant = useAuthStore(state => state.restaurant)
    const role = useUserRole()
    const [dateRange, setDateRange] = useState(7)
    const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats()
    const { data: revenueData, loading: revenueLoading, error: revenueError, refetch: refetchRevenue } = useRevenueChart(dateRange)
    const { data: statusData, loading: statusLoading, error: statusError, refetch: refetchStatus } = useOrdersByStatus()
    const { data: hourlyData, loading: hourlyLoading, error: hourlyError, refetch: refetchHourly } = useHourlyOrders()
    const { data: categoryData, loading: categoryLoading, error: categoryError, refetch: refetchCategory } = useCategoryBreakdown()
    const { orders, loading: recentLoading, error: recentError, refetch: refetchRecent } = useRecentOrders(10)
    const refreshing = statsLoading || recentLoading

    const refreshAll = () => {
        refetchStats()
        refetchRevenue()
        refetchStatus()
        refetchHourly()
        refetchCategory()
        refetchRecent()
    }

    const metrics = [
        { label: 'Order value today', value: stats && formatCurrency(stats.todayRevenue), change: stats?.revenueChange },
        { label: 'Orders today', value: stats?.todayOrders, change: stats?.orderChange },
        { label: 'Average order value', value: stats && formatCurrency(stats.avgOrderValue) },
        { label: 'Tables occupied', value: stats && `${stats.activeTables} / ${stats.totalTables}` },
    ]
    const attention = [
        { label: 'Awaiting the kitchen', value: stats?.pendingOrders, icon: ClipboardList },
        { label: 'In prep or ready', value: stats?.preparingOrders, icon: ChefHat },
    ]

    return (
        <div className="min-w-0 space-y-6 pb-4 text-[var(--text-primary)]">
            <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
                <div className="min-w-0">
                    <p className="flex items-center gap-2 font-mono text-xs font-semibold tracking-widest text-[var(--text-secondary)] uppercase">
                        <span className="h-0.5 w-4 shrink-0 bg-brand" />
                        <span className="truncate">{restaurant?.name || 'Restaurant overview'}</span>
                    </p>
                    <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">Today’s service</h1>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{formatDate(new Date())}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={refreshAll} disabled={refreshing} className={ownerControl}>
                        <RefreshCw size={15} aria-hidden="true" /> {refreshing ? 'Refreshing…' : 'Refresh'}
                    </button>
                    {role && hasPermission(role, 'page:take_order') && (
                        <Link href="/dashboard/take-order" className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-[#ff743d] px-4 text-sm font-bold text-[#201c18] transition-colors hover:bg-[#ff8b61]">
                            <Plus size={17} aria-hidden="true" /> New order
                        </Link>
                    )}
                </div>
            </header>

            {statsError && (
                <p role="alert" className="rounded-[8px] border border-rose-400/45 bg-rose-500/10 p-3 text-sm">
                    Couldn’t refresh the service totals. {stats && 'Showing the last available figures.'}
                </p>
            )}

            <dl aria-label="Today’s key figures" aria-busy={statsLoading} className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--border)] xl:grid-cols-4">
                {metrics.map(({ label, value, change }) => (
                    <div key={label} className="min-w-0 bg-[var(--surface)] p-3.5 sm:p-5">
                        <dt className="text-sm font-medium text-[var(--text-secondary)]">{label}</dt>
                        <dd className="mt-2 break-words font-display text-[clamp(1.35rem,2.4vw,2rem)] leading-tight font-bold tabular-nums tracking-tight">{value ?? '—'}</dd>
                        {change != null && (
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">{change >= 0 ? '+' : '−'}{formatPercentage(Math.abs(change))} vs yesterday</p>
                        )}
                    </div>
                ))}
            </dl>

            <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,2.15fr)_minmax(250px,1fr)]">
                <section aria-labelledby="recent-orders-title" aria-busy={recentLoading} className="min-w-0 overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
                    <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-4 sm:px-5">
                        <div>
                            <h2 id="recent-orders-title" className="font-display text-xl font-bold">Latest orders</h2>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">Most recent activity at this location</p>
                        </div>
                        {role && hasPermission(role, 'page:orders') && (
                            <Link href="/dashboard/orders" className={ownerControl}>View orders <ArrowUpRight size={14} aria-hidden="true" /></Link>
                        )}
                    </header>
                    {recentError && <p role="alert" className="border-b border-[var(--border)] p-4 text-sm">Couldn’t refresh orders. {orders.length > 0 && 'Showing the last available orders.'}</p>}
                    {orders.length > 0 ? (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[var(--surface-raised)] text-xs text-[var(--text-secondary)]">
                                <tr>
                                    <th scope="col" className="py-2.5 pl-4 sm:pl-5">Order</th>
                                    <th scope="col" className="hidden py-2.5 sm:table-cell">Time</th>
                                    <th scope="col" className="py-2.5 pl-2">Status</th>
                                    <th scope="col" className="py-2.5 pr-4 text-right sm:pr-5">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {orders.map(order => {
                                    const status = serviceStatuses[order.status]
                                    return (
                                        <tr key={order.id} className="hover:bg-[var(--surface-hover)]">
                                            <td className="py-2.5 pl-4 font-semibold tabular-nums sm:pl-5">
                                                #{order.order_number}
                                                <span className="block text-xs font-normal text-[var(--text-secondary)]">{order.table_number != null ? `Table ${order.table_number}` : 'No table'}</span>
                                            </td>
                                            <td className="hidden py-2.5 text-[var(--text-secondary)] sm:table-cell"><time dateTime={order.created_at} title={formatDate(order.created_at)}>{formatTime(order.created_at)}</time></td>
                                            <td className="py-2.5 pl-2">
                                                <span className={cn('inline-flex rounded-md px-2 py-1 text-xs font-semibold', status?.tone)}>{status?.label ?? order.status}</span>
                                            </td>
                                            <td className="py-2.5 pr-4 text-right font-semibold tabular-nums sm:pr-5">{formatCurrency(order.total)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="px-5 py-10 text-sm text-[var(--text-secondary)]">
                            {recentLoading ? 'Loading orders…' : recentError ? 'Try refreshing to load orders.' : 'New orders will appear here as they come in.'}
                        </div>
                    )}
                </section>

                <div className="space-y-4">
                    <section className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5" aria-labelledby="service-attention">
                        <h2 id="service-attention" className="font-display text-xl font-bold">Needs attention</h2>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">Today’s open kitchen work</p>
                        <dl className="my-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                            {attention.map(({ label, value, icon: Icon }) => (
                                <div key={label} className="flex items-center justify-between gap-2 py-3">
                                    <dt className="flex items-center gap-2 text-sm"><Icon size={16} aria-hidden="true" className="shrink-0 text-brand" />{label}</dt>
                                    <dd className="font-display text-xl font-bold tabular-nums">{value ?? '—'}</dd>
                                </div>
                            ))}
                        </dl>
                        {role && hasPermission(role, 'page:kitchen') && <Link href="/dashboard/kitchen" className={ownerControl}>Open kitchen <ArrowUpRight size={14} aria-hidden="true" /></Link>}
                    </section>
                    <section className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5" aria-labelledby="service-team">
                        <h2 id="service-team" className="font-display text-xl font-bold">Floor &amp; team</h2>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">{stats ? `${stats.activeStaff} of ${stats.totalStaff} staff accounts active` : 'Staff figures unavailable'}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {role && hasPermission(role, 'page:tables') && <Link href="/dashboard/tables" className={ownerControl}>Tables</Link>}
                            {role && hasPermission(role, 'page:menu') && <Link href="/dashboard/menu" className={ownerControl}>Menu</Link>}
                            {role && hasPermission(role, 'page:staff') && <Link href="/dashboard/staff" className={ownerControl}>Staff</Link>}
                        </div>
                    </section>
                </div>
            </div>

            <section aria-labelledby="service-insights" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="service-insights" className="font-display text-2xl font-bold">Service insights</h2>
                    <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                        Sales chart
                        <select value={dateRange} onChange={event => setDateRange(Number(event.target.value))} className={ownerControl}>
                            <option value={7}>Last 7 days</option>
                            <option value={14}>Last 14 days</option>
                            <option value={30}>Last 30 days</option>
                        </select>
                    </label>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                    <RevenueChart data={revenueData} loading={revenueLoading} error={revenueError} onRefresh={refetchRevenue} />
                    <OrdersStatusChart data={statusData} loading={statusLoading} error={statusError} onRefresh={refetchStatus} />
                    <HourlyOrdersChart data={hourlyData} loading={hourlyLoading} error={hourlyError} onRefresh={refetchHourly} />
                    <CategoryChart data={categoryData} loading={categoryLoading} error={categoryError} onRefresh={refetchCategory} />
                </div>
            </section>
        </div>
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
        <div className="space-y-6 bg-mesh-glow">
            <div>
                <h1 className="text-2xl font-black text-white font-display tracking-tight">Waiter Station</h1>
                <p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">{today}</p>
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
        <div className="space-y-6 bg-mesh-glow">
            <div>
                <h1 className="text-2xl font-black text-white font-display tracking-tight">Kitchen Overview</h1>
                <p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">Real-time queue status</p>
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
        <div className="space-y-6 bg-mesh-glow">
            <div>
                <h1 className="text-2xl font-black text-white font-display tracking-tight">Cashier Station</h1>
                <p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">Process payments and manage bills</p>
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
        <div className="space-y-6 bg-mesh-glow">
            <div>
                <h1 className="text-2xl font-black text-white font-display tracking-tight">Delivery Dashboard</h1>
                <p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">Track deliveries and earnings</p>
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
    const restaurantId = useRestaurantId()
    const role = useUserRole()

    switch (role) {
        case 'waiter': return <WaiterDashboard />
        case 'kitchen': return <KitchenDashboard />
        case 'cashier': return <CashierDashboard />
        case 'delivery':
        case 'rider': return <DeliveryDashboard />
        case 'owner':
        case 'manager':
        default: return <OwnerDashboard key={restaurantId} />
    }
}
