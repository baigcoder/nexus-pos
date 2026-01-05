'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Clock,
    ChefHat,
    AlertTriangle,
    Volume2,
    VolumeX,
    CheckCircle2,
    Bell,
    UtensilsCrossed,
    Loader2,
    RefreshCw,
    Truck,
    MapPin,
    Phone,
    Flame,
    Timer,
    Info,
    LayoutGrid,
    Maximize,
    Minimize
} from 'lucide-react'
import { useAuthStore } from '@/stores'
import { useKitchenOrders } from '@/hooks/useRealtimeOrders'
import { updateOrderStatus } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import type { Order, OrderStatus } from '@/types'
import { Badge, Button, Card } from '@/components/ui/common'
import { cn } from '@/lib/utils'

const statusConfig = {
    pending: { label: 'NEW', color: 'text-rose-500', glow: 'shadow-rose-500/20', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
    preparing: { label: 'COOKING', color: 'text-amber-500', glow: 'shadow-amber-500/20', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    ready: { label: 'READY', color: 'text-emerald-500', glow: 'shadow-emerald-500/20', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
}

export default function KitchenPage() {
    const { restaurant } = useAuthStore()
    const { orders, isLoading, refresh } = useKitchenOrders()
    const { success, error: showError } = useToast()
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
    const [currentTime, setCurrentTime] = useState(new Date())
    const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set())
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Fullscreen toggle for LED/external display
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { })
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { })
        }
    }

    // Listen for fullscreen changes (e.g., user presses Escape)
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        setUpdatingOrders(prev => new Set(prev).add(orderId))
        const result = await updateOrderStatus(orderId, newStatus)
        if (result.success) {
            success('Status Updated', `Order changed to ${newStatus}`)
            refresh()
        } else showError('Error', result.error || 'Failed to update order')
        setUpdatingOrders(prev => {
            const next = new Set(prev)
            next.delete(orderId)
            return next
        })
    }

    const handleDispatchToRider = async (orderId: string) => {
        setUpdatingOrders(prev => new Set(prev).add(orderId))
        const result = await updateOrderStatus(orderId, 'served')
        if (result.success) {
            success('Dispatched', 'Order handed over to rider')
            refresh()
        } else showError('Error', result.error || 'Dispatch failed')
        setUpdatingOrders(prev => {
            const next = new Set(prev)
            next.delete(orderId)
            return next
        })
    }

    const getElapsedTime = (createdAt: string) => {
        const diff = Math.floor((currentTime.getTime() - new Date(createdAt).getTime()) / 1000)
        const mins = Math.floor(diff / 60)
        const secs = diff % 60
        return { mins, secs, total: diff }
    }

    // Process orders for display
    const processedOrders = useMemo(() => {
        const filtered = filter === 'all'
            ? orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status))
            : orders.filter(o => o.status === filter)

        return filtered.sort((a, b) => {
            if (a.is_priority !== b.is_priority) return b.is_priority ? 1 : -1
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })
    }, [orders, filter])

    const stats = useMemo(() => ({
        pending: orders.filter(o => o.status === 'pending').length,
        preparing: orders.filter(o => o.status === 'preparing').length,
        ready: orders.filter(o => o.status === 'ready').length,
    }), [orders])

    // Render Loading State
    if (isLoading) {
        return (
            <div className="h-screen bg-[#050505] flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-600/10 via-transparent to-transparent opacity-50" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 text-center"
                >
                    <div className="relative w-24 h-24 mx-auto mb-8">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                            className="absolute inset-0 rounded-full border-b-2 border-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.4)]"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <ChefHat className="w-10 h-10 text-orange-500" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-widest uppercase mb-2">Syncing Kitchen</h2>
                    <p className="text-neutral-500 font-medium">Fetching active orders from nexus portal...</p>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="h-screen bg-[#050505] text-neutral-200 flex flex-col font-sans overflow-hidden selection:bg-orange-500/30">
            {/* Ambient Background Elements */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden h-full w-full">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-600/10 rounded-full blur-[120px]" />
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-600/5 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-50 mix-blend-overlay" />
            </div>

            {/* Premium Header Container */}
            <header className="relative h-24 px-8 flex items-center justify-between z-20 shrink-0">
                <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xl border-b border-white/5" />

                <div className="relative flex items-center gap-10">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-0.5">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(234,88,12,0.8)]"
                            />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500/80">Nexus KDS Live</span>
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tighter text-white">
                            KITCHEN <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-600">STATION</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-1.5 p-1.5 bg-neutral-800/40 border border-white/5 rounded-2xl backdrop-blur-md">
                        <StatsTab label="New" count={stats.pending} color="rose" active={filter === 'pending' || filter === 'all'} onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')} />
                        <StatsTab label="Prep" count={stats.preparing} color="amber" active={filter === 'preparing' || filter === 'all'} onClick={() => setFilter(filter === 'preparing' ? 'all' : 'preparing')} />
                        <StatsTab label="Ready" count={stats.ready} color="emerald" active={filter === 'ready' || filter === 'all'} onClick={() => setFilter(filter === 'ready' ? 'all' : 'ready')} />
                    </div>
                </div>

                <div className="relative flex items-center gap-6">
                    {/* Digital Clock */}
                    <div className="flex flex-col items-end px-6 py-2 border-r border-white/5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-0.5">Clock In Time</span>
                        <div className="flex items-baseline gap-1 text-2xl font-black tabular-nums tracking-tighter text-white">
                            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <HeaderAction onClick={toggleFullscreen} icon={isFullscreen ? Minimize : Maximize} tooltip={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'} />
                        <HeaderAction onClick={() => refresh()} icon={RefreshCw} tooltip="Refresh" />
                        <HeaderAction
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            icon={soundEnabled ? Volume2 : VolumeX}
                            active={soundEnabled}
                            tooltip={soundEnabled ? 'Mute' : 'Unmute'}
                        />
                    </div>
                </div>
            </header>

            {/* Orders Feed Scroll Container */}
            <main className="relative flex-1 p-8 overflow-x-auto flex gap-8 pb-12 snap-x snap-mandatory scroll-smooth custom-scrollbar-hidden z-10">
                <AnimatePresence mode="popLayout" initial={false}>
                    {processedOrders.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex-1 flex flex-col items-center justify-center text-center py-20"
                        >
                            <div className="w-32 h-32 rounded-[3.5rem] bg-neutral-900 border border-white/5 flex items-center justify-center mb-10 relative group">
                                <div className="absolute inset-0 rounded-[3.5rem] bg-orange-600/10 blur-2xl group-hover:bg-orange-600/20 transition-all duration-700" />
                                <UtensilsCrossed className="w-12 h-12 text-neutral-700 relative z-10" />
                            </div>
                            <h2 className="text-3xl font-black text-white tracking-tighter mb-4 uppercase">Station Clear</h2>
                            <p className="text-neutral-500 max-w-sm text-sm font-medium leading-relaxed">
                                No active tickets found. Any new orders from the dining hall or delivery apps will appear here instantly.
                            </p>
                        </motion.div>
                    ) : (
                        processedOrders.map((order) => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                elapsed={getElapsedTime(order.created_at)}
                                onAction={handleStatusChange}
                                onDispatch={handleDispatchToRider}
                                isUpdating={updatingOrders.has(order.id)}
                            />
                        ))
                    )}
                </AnimatePresence>
            </main>
        </div>
    )
}

function OrderCard({ order, elapsed, onAction, onDispatch, isUpdating }: {
    order: Order,
    elapsed: { mins: number, secs: number },
    onAction: (id: string, s: OrderStatus) => void,
    onDispatch: (id: string) => void,
    isUpdating: boolean
}) {
    const isCritical = elapsed.mins >= 12
    const isWarning = elapsed.mins >= 8 && elapsed.mins < 12
    const cfg = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
            className="w-[420px] shrink-0 h-full flex flex-col snap-start"
        >
            <div className={cn(
                "flex-1 flex flex-col rounded-[3rem] border-2 bg-neutral-900/50 backdrop-blur-2xl transition-all duration-500 overflow-hidden relative",
                order.is_priority ? "border-rose-500/50 shadow-[0_20px_50px_rgba(244,63,94,0.1)]" : "border-white/5 shadow-2xl",
                isCritical && "border-rose-600 shadow-[0_0_80px_rgba(225,19,72,0.2)] animate-pulse"
            )}>
                {/* Status Bar */}
                <div className={cn("h-3 px-6", cfg.bg)} />

                {/* Card Header Section */}
                <div className="p-8 pb-4 flex items-start justify-between">
                    <div className="flex items-start gap-5">
                        <div className="w-20 h-20 rounded-[2.5rem] bg-black border border-white/10 flex flex-col items-center justify-center shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)]">
                            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-0.5">Order</span>
                            <span className="text-3xl font-black text-white italic">#{order.order_number}</span>
                        </div>
                        <div className="pt-2">
                            <Badge className={cn("px-4 py-1.5 rounded-full font-black text-[10px] tracking-[0.2em] border-none mb-3", cfg.bg, cfg.color)}>
                                {cfg.label}
                            </Badge>
                            <p className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                                {order.table_id ? (
                                    <>
                                        <LayoutGrid className="w-3 h-3 text-white/20" />
                                        <span>Table {order.table?.table_number || '#'}</span>
                                    </>
                                ) : (
                                    <>
                                        <Truck className="w-3 h-3 text-purple-500" />
                                        <span className="text-purple-400">Delivery</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end pt-2">
                        <div className={cn(
                            "flex items-center gap-1.5 text-3xl font-black tabular-nums tracking-tighter",
                            isCritical ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-neutral-200'
                        )}>
                            <Timer className="w-5 h-5 opacity-40" />
                            {elapsed.mins.toString().padStart(2, '0')}:
                            <span className="text-xl opacity-60 font-bold">{elapsed.secs.toString().padStart(2, '0')}</span>
                        </div>
                        <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mt-1">Elapsed Time</span>
                    </div>
                </div>

                {/* Body Content - Scrollable */}
                <div className="flex-1 px-8 py-4 space-y-5 overflow-y-auto custom-scrollbar-white">
                    {/* Order Information Alert for Priority/Delivery */}
                    {order.is_priority && (
                        <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex gap-4">
                            <Flame className="w-5 h-5 text-rose-500 shrink-0" />
                            <div className="flex-1">
                                <p className="text-[11px] font-black text-rose-500 uppercase tracking-widest mb-1">Priority Ticket</p>
                                <p className="text-xs text-rose-200/80 font-medium">Rush order - ensure minimum prep time.</p>
                            </div>
                        </div>
                    )}

                    {/* Menu Items List */}
                    <div className="space-y-3">
                        {order.items?.map((item, i) => (
                            <div key={i} className="group/item flex items-center justify-between p-5 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-xl font-black text-orange-500 shadow-xl border border-white/5">
                                        {item.quantity}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white uppercase tracking-tight">{item.menu_item?.name}</p>
                                        {(item.special_instructions || item.customizations?.length > 0) && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {item.special_instructions && (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-400/90 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/5">
                                                        <Info className="w-3 h-3" /> {item.special_instructions}
                                                    </span>
                                                )}
                                                {item.customizations?.map((c: any, ci: number) => (
                                                    <span key={ci} className="text-[9px] font-bold text-neutral-500 uppercase px-2 py-0.5 bg-neutral-800 rounded-lg">
                                                        +{c.selected_options?.[0]?.option_name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Order Notes Card */}
                    {order.notes && (
                        <div className="p-6 rounded-[2rem] bg-gradient-to-br from-neutral-800 to-neutral-900 border border-white/10 shadow-lg mt-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-orange-500/10 rounded-xl">
                                    <Bell className="w-4 h-4 text-orange-500" />
                                </div>
                                <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Chef Instructions</span>
                            </div>
                            <p className="text-xs font-semibold text-neutral-300 italic leading-relaxed">
                                "{order.notes}"
                            </p>
                        </div>
                    )}
                </div>

                {/* Premium Action Footer */}
                <div className="p-8 bg-neutral-900/50 backdrop-blur-md border-t border-white/5 relative">
                    <AnimatePresence mode="wait">
                        {order.status === 'pending' && (
                            <ActionButton
                                key="start"
                                label="Cook Now"
                                variant="gradient"
                                icon={ChefHat}
                                onClick={() => onAction(order.id, 'preparing')}
                                loading={isUpdating}
                            />
                        )}
                        {order.status === 'preparing' && (
                            <ActionButton
                                key="ready"
                                label="Order Ready"
                                variant="emerald"
                                icon={CheckCircle2}
                                onClick={() => onAction(order.id, 'ready')}
                                loading={isUpdating}
                            />
                        )}
                        {order.status === 'ready' && (
                            <ActionButton
                                key="complete"
                                label={order.table_id ? "Call Waiter" : "Hand Off"}
                                variant="sky"
                                icon={order.table_id ? Bell : Truck}
                                onClick={() => order.table_id ? onAction(order.id, 'served') : onDispatch(order.id)}
                                loading={isUpdating}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    )
}

// UI HELPER COMPONENTS
function StatsTab({ label, count, color, active, onClick }: { label: string, count: number, color: string, active: boolean, onClick: () => void }) {
    const colors = {
        rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20 shadow-rose-500/10',
        amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-amber-500/10',
        emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10'
    }
    const colorClass = colors[color as keyof typeof colors]

    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-4 px-6 py-2.5 rounded-xl transition-all duration-500",
                active ? "bg-neutral-800 border border-white/10 shadow-lg" : "opacity-40 hover:opacity-100 grayscale"
            )}
        >
            <div className="flex flex-col items-start">
                <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500 leading-none mb-1">{label}</span>
                <span className={cn("text-xl font-black tabular-nums tracking-tighter leading-none", active ? (color === "rose" ? "text-rose-500" : color === "amber" ? "text-amber-500" : "text-emerald-500") : "text-white")}>
                    {count.toString().padStart(2, '0')}
                </span>
            </div>
            <div className={cn("w-1.5 h-1.5 rounded-full", color === "rose" ? "bg-rose-500" : color === "amber" ? "bg-amber-500" : "bg-emerald-500")} />
        </button>
    )
}

function HeaderAction({ onClick, icon: Icon, active = false, tooltip }: { onClick: () => void, icon: any, active?: boolean, tooltip?: string }) {
    return (
        <button
            onClick={onClick}
            title={tooltip}
            className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 border",
                active
                    ? "bg-orange-600 border-none text-white shadow-lg shadow-orange-600/30 active:scale-95"
                    : "bg-neutral-800/50 border-white/5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
            )}
        >
            <Icon className="w-5 h-5" />
        </button>
    )
}

function ActionButton({ label, variant, icon: Icon, onClick, loading }: { label: string, variant: string, icon: any, onClick: () => void, loading: boolean }) {
    const variants: Record<string, string> = {
        gradient: "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-[0_10px_30px_rgba(249,115,22,0.3)] hover:shadow-[0_15px_40px_rgba(249,115,22,0.5)]",
        emerald: "bg-emerald-600 text-white shadow-[0_10px_30px_rgba(5,150,105,0.2)] hover:shadow-[0_15px_40px_rgba(5,150,105,0.4)]",
        sky: "bg-sky-600 text-white shadow-[0_10px_30px_rgba(2,132,199,0.2)] hover:shadow-[0_15px_40px_rgba(2,132,199,0.4)]"
    }

    return (
        <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={onClick}
            disabled={loading}
            className={cn(
                "w-full h-16 rounded-[2rem] flex items-center justify-center gap-4 font-black uppercase text-xs tracking-[0.25em] transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed",
                variants[variant]
            )}
        >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                <>
                    <Icon className="w-5 h-5" />
                    {label}
                </>
            )}
        </motion.button>
    )
}
