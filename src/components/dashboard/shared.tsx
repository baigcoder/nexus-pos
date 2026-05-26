'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
    ArrowUpRight,
    ArrowDownRight,
    LucideIcon,
    Loader2,
    Search,
    X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ============================================
   ANIMATION VARIANTS
   ============================================ */

export const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.04, delayChildren: 0.05 },
    },
}

export const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.35, ease: "easeOut" as const },
    },
}

export const fadeIn = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

/* ============================================
   PAGE HEADER
   ============================================ */

interface PageHeaderProps {
    title: string
    highlight?: string
    subtitle?: React.ReactNode
    badge?: string
    badgeTone?: 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
    actions?: React.ReactNode
}

export function PageHeader({
    title,
    highlight,
    subtitle,
    badge,
    badgeTone = 'brand',
    actions,
}: PageHeaderProps) {
    const toneMap = {
        brand: 'bg-brand-subtle border-brand/20 text-brand',
        success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
        warning: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
        error: 'bg-rose-500/10 border-rose-500/20 text-rose-500',
        info: 'bg-sky-500/10 border-sky-500/20 text-sky-500',
        neutral: 'bg-[var(--surface-active)] border-[var(--border)] text-[var(--text-muted)]',
    }

    return (
        <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="show"
            className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"
        >
            <div>
                {badge && (
                    <span
                        className={cn(
                            'inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider mb-3',
                            toneMap[badgeTone]
                        )}
                    >
                        {badge}
                    </span>
                )}
                <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
                    {title}{' '}
                    {highlight && (
                        <span className="text-brand">{highlight}</span>
                    )}
                </h1>
                {subtitle && (
                    <p className="text-sm text-[var(--text-muted)] mt-1.5">
                        {subtitle}
                    </p>
                )}
            </div>
            {actions && (
                <div className="flex items-center gap-2 flex-shrink-0">
                    {actions}
                </div>
            )}
        </motion.div>
    )
}

/* ============================================
   STAT CARD
   ============================================ */

interface StatCardProps {
    label: string
    value: string | number
    change?: number
    changeLabel?: string
    icon: LucideIcon
    tone?: 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
    className?: string
    delay?: number
    loading?: boolean
}

export function StatCard({
    label,
    value,
    change,
    changeLabel,
    icon: Icon,
    tone = 'brand',
    className,
    delay = 0,
    loading = false,
}: StatCardProps) {
    const toneMap = {
        brand: {
            iconBg: 'bg-brand-subtle',
            iconColor: 'text-brand',
        },
        success: {
            iconBg: 'bg-emerald-500/10',
            iconColor: 'text-emerald-500',
        },
        warning: {
            iconBg: 'bg-amber-500/10',
            iconColor: 'text-amber-500',
        },
        error: {
            iconBg: 'bg-rose-500/10',
            iconColor: 'text-rose-500',
        },
        info: {
            iconBg: 'bg-sky-500/10',
            iconColor: 'text-sky-500',
        },
        neutral: {
            iconBg: 'bg-[var(--surface-active)]',
            iconColor: 'text-[var(--text-muted)]',
        },
    }

    const t = toneMap[tone]

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
            className={cn(
                'bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-strong)] transition-all duration-300 group',
                className
            )}
        >
            <div className="flex items-start justify-between mb-3">
                <div
                    className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        t.iconBg
                    )}
                >
                    <Icon className={cn('w-5 h-5', t.iconColor)} />
                </div>
                {change !== undefined && (
                    <div
                        className={cn(
                            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
                            change >= 0
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-rose-500/10 text-rose-500'
                        )}
                    >
                        {change >= 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                        ) : (
                            <ArrowDownRight className="w-3 h-3" />
                        )}
                        {changeLabel || `${Math.abs(change)}%`}
                    </div>
                )}
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                {value}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                {label}
            </p>
        </motion.div>
    )
}

/* ============================================
   MINI STAT
   ============================================ */

export function MiniStat({
    label,
    value,
    icon: Icon,
    tone = 'brand',
}: {
    label: string
    value: string | number
    icon: LucideIcon
    tone?: 'brand' | 'success' | 'warning' | 'error' | 'info'
}) {
    const toneMap = {
        brand: 'text-brand bg-brand-subtle border-brand/20',
        success: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        error: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        info: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    }

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl border bg-[var(--surface-raised)]">
            <div
                className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center',
                    toneMap[tone]
                )}
            >
                <Icon className="w-4 h-4" />
            </div>
            <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                    {value}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] font-medium">
                    {label}
                </p>
            </div>
        </div>
    )
}

/* ============================================
   STATUS BADGE
   ============================================ */

export function StatusBadge({
    label,
    tone = 'neutral',
    icon: Icon,
    dot = true,
}: {
    label: string
    tone?: 'success' | 'warning' | 'error' | 'info' | 'brand' | 'neutral'
    icon?: LucideIcon
    dot?: boolean
}) {
    const toneMap = {
        success:
            'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        warning:
            'bg-amber-500/10 text-amber-500 border-amber-500/20',
        error: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
        info: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
        brand: 'bg-brand-subtle text-brand border-brand/20',
        neutral:
            'bg-[var(--surface-active)] text-[var(--text-muted)] border-[var(--border)]',
    }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                toneMap[tone]
            )}
        >
            {dot && (
                <span
                    className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        tone === 'success' && 'bg-emerald-500',
                        tone === 'warning' && 'bg-amber-500',
                        tone === 'error' && 'bg-rose-500',
                        tone === 'info' && 'bg-sky-500',
                        tone === 'brand' && 'bg-brand',
                        tone === 'neutral' && 'bg-[var(--text-muted)]'
                    )}
                />
            )}
            {Icon && <Icon className="w-3 h-3" />}
            {label}
        </span>
    )
}

/* ============================================
   SEARCH INPUT
   ============================================ */

export function DashboardSearch({
    value,
    onChange,
    placeholder = 'Search...',
    className,
}: {
    value: string
    onChange: (val: string) => void
    placeholder?: string
    className?: string
}) {
    return (
        <div className={cn('relative', className)}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-10 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg pl-10 pr-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-muted)] transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    )
}

/* ============================================
   FILTER BUTTONS
   ============================================ */

export function FilterButton({
    label,
    active,
    onClick,
    count,
}: {
    label: string
    active: boolean
    onClick: () => void
    count?: number
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all border',
                active
                    ? 'bg-brand text-white border-brand shadow-glow'
                    : 'bg-[var(--surface-raised)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
            )}
        >
            {label}
            {count !== undefined && (
                <span
                    className={cn(
                        'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                        active
                            ? 'bg-white/20 text-white'
                            : 'bg-[var(--surface-active)] text-[var(--text-muted)]'
                    )}
                >
                    {count}
                </span>
            )}
        </button>
    )
}

/* ============================================
   EMPTY STATE
   ============================================ */

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: LucideIcon
    title: string
    description: string
    action?: { label: string; onClick: () => void }
}) {
    return (
        <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center justify-center py-20 text-center"
        >
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-brand/10 blur-xl rounded-full" />
                <div className="w-20 h-20 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center relative">
                    <Icon className="w-10 h-10 text-[var(--text-muted)]" />
                </div>
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                {title}
            </h3>
            <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6">
                {description}
            </p>
            {action && (
                <button
                    onClick={action.onClick}
                    className="h-10 px-5 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm font-medium transition-all shadow-glow"
                >
                    {action.label}
                </button>
            )}
        </motion.div>
    )
}

/* ============================================
   LOADING STATE
   ============================================ */

export function PageLoading() {
    return (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-brand" />
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider animate-pulse">
                Loading...
            </p>
        </div>
    )
}

/* ============================================
   SECTION CARD
   ============================================ */

export function SectionCard({
    children,
    className,
    title,
    action,
    noPadding = false,
}: {
    children: React.ReactNode
    className?: string
    title?: string
    action?: React.ReactNode
    noPadding?: boolean
}) {
    return (
        <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="show"
            className={cn(
                'bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl overflow-hidden',
                className
            )}
        >
            {(title || action) && (
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    {title && (
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                            {title}
                        </h3>
                    )}
                    {action && <div className="flex items-center gap-2">{action}</div>}
                </div>
            )}
            <div className={cn(!noPadding && 'p-5')}>{children}</div>
        </motion.div>
    )
}

/* ============================================
   ACTION BUTTON
   ============================================ */

export function ActionButton({
    children,
    onClick,
    variant = 'primary',
    icon: Icon,
    disabled = false,
    className,
    href,
}: {
    children: React.ReactNode
    onClick?: () => void
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    icon?: LucideIcon
    disabled?: boolean
    className?: string
    href?: string
}) {
    const variants = {
        primary:
            'bg-brand hover:bg-brand-hover text-white shadow-glow border-transparent',
        secondary:
            'bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]',
        ghost:
            'bg-transparent border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]',
        danger:
            'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500/20',
    }

    const classes = cn(
        'h-10 px-4 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border disabled:opacity-50',
        variants[variant],
        className
    )

    if (href) {
        return (
            <a href={href} className={classes}>
                {Icon && <Icon className="w-4 h-4" />}
                {children}
            </a>
        )
    }

    return (
        <button onClick={onClick} disabled={disabled} className={classes}>
            {Icon && <Icon className="w-4 h-4" />}
            {children}
        </button>
    )
}

/* ============================================
   DATA TABLE
   ============================================ */

interface Column<T> {
    key: string
    header: string
    width?: string
    align?: 'left' | 'center' | 'right'
    render: (row: T, index: number) => React.ReactNode
}

export function DataTable<T extends { id: string }>({
    columns,
    data,
    keyExtractor,
    onRowClick,
    emptyState,
}: {
    columns: Column<T>[]
    data: T[]
    keyExtractor?: (row: T) => string
    onRowClick?: (row: T) => void
    emptyState?: React.ReactNode
}) {
    if (data.length === 0 && emptyState) {
        return <>{emptyState}</>
    }

    return (
        <div className="rounded-xl overflow-hidden bg-[var(--surface-raised)] border border-[var(--border)]">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={cn(
                                        'px-5 py-3.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider',
                                        col.align === 'center' && 'text-center',
                                        col.align === 'right' && 'text-right',
                                        col.width
                                    )}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {data.map((row, idx) => (
                            <tr
                                key={keyExtractor ? keyExtractor(row) : row.id}
                                onClick={() => onRowClick?.(row)}
                                className={cn(
                                    'group transition-colors',
                                    onRowClick && 'cursor-pointer hover:bg-[var(--surface-hover)]'
                                )}
                            >
                                {columns.map((col) => (
                                    <td
                                        key={col.key}
                                        className={cn(
                                            'px-5 py-4',
                                            col.align === 'center' && 'text-center',
                                            col.align === 'right' && 'text-right'
                                        )}
                                    >
                                        {col.render(row, idx)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

/* ============================================
   ICON BUTTON
   ============================================ */

export function IconButton({
    icon: Icon,
    onClick,
    tone = 'neutral',
    label,
    className,
}: {
    icon: LucideIcon
    onClick?: () => void
    tone?: 'neutral' | 'brand' | 'danger' | 'success'
    label?: string
    className?: string
}) {
    const toneMap = {
        neutral:
            'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]',
        brand: 'bg-brand-subtle border-brand/20 text-brand hover:bg-brand/20',
        danger:
            'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500/20',
        success:
            'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20',
    }

    return (
        <button
            onClick={onClick}
            aria-label={label}
            className={cn(
                'h-9 w-9 rounded-lg border flex items-center justify-center transition-all',
                toneMap[tone],
                className
            )}
        >
            <Icon className="w-4 h-4" />
        </button>
    )
}
