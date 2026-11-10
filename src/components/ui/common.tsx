'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LucideIcon, Loader2, Search, ArrowUpRight, ArrowDownRight, Terminal, X, Shield, Activity, Zap, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// CLEAN LAYOUT WRAPPER
// ============================================

interface CleanLayoutProps {
    children: React.ReactNode
    className?: string
    fullWidth?: boolean
}

export function PremiumLayout({ children, className, fullWidth = false }: CleanLayoutProps) {
    return (
        <div className={cn('min-h-screen bg-background text-foreground font-sans selection:bg-brand/20 transition-colors duration-300', className)}>
            <div className={cn(
                "mx-auto transition-all duration-500",
                fullWidth ? "max-w-none px-0" : "max-w-7xl px-4 sm:px-6 lg:px-8"
            )}>
                {children}
            </div>
        </div>
    )
}

// ============================================
// BUTTON COMPONENT
// ============================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'black' | 'white'
    size?: 'sm' | 'md' | 'lg'
    isLoading?: boolean
    icon?: LucideIcon
    iconPosition?: 'left' | 'right'
}

export function Button({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    icon: Icon,
    iconPosition = 'left',
    className,
    disabled,
    ...props
}: ButtonProps) {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 outline-none disabled:opacity-50 disabled:cursor-not-allowed rounded-xl relative overflow-hidden group select-none cursor-pointer'

    const variants = {
        primary: 'bg-brand text-white hover:bg-brand-hover shadow-md hover:shadow-lg active:scale-[0.98] transition-all',
        secondary: 'bg-surface-raised border border-border text-[var(--text-primary)] hover:bg-surface-hover hover:border-[var(--border-strong)] active:scale-[0.98] transition-all',
        black: 'bg-neutral-900 text-white hover:bg-black dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white shadow-md active:scale-[0.98]',
        ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
        danger: 'bg-error text-white hover:bg-error-subtle hover:text-red-500 border border-error/20 active:scale-[0.98]',
        outline: 'bg-transparent border border-border text-[var(--text-primary)] hover:bg-surface-hover hover:border-brand/40 active:scale-[0.98]',
        white: 'bg-white text-black hover:bg-neutral-100 shadow-md active:scale-[0.98]',
    }

    const sizes = {
        sm: 'px-4 py-2 text-xs',
        md: 'px-5 py-2.5 text-sm',
        lg: 'px-7 py-3 text-base',
    }

    return (
        <button
            className={cn(baseStyles, variants[variant], sizes[size], className)}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-current" />
            ) : (
                <>
                    {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />}
                    <span className="relative z-10">{children}</span>
                    {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" />}
                </>
            )}
        </button>
    )
}

// ============================================
// CARD COMPONENT
// ============================================

interface CardProps {
    children: React.ReactNode
    className?: string
    variant?: 'default' | 'flat' | 'outline' | 'glass'
    hover?: boolean
    onClick?: () => void
}

export function Card({ children, className, variant = 'default', hover = false, onClick }: CardProps) {
    const variants = {
        default: 'bg-surface border border-border/80 shadow-premium',
        flat: 'bg-surface-raised border border-border-subtle',
        outline: 'bg-transparent border border-border',
        glass: 'glass backdrop-blur-md',
    }

    const hoverClasses = hover ? 'hover:border-brand/40 hover:shadow-lg transition-all duration-300 hover:-translate-y-[2px] cursor-pointer' : ''

    if (onClick) {
        return (
            <motion.button
                onClick={onClick}
                className={cn(
                    'rounded-2xl p-6 relative overflow-hidden text-left',
                    variants[variant],
                    hoverClasses,
                    className
                )}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
                {children}
            </motion.button>
        )
    }

    return (
        <motion.div
            className={cn(
                'rounded-2xl p-6 relative overflow-hidden text-left',
                variants[variant],
                hoverClasses,
                className
            )}
        >
            {children}
        </motion.div>
    )
}

// ============================================
// BADGE COMPONENT
// ============================================

interface BadgeProps {
    children: React.ReactNode
    variant?: 'default' | 'success' | 'warning' | 'error' | 'primary' | 'neutral' | 'outline'
    className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
    const variants = {
        default: 'bg-surface-raised text-[var(--text-secondary)] border border-border',
        success: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
        warning: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
        error: 'bg-red-500/10 text-red-500 border border-red-500/20',
        primary: 'bg-brand-subtle text-brand border border-brand/20',
        neutral: 'bg-surface-raised text-[var(--text-muted)] border border-border',
        outline: 'border border-brand/30 bg-transparent text-brand',
    }

    return (
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide transition-all duration-300', variants[variant], className)}>
            {children}
        </span>
    )
}

// ============================================
// STAT CARD COMPONENT
// ============================================

export function StatCard({
    label,
    value,
    change,
    icon: Icon,
    sublabel,
    className
}: {
    label: string;
    value: string | number;
    change?: number;
    icon?: LucideIcon;
    sublabel?: string;
    className?: string;
}) {
    return (
        <Card className={cn("flex flex-col gap-4 border border-border/80 shadow-premium", className)}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
                {Icon && <div className="p-2.5 rounded-xl bg-brand-subtle"><Icon className="w-4 h-4 text-brand" /></div>}
            </div>

            <div className="flex items-end justify-between">
                <div>
                    <h3 className="text-3xl font-bold font-display text-[var(--text-primary)] tracking-tight">{value}</h3>
                    {sublabel && <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">{sublabel}</p>}
                </div>

                {change !== undefined && (
                    <div className={cn(
                        'flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full',
                        change >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                    )}>
                        {change >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {Math.abs(change)}%
                    </div>
                )}
            </div>
        </Card>
    )
}

// ============================================
// MODAL COMPONENT
// ============================================

const modalSizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
}

export function Modal({ isOpen, onClose, title, children, className, size = 'md' }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className={cn("relative bg-background border border-border rounded-3xl shadow-2xl w-full max-h-[90vh] flex flex-col overflow-hidden", modalSizes[size], className)}
                    >
                        <div className="p-5 border-b border-border flex items-center justify-between bg-surface/50">
                            <h2 className="text-lg font-bold text-[var(--text-primary)] font-display">{title}</h2>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-hover text-[var(--text-muted)] transition-all hover:rotate-90 cursor-pointer"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto">{children}</div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

// ============================================
// INPUT COMPONENT
// ============================================

export function Input({ label, error, icon: Icon, className, ...props }: any) {
    return (
        <div className="w-full space-y-2">
            {label && <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{label}</label>}
            <div className="relative group">
                {Icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-brand transition-colors"><Icon className="w-4 h-4" /></div>}
                <input
                    className={cn(
                        'w-full bg-surface border border-border px-4 py-3 rounded-xl outline-none transition-all text-sm placeholder:text-[var(--text-disabled)] text-[var(--text-primary)] font-medium',
                        'focus:border-brand focus:ring-4 focus:ring-brand-subtle',
                        Icon && 'pl-11',
                        error && 'border-error focus:border-error focus:ring-error/10',
                        className
                    )}
                    {...props}
                />
            </div>
            {error && <p className="text-xs font-bold text-error animate-pulse">{error}</p>}
        </div>
    )
}

export function SearchInput({ value, onChange, placeholder = 'Search...' }: any) {
    return (
        <div className="relative w-full">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><Search className="w-4 h-4" /></div>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-surface pl-11 pr-4 py-2.5 rounded-xl border border-border outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand-subtle text-sm font-medium shadow-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
            />
        </div>
    )
}

// ============================================
// HELPERS
// ============================================

export function LoadingSpinner({ size = 'md' }: any) {
    return <Loader2 className={cn('animate-spin text-brand', size === 'sm' && 'w-4 h-4', size === 'md' && 'w-8 h-8', size === 'lg' && 'w-12 h-12')} />
}

export function PageLoading() {
    return (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-6 bg-background">
            <div className="relative">
                <div className="absolute inset-0 bg-brand/20 blur-xl rounded-full"></div>
                <LoadingSpinner size="lg" />
            </div>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] animate-pulse">Loading System...</p>
        </div>
    )
}

export function EmptyState({ icon: Icon, title, description, action }: any) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            {Icon && (
                <div className="relative mb-6 group">
                    <div className="absolute inset-0 bg-brand/10 blur-xl rounded-full group-hover:bg-brand/20 transition-all"></div>
                    <div className="w-20 h-20 rounded-2xl bg-surface border border-border flex items-center justify-center relative">
                        <Icon className="w-10 h-10 text-brand group-hover:scale-110 transition-transform duration-300" />
                    </div>
                </div>
            )}
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 tracking-tight font-display">{title}</h3>
            <p className="text-[var(--text-secondary)] max-w-sm mb-8 text-sm font-medium leading-relaxed">{description}</p>
            {action && (
                <Button onClick={action.onClick} variant="primary" className="rounded-full px-8 shadow-lg shadow-brand/20">
                    {action.label}
                </Button>
            )}
        </div>
    )
}
