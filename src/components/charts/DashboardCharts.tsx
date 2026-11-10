'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line
} from 'recharts'
import { cn } from '@/lib/utils'
import type { RevenueDataPoint, StatusBreakdown, HourlyDataPoint, CategoryBreakdown } from '@/hooks/use-dashboard-data'
import type { OrderStatus } from '@/types/database'

// ============================================
// Loading Skeleton Component
// ============================================

export function ChartSkeleton({ className = '' }: { className?: string }) {
    return (
        <div className={cn('animate-pulse space-y-4', className)}>
            <div className="h-4 w-24 bg-[var(--surface-raised)] rounded" />
            <div className="h-64 bg-[var(--surface-raised)] rounded-xl border border-[var(--border)]" />
        </div>
    )
}

const customTooltipStyle = {
    backgroundColor: 'var(--surface-raised)',
    border: '1px solid var(--border-strong)',
    borderRadius: '14px',
    color: 'var(--text-primary)',
    fontSize: '11px',
    fontWeight: '600',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
}

// ============================================
// Revenue Trend Chart
// ============================================

interface RevenueChartProps {
    data: RevenueDataPoint[]
    loading?: boolean
    error?: string | null
    onRefresh?: () => void
}

export function RevenueChart({ data, loading, error, onRefresh }: RevenueChartProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value)
    }

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    if (loading) {
        return (
            <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <ChartSkeleton />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">Revenue Trend</h3>
                </div>
                <div className="h-64 flex items-center justify-center text-red-400 text-xs font-semibold">
                    {error} <button type="button" aria-label="Refresh chart" onClick={onRefresh} className="ml-2 text-brand hover:underline cursor-pointer">Retry</button>
                </div>
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">Revenue Trend</h3>
                    {onRefresh && (
                        <button type="button" aria-label="Refresh chart" onClick={onRefresh} className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors cursor-pointer">
                            <RefreshCw className="w-4 h-4 text-[var(--text-secondary)]" />
                        </button>
                    )}
                </div>
                <div className="h-64 flex items-center justify-center text-[var(--text-secondary)] text-xs font-semibold">
                    No revenue data available
                </div>
            </div>
        )
    }

    return (
        <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">Revenue Trend</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Daily gross checkout sales</p>
                </div>
                {onRefresh && (
                    <button type="button" aria-label="Refresh chart" onClick={onRefresh} className="p-2 hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-xl transition-all cursor-pointer">
                        <RefreshCw className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    </button>
                )}
            </div>
            <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        stroke="var(--text-secondary)"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 'bold' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tickFormatter={formatCurrency}
                        stroke="var(--text-secondary)"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 'bold' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        contentStyle={customTooltipStyle}
                        labelFormatter={(label: any) => formatDate(label)}
                        formatter={(value: any) => [formatCurrency(Number(value)), 'Gross Revenue']}
                    />
                    <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--brand)"
                        strokeWidth={2}
                        fill="url(#revenueGradient)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

// ============================================
// Orders by Status Chart (Pie)
// ============================================

const STATUS_COLORS: Record<OrderStatus, string> = {
    pending: '#f59e0b',    // Orange/Yellow
    preparing: '#3b82f6',  // Blue
    ready: '#a855f7',      // Purple
    served: '#6366f1',     // Indigo
    paid: '#10b981',       // Emerald
    cancelled: '#ef4444'   // Red
}

const STATUS_LABELS: Record<OrderStatus, string> = {
    pending: 'Pending',
    preparing: 'Preparing',
    ready: 'Ready',
    served: 'Served',
    paid: 'Paid',
    cancelled: 'Cancelled'
}

interface OrdersStatusChartProps {
    data: StatusBreakdown[]
    loading?: boolean
    error?: string | null
    onRefresh?: () => void
}

export function OrdersStatusChart({ data, loading, error, onRefresh }: OrdersStatusChartProps) {
    if (loading) {
        return (
            <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <ChartSkeleton />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <h3 className="text-lg font-bold text-[var(--text-primary)] font-display mb-4">Orders by Status</h3>
                <div className="h-48 flex items-center justify-center text-red-400 text-xs font-semibold">
                    {error} <button type="button" aria-label="Refresh chart" onClick={onRefresh} className="ml-2 text-brand hover:underline cursor-pointer">Retry</button>
                </div>
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">Orders by Status</h3>
                    {onRefresh && (
                        <button type="button" aria-label="Refresh chart" onClick={onRefresh} className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors cursor-pointer">
                            <RefreshCw className="w-4 h-4 text-[var(--text-secondary)]" />
                        </button>
                    )}
                </div>
                <div className="h-48 flex items-center justify-center text-[var(--text-secondary)] text-xs font-semibold">
                    No order status data available
                </div>
            </div>
        )
    }

    return (
        <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">Orders by Status</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Real-time status breakdowns</p>
                </div>
                {onRefresh && (
                    <button type="button" aria-label="Refresh chart" onClick={onRefresh} className="p-2 hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-xl transition-all cursor-pointer">
                        <RefreshCw className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    </button>
                )}
            </div>
            <div className="flex items-center justify-between flex-wrap gap-4 sm:flex-nowrap">
                <ResponsiveContainer width="45%" height={180}>
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={3}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={STATUS_COLORS[entry.status] || '#71717a'}
                                    stroke="var(--surface)"
                                    strokeWidth={1}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={customTooltipStyle}
                            formatter={(value: any, name: any) => [
                                `${value} Orders`,
                                STATUS_LABELS[name as OrderStatus] || name
                            ]}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 pl-4 space-y-2.5">
                    {data.map((item) => (
                        <div key={item.status} className="flex items-center justify-between text-xs font-bold">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-2.5 h-2.5 rounded-full shadow-glow"
                                    style={{ backgroundColor: STATUS_COLORS[item.status], boxShadow: `0 0 10px ${STATUS_COLORS[item.status]}40` }}
                                />
                                <span className="text-[var(--text-secondary)]">{STATUS_LABELS[item.status]}</span>
                            </div>
                            <span className="text-[var(--text-primary)]">{item.count}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ============================================
// Hourly Orders Chart (Bar)
// ============================================

interface HourlyOrdersChartProps {
    data: HourlyDataPoint[]
    loading?: boolean
    error?: string | null
    onRefresh?: () => void
}

export function HourlyOrdersChart({ data, loading, error, onRefresh }: HourlyOrdersChartProps) {
    const formatHour = (hour: number) => {
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const h = hour % 12 || 12
        return `${h}${ampm}`
    }

    if (loading) {
        return (
            <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <ChartSkeleton />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <h3 className="text-lg font-bold text-[var(--text-primary)] font-display mb-4">Orders by Hour</h3>
                <div className="h-48 flex items-center justify-center text-red-400 text-xs font-semibold">
                    {error} <button type="button" aria-label="Refresh chart" onClick={onRefresh} className="ml-2 text-brand hover:underline cursor-pointer">Retry</button>
                </div>
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">Orders by Hour</h3>
                    {onRefresh && (
                        <button type="button" aria-label="Refresh chart" onClick={onRefresh} className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors cursor-pointer">
                            <RefreshCw className="w-4 h-4 text-[var(--text-secondary)]" />
                        </button>
                    )}
                </div>
                <div className="h-48 flex items-center justify-center text-[var(--text-secondary)] text-xs font-semibold">
                    No hourly data available
                </div>
            </div>
        )
    }

    return (
        <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">Orders by Hour</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Peak hour load distribution</p>
                </div>
                {onRefresh && (
                    <button type="button" aria-label="Refresh chart" onClick={onRefresh} className="p-2 hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-xl transition-all cursor-pointer">
                        <RefreshCw className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    </button>
                )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                        dataKey="hour"
                        tickFormatter={formatHour}
                        stroke="var(--text-secondary)"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 'bold' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        stroke="var(--text-secondary)"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 'bold' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        contentStyle={customTooltipStyle}
                        labelFormatter={(label: any) => formatHour(label)}
                        formatter={(value: any) => [value, 'Orders Filled']}
                    />
                    <Bar
                        dataKey="orders"
                        fill="var(--brand)"
                        radius={[5, 5, 0, 0]}
                        opacity={0.8}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

// ============================================
// Category Breakdown Chart (Horizontal Bar)
// ============================================

interface CategoryChartProps {
    data: CategoryBreakdown[]
    loading?: boolean
    error?: string | null
    onRefresh?: () => void
}

export function CategoryChart({ data, loading, error, onRefresh }: CategoryChartProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value)
    }

    if (loading) {
        return (
            <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <ChartSkeleton />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <h3 className="text-lg font-bold text-[var(--text-primary)] font-display mb-4">Top Categories</h3>
                <div className="h-48 flex items-center justify-center text-red-400 text-xs font-semibold">
                    {error} <button type="button" aria-label="Refresh chart" onClick={onRefresh} className="ml-2 text-brand hover:underline cursor-pointer">Retry</button>
                </div>
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">Top Categories</h3>
                    {onRefresh && (
                        <button type="button" aria-label="Refresh chart" onClick={onRefresh} className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors cursor-pointer">
                            <RefreshCw className="w-4 h-4 text-[var(--text-secondary)]" />
                        </button>
                    )}
                </div>
                <div className="h-48 flex items-center justify-center text-[var(--text-secondary)] text-xs font-semibold">
                    No category data available
                </div>
            </div>
        )
    }

    const topCategories = data.slice(0, 6)

    return (
        <div className="min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">Top Categories</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Sales contribution by menu branch</p>
                </div>
                {onRefresh && (
                    <button type="button" aria-label="Refresh chart" onClick={onRefresh} className="p-2 hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-xl transition-all cursor-pointer">
                        <RefreshCw className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    </button>
                )}
            </div>
            <div className="space-y-4">
                {topCategories.map((item, index) => {
                    const maxRevenue = Math.max(...topCategories.map(c => c.revenue))
                    const percentage = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0

                    return (
                        <div key={item.category} className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-[var(--text-secondary)] font-display">{item.category}</span>
                                <span className="text-[var(--text-primary)]">{formatCurrency(item.revenue)}</span>
                            </div>
                            <div className="h-2 bg-[var(--surface-raised)] rounded-full overflow-hidden border border-[var(--border)]">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ delay: index * 0.08, duration: 0.5 }}
                                    className="h-full bg-gradient-to-r from-brand to-purple-500 rounded-full"
                                />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ============================================
// Recent Orders Activity List
// ============================================

interface RecentActivityProps {
    orders: Array<{
        id: string
        order_number: number
        status: OrderStatus
        total: number
        created_at: string
        table_number?: string
    }>
    loading?: boolean
    error?: string | null
    onRefresh?: () => void
}

const getTimeAgo = (date: string) => {
    const now = new Date()
    const then = new Date(date)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    return `${Math.floor(diffHours / 24)}d ago`
}

const getStatusConfig = (status: OrderStatus) => {
    const configs: Record<OrderStatus, { color: string; bg: string; label: string }> = {
        pending: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Pending' },
        preparing: { color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Preparing' },
        ready: { color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Ready' },
        served: { color: 'text-indigo-400', bg: 'bg-indigo-500/10', label: 'Served' },
        paid: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Paid' },
        cancelled: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Cancelled' }
    }
    return configs[status] || configs.pending
}

export function RecentActivity({ orders, loading, error, onRefresh }: RecentActivityProps) {
    if (loading) {
        return (
            <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="animate-pulse flex items-center gap-4">
                            <div className="w-11 h-11 bg-white/5 rounded-xl border border-white/5" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3.5 bg-white/5 rounded w-3/4" />
                                <div className="h-2.5 bg-white/5 rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-display mb-4">Recent Activity</h2>
                <div className="h-48 flex items-center justify-center text-red-400 text-xs font-semibold">
                    {error} <button onClick={onRefresh} className="ml-2 text-brand hover:underline cursor-pointer">Retry</button>
                </div>
            </div>
        )
    }

    if (!orders || orders.length === 0) {
        return (
            <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider font-display">Recent Activity</h2>
                    {onRefresh && (
                        <button onClick={onRefresh} className="p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer">
                            <RefreshCw className="w-4 h-4 text-slate-400" />
                        </button>
                    )}
                </div>
                <div className="h-48 flex items-center justify-center text-slate-500 text-xs font-semibold">
                    No recent orders
                </div>
            </div>
        )
    }

    return (
        <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-6 backdrop-blur-md shadow-premium">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-widest font-display">Recent Activity</h2>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Kitchen streams and cashier outputs</p>
                </div>
                {onRefresh && (
                    <button onClick={onRefresh} className="p-2 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl transition-all cursor-pointer">
                        <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                )}
            </div>
            <div className="space-y-3.5">
                {orders.slice(0, 8).map((order, index) => {
                    const statusConfig = getStatusConfig(order.status)
                    const formatCurrency = (value: number) => {
                        return new Intl.NumberFormat('en-PK', {
                            style: 'currency',
                            currency: 'PKR',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                        }).format(value)
                    }

                    return (
                        <motion.div
                            key={order.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-brand/5 border border-brand/20 rounded-xl flex items-center justify-center shadow-glow">
                                    <span className="text-brand font-black text-xs">#{order.order_number}</span>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-bold text-white leading-none">
                                            Order #{order.order_number}
                                        </p>
                                        <span className={cn('text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border', statusConfig.bg, statusConfig.color, `border-${statusConfig.color.split('-')[1]}-500/20`)}>
                                            {statusConfig.label}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-semibold">
                                        {order.table_number ? `Table ${order.table_number}` : 'Takeaway'} • {formatCurrency(order.total)}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{getTimeAgo(order.created_at)}</span>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}