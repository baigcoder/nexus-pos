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
        <div className={cn('animate-pulse', className)}>
            <div className="h-4 w-24 bg-[var(--surface-active)] rounded mb-4" />
            <div className="h-64 bg-[var(--surface-active)]/50 rounded-xl" />
        </div>
    )
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
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <ChartSkeleton />
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Revenue Trend</h3>
                </div>
                <div className="h-64 flex items-center justify-center text-red-400 text-sm">
                    {error} <button onClick={onRefresh} className="ml-2 text-brand hover:underline">Retry</button>
                </div>
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Revenue Trend</h3>
                    {onRefresh && (
                        <button onClick={onRefresh} className="p-2 hover:bg-[var(--surface-active)] rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                    )}
                </div>
                <div className="h-64 flex items-center justify-center text-[var(--text-muted)] text-sm">
                    No revenue data available
                </div>
            </div>
        )
    }

    return (
        <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Revenue Trend</h3>
                {onRefresh && (
                    <button onClick={onRefresh} className="p-2 hover:bg-[var(--surface-active)] rounded-lg transition-colors">
                        <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
                    </button>
                )}
            </div>
            <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        axisLine={{ stroke: '#27272a' }}
                    />
                    <YAxis
                        tickFormatter={formatCurrency}
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        axisLine={{ stroke: '#27272a' }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#141414',
                            border: '1px solid #262626',
                            borderRadius: '8px',
                            color: '#fafafa'
                        }}
                        labelFormatter={(label: any) => formatDate(label)}
                        formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
                    />
                    <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#f97316"
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
    pending: '#fbbf24',    // Yellow
    preparing: '#3b82f6',  // Blue
    ready: '#a855f7',      // Purple
    served: '#8b5cf6',     // Violet
    paid: '#10b981',        // Emerald
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
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <ChartSkeleton />
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Orders by Status</h3>
                <div className="h-48 flex items-center justify-center text-red-400 text-sm">
                    {error} <button onClick={onRefresh} className="ml-2 text-brand hover:underline">Retry</button>
                </div>
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Orders by Status</h3>
                    {onRefresh && (
                        <button onClick={onRefresh} className="p-2 hover:bg-[var(--surface-active)] rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                    )}
                </div>
                <div className="h-48 flex items-center justify-center text-[var(--text-muted)] text-sm">
                    No order status data available
                </div>
            </div>
        )
    }

    return (
        <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Orders by Status</h3>
                {onRefresh && (
                    <button onClick={onRefresh} className="p-2 hover:bg-[var(--surface-active)] rounded-lg transition-colors">
                        <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
                    </button>
                )}
            </div>
            <div className="flex items-center justify-between">
                <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={STATUS_COLORS[entry.status] || '#71717a'}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#141414',
                                border: '1px solid #262626',
                                borderRadius: '8px',
                                color: '#fafafa'
                            }}
                            formatter={(value: any, name: any) => [
                                value,
                                STATUS_LABELS[name as OrderStatus] || name
                            ]}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 pl-4 space-y-2">
                    {data.map((item) => (
                        <div key={item.status} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: STATUS_COLORS[item.status] }}
                                />
                                <span className="text-[var(--text-muted)]">{STATUS_LABELS[item.status]}</span>
                            </div>
                            <span className="text-[var(--text-primary)] font-semibold">{item.count}</span>
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
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <ChartSkeleton />
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Orders by Hour</h3>
                <div className="h-48 flex items-center justify-center text-red-400 text-sm">
                    {error} <button onClick={onRefresh} className="ml-2 text-brand hover:underline">Retry</button>
                </div>
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Orders by Hour</h3>
                    {onRefresh && (
                        <button onClick={onRefresh} className="p-2 hover:bg-[var(--surface-active)] rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                    )}
                </div>
                <div className="h-48 flex items-center justify-center text-[var(--text-muted)] text-sm">
                    No hourly data available
                </div>
            </div>
        )
    }

    return (
        <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Orders by Hour</h3>
                {onRefresh && (
                    <button onClick={onRefresh} className="p-2 hover:bg-[var(--surface-active)] rounded-lg transition-colors">
                        <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
                    </button>
                )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                    <XAxis
                        dataKey="hour"
                        tickFormatter={formatHour}
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        axisLine={{ stroke: '#27272a' }}
                    />
                    <YAxis
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        axisLine={{ stroke: '#27272a' }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#141414',
                            border: '1px solid #262626',
                            borderRadius: '8px',
                            color: '#fafafa'
                        }}
                        labelFormatter={(label: any) => formatHour(label)}
                        formatter={(value: any) => [value, 'Orders']}
                    />
                    <Bar
                        dataKey="orders"
                        fill="#f97316"
                        radius={[4, 4, 0, 0]}
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
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <ChartSkeleton />
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Top Categories</h3>
                <div className="h-48 flex items-center justify-center text-red-400 text-sm">
                    {error} <button onClick={onRefresh} className="ml-2 text-brand hover:underline">Retry</button>
                </div>
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Top Categories</h3>
                    {onRefresh && (
                        <button onClick={onRefresh} className="p-2 hover:bg-[var(--surface-active)] rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                    )}
                </div>
                <div className="h-48 flex items-center justify-center text-[var(--text-muted)] text-sm">
                    No category data available
                </div>
            </div>
        )
    }

    const topCategories = data.slice(0, 6)

    return (
        <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Top Categories</h3>
                {onRefresh && (
                    <button onClick={onRefresh} className="p-2 hover:bg-[var(--surface-active)] rounded-lg transition-colors">
                        <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
                    </button>
                )}
            </div>
            <div className="space-y-4">
                {topCategories.map((item, index) => {
                    const maxRevenue = Math.max(...topCategories.map(c => c.revenue))
                    const percentage = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0

                    return (
                        <div key={item.category} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-[var(--text-muted)] font-medium">{item.category}</span>
                                <span className="text-[var(--text-primary)] font-semibold">{formatCurrency(item.revenue)}</span>
                            </div>
                            <div className="h-2 bg-[var(--surface-active)] rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ delay: index * 0.1, duration: 0.5 }}
                                    className="h-full bg-gradient-to-r from-brand to-brand-hover rounded-full"
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
        served: { color: 'text-violet-400', bg: 'bg-violet-500/10', label: 'Served' },
        paid: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Paid' },
        cancelled: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Cancelled' }
    }
    return configs[status] || configs.pending
}

export function RecentActivity({ orders, loading, error, onRefresh }: RecentActivityProps) {
    if (loading) {
        return (
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="animate-pulse flex items-center gap-4">
                            <div className="w-12 h-12 bg-[var(--surface-active)] rounded-xl" />
                            <div className="flex-1">
                                <div className="h-4 bg-[var(--surface-active)] rounded w-3/4 mb-2" />
                                <div className="h-3 bg-[var(--surface-active)] rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Recent Activity</h2>
                <div className="h-48 flex items-center justify-center text-red-400 text-sm">
                    {error} <button onClick={onRefresh} className="ml-2 text-brand hover:underline">Retry</button>
                </div>
            </div>
        )
    }

    if (!orders || orders.length === 0) {
        return (
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Recent Activity</h2>
                    {onRefresh && (
                        <button onClick={onRefresh} className="p-2 hover:bg-[var(--surface-active)] rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                    )}
                </div>
                <div className="h-48 flex items-center justify-center text-[var(--text-muted)] text-sm">
                    No recent orders
                </div>
            </div>
        )
    }

    return (
        <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Recent Activity</h2>
                {onRefresh && (
                    <button onClick={onRefresh} className="p-2 hover:bg-[var(--surface-active)] rounded-lg transition-colors">
                        <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
                    </button>
                )}
            </div>
            <div className="space-y-4">
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
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between py-3 border-b border-[var(--border)]/50 last:border-0"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center">
                                    <span className="text-brand font-bold">#{order.order_number}</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                                            Order #{order.order_number}
                                        </p>
                                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusConfig.bg, statusConfig.color)}>
                                            {statusConfig.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                        {order.table_number ? `Table ${order.table_number}` : 'Takeaway'} - {formatCurrency(order.total)}
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs text-[var(--text-muted)] font-medium">{getTimeAgo(order.created_at)}</span>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}