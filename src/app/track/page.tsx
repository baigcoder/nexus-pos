'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Clock,
    ChefHat,
    CheckCircle2,
    UtensilsCrossed,
    Loader2,
    Phone,
    Bell,
    ArrowLeft,
    Timer,
    Zap,
    MapPin,
    Smartphone,
    ShieldCheck,
    Truck,
    CheckCircle,
    Activity,
    Satellite,
    Cpu,
    Target,
    Radar,
    Lock,
    ChevronRight,
    Navigation,
    User,
    Star
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Card, Button, Badge, PremiumLayout } from '@/components/ui/common'
import { cn } from '@/lib/utils'

type OrderStatus = 'received' | 'preparing' | 'ready' | 'dispatched' | 'delivered'

const statusSteps: { status: OrderStatus; label: string; icon: any; desc: string; deliveryLabel?: string }[] = [
    { status: 'received', label: 'ORDER_RECEIVED', icon: ShieldCheck, desc: 'Order confirmed by restaurant', deliveryLabel: 'ORDER_CONFIRMED' },
    { status: 'preparing', label: 'PREPARING', icon: ChefHat, desc: 'Your food is being prepared', deliveryLabel: 'COOKING' },
    { status: 'ready', label: 'READY', icon: CheckCircle2, desc: 'Quality check complete', deliveryLabel: 'READY_FOR_PICKUP' },
    { status: 'dispatched', label: 'SERVED', icon: UtensilsCrossed, desc: 'Enjoy your meal!', deliveryLabel: 'OUT_FOR_DELIVERY' },
    { status: 'delivered', label: 'COMPLETED', icon: CheckCircle, desc: 'Thank you!', deliveryLabel: 'DELIVERED' },
]

const sampleOrder = {
    order_number: 7702,
    table_number: '05',
    status: 'dispatched' as OrderStatus,
    isDelivery: true,
    items: [
        { name: 'Saffron Samosa Royale', quantity: 2, price: 150 },
        { name: 'Velvet Butter Chicken', quantity: 1, price: 650 },
        { name: 'Artisan Mango Lassi', quantity: 2, price: 180 },
    ],
    subtotal: 1130,
    tax: 181,
    total: 1311,
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
    estimated_time: 15,
    rider: {
        name: 'Ahmed Khan',
        phone: '+92 300 1234567',
        rating: 4.8,
    },
    deliveryAddress: 'Block 5, Clifton, Karachi',
    restaurantName: 'Spice Garden',
}

function TrackLoading() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
            <div className="relative">
                <div className="w-20 h-20 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                <Satellite className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-primary animate-pulse" />
            </div>
            <p className="text-[0.6rem] font-tactical text-primary uppercase tracking-[0.4em] animate-pulse">LOADING_TRACKING...</p>
        </div>
    )
}

export default function TrackOrderPage() {
    return (
        <Suspense fallback={<TrackLoading />}>
            <TrackContent />
        </Suspense>
    )
}

function TrackContent() {
    const searchParams = useSearchParams()
    const orderNumber = searchParams.get('order') || sampleOrder.order_number.toString()

    const [order, setOrder] = useState(sampleOrder)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [riderProgress, setRiderProgress] = useState(25) // 0-100 progress from restaurant to customer

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    // Simulate rider movement
    useEffect(() => {
        if (order.isDelivery && order.status === 'dispatched') {
            const progressInterval = setInterval(() => {
                setRiderProgress(prev => {
                    if (prev >= 95) {
                        clearInterval(progressInterval)
                        return 95
                    }
                    return prev + Math.random() * 3 + 1
                })
            }, 2000)
            return () => clearInterval(progressInterval)
        }
    }, [order.isDelivery, order.status])

    const getElapsedMins = () => {
        return Math.floor((currentTime.getTime() - new Date(order.created_at).getTime()) / 60000)
    }

    const getRemainingTime = () => {
        const elapsed = getElapsedMins()
        const remaining = order.estimated_time - elapsed
        return remaining > 0 ? remaining : 0
    }

    const currentStepIndex = statusSteps.findIndex(s => s.status === order.status)
    const elapsedMins = getElapsedMins()
    const remainingMins = getRemainingTime()

    return (
        <PremiumLayout className="min-h-screen pb-32">
            {/* Operational Intelligence Header */}
            <div className="bg-slate-950 text-white p-8 lg:p-16 rounded-b-[4rem] border-b-2 border-primary/30 shadow-glow shadow-primary/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute inset-0 bg-industrial opacity-[0.05] pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-16">
                    <div className="flex items-center gap-6 group">
                        <div className={cn(
                            "w-16 h-16 rounded-2xl flex items-center justify-center shadow-glow group-hover:rotate-12 transition-all duration-500",
                            order.isDelivery ? "bg-purple-600 shadow-purple-600/30" : "bg-primary shadow-primary/30"
                        )}>
                            {order.isDelivery ? <Truck className="w-9 h-9 text-white" /> : <Activity className="w-9 h-9 text-white" />}
                        </div>
                        <div className="font-tactical">
                            <h1 className="text-3xl text-white italic uppercase tracking-tighter">
                                {order.isDelivery ? 'Delivery_Tracking' : 'Order_Tracking'}
                            </h1>
                            <p className="text-primary text-[0.6rem] font-black tracking-[0.4em] uppercase opacity-70">
                                {order.isDelivery ? 'LIVE_RIDER_LOCATION' : 'DINE_IN_STATUS'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 py-2 px-6 bg-surface border border-border rounded-2xl">
                        <Radar className="w-5 h-5 text-primary animate-spin-slow" />
                        <span className="text-[0.65rem] font-tactical text-muted tracking-widest uppercase">
                            {order.isDelivery ? `ETA: ${remainingMins} MINS` : 'SIGNAL_ACTIVE'}
                        </span>
                    </div>
                </div>

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-surface/40 border border-border rounded-3xl p-8 backdrop-blur-3xl group">
                        <p className="text-[0.6rem] font-tactical text-primary uppercase tracking-[0.4em] mb-3">Order_ID</p>
                        <p className="text-4xl font-black tracking-tighter text-foreground group-hover:text-glow transition-all">#{orderNumber}</p>
                    </div>
                    <div className="bg-surface/40 border border-border rounded-3xl p-8 backdrop-blur-3xl group">
                        <p className="text-[0.6rem] font-tactical text-primary uppercase tracking-[0.4em] mb-3">
                            {order.isDelivery ? 'Remaining_Time' : 'Elapsed_Time'}
                        </p>
                        <p className="text-4xl font-black tracking-tighter text-foreground group-hover:text-glow transition-all tabular-nums">
                            {order.isDelivery ? remainingMins : elapsedMins}m
                        </p>
                    </div>
                    <div className="bg-surface/40 border border-border rounded-3xl p-8 backdrop-blur-3xl flex items-center justify-between group md:col-span-2 lg:col-span-1">
                        <div>
                            <p className="text-[0.6rem] font-tactical text-primary uppercase tracking-[0.4em] mb-3">
                                {order.isDelivery ? 'Delivery_Address' : 'Table_Number'}
                            </p>
                            <p className="text-2xl font-black tracking-tighter text-foreground">
                                {order.isDelivery ? order.deliveryAddress : `T_${order.table_number}`}
                            </p>
                        </div>
                        {order.isDelivery ? <MapPin className="w-12 h-12 text-purple-500 opacity-40" /> : <Target className="w-12 h-12 text-primary opacity-20 group-hover:opacity-100 transition-opacity" />}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 -mt-10 relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* Status Timeline Interface */}
                <div className="lg:col-span-7 space-y-12">
                    {/* Rider Info Card (Delivery Only) */}
                    {order.isDelivery && order.status !== 'received' && order.status !== 'preparing' && (
                        <Card className="p-0 border-purple-500/20 bg-purple-500/5 overflow-hidden">
                            {/* Rider Header */}
                            <div className="p-6 flex items-center gap-6 border-b border-purple-500/10">
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-bold text-xl shadow-xl">
                                        {order.rider.name.charAt(0)}
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-emerald-500 border-3 border-slate-950 flex items-center justify-center">
                                        <Navigation className="w-3.5 h-3.5 text-white animate-pulse" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-white">{order.rider.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Star className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                                        <span className="text-sm font-bold text-white">{order.rider.rating}</span>
                                        <span className="text-xs text-muted">• Delivery Rider</span>
                                    </div>
                                </div>
                                <Button
                                    className="h-12 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-purple-600/20"
                                >
                                    <Phone className="w-4 h-4 mr-2" />
                                    Call
                                </Button>
                            </div>

                            {/* Live Tracking Map */}
                            <div className="p-6 bg-gradient-to-br from-slate-950 to-black relative">
                                <div className="absolute inset-0 opacity-10" style={{
                                    backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23a855f7\' fill-opacity=\'0.3\'%3E%3Cpath d=\'M0 0h20v20H0V0zm20 20h20v20H20V20z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                                }} />

                                {/* Route Visualization */}
                                <div className="relative z-10">
                                    {/* Progress Bar Track */}
                                    <div className="h-3 bg-neutral-800 rounded-full overflow-hidden relative mb-4">
                                        <motion.div
                                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-emerald-500 rounded-full"
                                            initial={{ width: '25%' }}
                                            animate={{ width: `${riderProgress}%` }}
                                            transition={{ duration: 0.5, ease: 'easeOut' }}
                                        />
                                        {/* Rider Icon on Progress */}
                                        <motion.div
                                            className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center"
                                            initial={{ left: '25%' }}
                                            animate={{ left: `${riderProgress}%` }}
                                            transition={{ duration: 0.5, ease: 'easeOut' }}
                                            style={{ marginLeft: '-12px' }}
                                        >
                                            <Truck className="w-3.5 h-3.5 text-purple-600" />
                                        </motion.div>
                                    </div>

                                    {/* Location Labels */}
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                                <ChefHat className="w-4 h-4 text-purple-500" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">Restaurant</p>
                                                <p className="text-xs font-bold text-white">{order.restaurantName}</p>
                                            </div>
                                        </div>

                                        <div className="text-center">
                                            <p className="text-xs text-muted font-bold uppercase tracking-widest mb-1">ETA</p>
                                            <p className="text-xl font-black text-emerald-500">{remainingMins}m</p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div>
                                                <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest text-right">Your Location</p>
                                                <p className="text-xs font-bold text-white text-right">Clifton</p>
                                            </div>
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                                <MapPin className="w-4 h-4 text-emerald-500" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Distance Info */}
                                    <div className="mt-4 pt-4 border-t border-neutral-800 flex items-center justify-center gap-6">
                                        <div className="flex items-center gap-2 text-muted text-xs">
                                            <Navigation className="w-3.5 h-3.5 text-purple-500 animate-pulse" />
                                            <span>{Math.round(100 - riderProgress) * 0.05}km away</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted text-xs">
                                            <Radar className="w-3.5 h-3.5 text-emerald-500 animate-spin-slow" />
                                            <span>Live Tracking</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    <Card className="p-12 border-border bg-surface/10">
                        <div className="space-y-16">
                            {statusSteps.slice(0, order.isDelivery ? 5 : 4).map((step, i) => {
                                const isCompleted = i <= currentStepIndex
                                const isCurrent = i === currentStepIndex
                                const isLast = i === (order.isDelivery ? 4 : 3)

                                return (
                                    <div key={step.status} className="relative flex gap-10 group">
                                        {/* Hardware Connectivity Line */}
                                        {!isLast && (
                                            <div className="absolute left-8 top-16 w-1 h-20 bg-border overflow-hidden rounded-full">
                                                {isCompleted && (
                                                    <motion.div
                                                        initial={{ height: 0 }}
                                                        animate={{ height: '100%' }}
                                                        transition={{ duration: 1 }}
                                                        className={cn(
                                                            "w-full shadow-glow",
                                                            order.isDelivery ? "bg-purple-500 shadow-purple-500/40" : "bg-primary shadow-primary/40"
                                                        )}
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {/* Status Component Orbit */}
                                        <div className="relative shrink-0">
                                            <motion.div
                                                initial={false}
                                                animate={isCurrent ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                                                transition={{ repeat: Infinity, duration: 4 }}
                                                className={cn(
                                                    "w-18 h-18 rounded-[1.5rem] flex items-center justify-center transition-all duration-700 border-2 relative z-10",
                                                    isCompleted
                                                        ? order.isDelivery
                                                            ? "bg-purple-600 border-purple-600 text-white shadow-glow shadow-purple-600/30"
                                                            : "bg-primary border-primary text-white shadow-glow shadow-primary/30"
                                                        : "bg-surface border-border text-muted opacity-40"
                                                )}
                                            >
                                                <step.icon className={cn("w-8 h-8", isCurrent && "animate-pulse")} />
                                            </motion.div>

                                            {isCurrent && (
                                                <div className={cn(
                                                    "absolute inset-x-[-10px] inset-y-[-10px] rounded-[2rem] animate-ping opacity-30",
                                                    order.isDelivery ? "bg-purple-500/20" : "bg-primary/20"
                                                )} />
                                            )}
                                        </div>

                                        <div className="flex flex-col justify-center space-y-2">
                                            <h3 className={cn(
                                                "text-2xl font-black uppercase tracking-tighter italic transition-colors duration-700",
                                                isCompleted ? "text-foreground" : "text-muted opacity-40"
                                            )}>
                                                {order.isDelivery && step.deliveryLabel ? step.deliveryLabel : step.label}
                                            </h3>
                                            <p className={cn(
                                                "text-[0.7rem] font-bold uppercase tracking-widest italic leading-relaxed",
                                                isCompleted ? "text-muted" : "text-muted/20"
                                            )}>
                                                {step.desc}
                                            </p>
                                        </div>

                                        {isCurrent && (
                                            <div className="ml-auto self-center">
                                                <Badge variant="primary" className={cn(
                                                    "animate-pulse px-4 py-2",
                                                    order.isDelivery && "bg-purple-500/20 text-purple-400 border-purple-500/40"
                                                )}>
                                                    LIVE
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </Card>

                    {!order.isDelivery && (
                        <Button variant="primary" className="w-full h-24 text-2xl font-bold rounded-[3rem] shadow-xl group" icon={Bell}>
                            CALL_WAITER
                            <ChevronRight className="w-8 h-8 ml-4 group-hover:translate-x-2 transition-transform" />
                        </Button>
                    )}
                </div>

                {/* Manifest Summary Panel */}
                <div className="lg:col-span-5 space-y-12">
                    <Card className="p-10 border-border bg-slate-950 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-industrial opacity-[0.05] pointer-events-none" />

                        <div className="flex items-center justify-between mb-10 pb-8 border-b border-border relative z-10">
                            <div className="space-y-1">
                                <h3 className="font-black uppercase tracking-tighter text-2xl italic text-white/90">Order_Summary</h3>
                                <p className="text-primary text-[0.6rem] font-tactical tracking-widest uppercase opacity-60">#{orderNumber}</p>
                            </div>
                            <Badge variant="primary" className={cn(
                                "px-4 py-2",
                                order.isDelivery ? "bg-purple-500/20 text-purple-400 border-purple-500/40" : "bg-primary/20 text-primary border-primary/40"
                            )}>
                                <Activity className="w-3.5 h-3.5 mr-2 animate-pulse" />
                                {order.isDelivery ? 'DELIVERY' : 'DINE-IN'}
                            </Badge>
                        </div>

                        <div className="space-y-6 relative z-10">
                            {order.items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between group/item">
                                    <div className="flex items-center gap-6">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm border group-hover/item:border-purple-500/50 transition-colors",
                                            order.isDelivery ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-surface/50 text-primary border-border"
                                        )}>
                                            {item.quantity}x
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-lg font-black uppercase tracking-tighter text-white/90 group-hover/item:text-primary transition-colors">{item.name}</span>
                                        </div>
                                    </div>
                                    <span className="text-lg font-black tracking-tighter text-white/40 tabular-nums">Rs.{item.price * item.quantity}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 pt-10 border-t border-border relative z-10 space-y-6">
                            <div className="flex justify-between items-end">
                                <div className="space-y-2">
                                    <p className="text-[0.6rem] font-tactical text-primary uppercase tracking-[0.4em] opacity-60">Total_Amount</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-5xl font-black tracking-tighter text-white text-glow shadow-primary/20 leading-none tabular-nums">
                                        <span className="text-2xl align-top mr-1">Rs.</span>{order.total}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Security Notice */}
                    <div className="bg-surface/20 border border-border rounded-[2.5rem] p-10 flex items-start gap-8">
                        <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border",
                            order.isDelivery ? "bg-purple-500/10 border-purple-500/20" : "bg-primary/10 border-primary/20"
                        )}>
                            <ShieldCheck className={cn("w-8 h-8", order.isDelivery ? "text-purple-500" : "text-primary")} />
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-sm font-black text-foreground uppercase tracking-widest">Secure Tracking</h4>
                            <p className="text-[0.7rem] font-bold text-muted leading-relaxed uppercase tracking-tight opacity-60 italic">
                                {order.isDelivery
                                    ? "Your rider's location is shared securely. Cash on delivery available."
                                    : "Your order status is updated in real-time from the kitchen."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </PremiumLayout>
    )
}
