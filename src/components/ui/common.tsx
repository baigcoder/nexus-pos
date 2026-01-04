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
        <div className={cn('min-h-screen bg-neutral-950 text-foreground font-sans selection:bg-orange-500/20', className)}>
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
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 outline-none disabled:opacity-50 disabled:cursor-not-allowed rounded-full relative overflow-hidden group'

    const variants = {
        primary: 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-[0_10px_40px_-10px_rgba(249,115,22,0.4)] hover:shadow-xl hover:scale-[1.02] active:scale-95',
        secondary: 'bg-neutral-800 text-white hover:bg-black shadow-sm hover:translate-y-[-1px]',
        black: 'bg-neutral-900 text-white hover:bg-black dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white shadow-lg shadow-neutral-900/20',
        ghost: 'bg-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground',
        danger: 'bg-error text-white hover:bg-red-600 shadow-sm',
        outline: 'bg-transparent border border-border text-foreground hover:bg-surface-hover hover:border-orange-500/50',
        white: 'bg-white text-black hover:bg-neutral-100 shadow-xl shadow-white/10',
    }

    const sizes = {
        sm: 'px-4 py-2 text-xs',
        md: 'px-6 py-3 text-sm',
        lg: 'px-8 py-4 text-base',
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
                    {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-x-1" />}
                    <span className="relative z-10">{children}</span>
                    {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" />}
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
    const Component = onClick ? motion.button : motion.div

    const variants = {
        default: 'bg-surface border border-border/50 shadow-md shadow-neutral-500/5 dark:shadow-black/20',
        flat: 'bg-neutral-50 dark:bg-neutral-900/40',
        outline: 'bg-transparent border border-border',
        glass: 'glass',
    }

    return (
        <Component
            onClick={onClick}
            className={cn(
                'rounded-2xl p-6 relative overflow-hidden text-left',
                variants[variant],
                hover && 'hover:border-orange-500/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1',
                className
            )}
        >
            {children}
        </Component>
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
        default: 'bg-neutral-100 text-neutral-600 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700',
        success: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400',
        warning: 'bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400',
        error: 'bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:text-rose-400',
        primary: 'bg-primary/10 text-primary border border-primary/20',
        neutral: 'bg-neutral-50 text-neutral-600 border border-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:border-neutral-800',
        outline: 'border border-orange-500/20 bg-orange-500/5 text-orange-500',
    }

    return (
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide', variants[variant], className)}>
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
        <Card className={cn("flex flex-col gap-4", className)}>
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
                {Icon && <div className="p-2 rounded-lg bg-orange-500/5"><Icon className="w-5 h-5 text-orange-500" /></div>}
            </div>

            <div className="flex items-end justify-between">
                <div>
                    <h3 className="text-3xl font-bold text-foreground tracking-tight">{value}</h3>
                    {sublabel && <p className="text-xs text-muted-foreground mt-1 font-medium">{sublabel}</p>}
                </div>

                {change !== undefined && (
                    <div className={cn(
                        'flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full',
                        change >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                    )}>
                        {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
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
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className={cn("relative bg-background border border-border rounded-3xl shadow-2xl w-full max-h-[90vh] flex flex-col overflow-hidden", modalSizes[size], className)}
                    >
                        <div className="p-5 border-b border-border flex items-center justify-between bg-surface/50">
                            <h2 className="text-lg font-bold text-foreground">{title}</h2>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-hover text-muted-foreground transition-all hover:rotate-90"><X className="w-5 h-5" /></button>
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
            {label && <label className="block text-sm font-bold text-foreground/80">{label}</label>}
            <div className="relative group">
                {Icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"><Icon className="w-4 h-4" /></div>}
                <input
                    className={cn(
                        'w-full bg-surface border border-border px-4 py-3 rounded-xl outline-none transition-all text-sm placeholder:text-muted-foreground/40 font-medium',
                        'focus:border-primary focus:ring-4 focus:ring-primary/10',
                        Icon && 'pl-10',
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
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="w-4 h-4" /></div>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-surface pl-10 pr-4 py-2.5 rounded-xl border border-border outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/5 text-sm font-medium shadow-sm"
            />
        </div>
    )
}

// ============================================
// HELPERS
// ============================================

export function LoadingSpinner({ size = 'md' }: any) {
    return <Loader2 className={cn('animate-spin text-primary', size === 'sm' && 'w-4 h-4', size === 'md' && 'w-8 h-8', size === 'lg' && 'w-12 h-12')} />
}

export function PageLoading() {
    return (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-6">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                <LoadingSpinner size="lg" />
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] animate-pulse">Loading System...</p>
        </div>
    )
}

export function EmptyState({ icon: Icon, title, description, action }: any) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            {Icon && (
                <div className="relative mb-6 group">
                    <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full group-hover:bg-primary/20 transition-all"></div>
                    <div className="w-20 h-20 rounded-2xl bg-surface border border-border flex items-center justify-center relative">
                        <Icon className="w-10 h-10 text-primary/60 group-hover:scale-110 transition-transform duration-300" />
                    </div>
                </div>
            )}
            <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">{title}</h3>
            <p className="text-muted-foreground max-w-sm mb-8 text-sm font-medium leading-relaxed">{description}</p>
            {action && (
                <Button onClick={action.onClick} variant="primary" className="rounded-full px-8 shadow-lg shadow-primary/20">
                    {action.label}
                </Button>
            )}
        </div>
    )
}
