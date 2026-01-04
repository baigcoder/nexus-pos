'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Activity,
    Truck,
    MapPin,
    Clock,
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    User,
    Package,
    Navigation,
    Phone,
    Zap,
    Timer,
    Star,
    RefreshCw,
    Filter,
    MoreVertical,
    Eye,
    ChefHat,
    XCircle
} from 'lucide-react'
import { Card, Button, Badge, Modal, LoadingSpinner } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'

// Types
type DeliveryStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'dispatched' | 'delivered'
type RiderStatus = 'online' | 'offline' | 'busy'

interface ActiveDelivery {
    id: string
    orderNumber: number
    customerName: string
    customerPhone: string
    address: string
    status: DeliveryStatus
    rider: {
        name: string
        phone: string
        status: RiderStatus
    } | null
    items: number
    total: number
    createdAt: string
    eta: number
}

interface Rider {
    id: string
    name: string
    phone: string
    status: RiderStatus
    activeDeliveries: number
    location?: { lat: number; lng: number }
}

const statusConfig: Record<DeliveryStatus, { label: string; color: string; bg: string }> = {
    new: { label: 'New', color: 'text-rose-500', bg: 'bg-rose-500/10' },
    confirmed: { label: 'Confirmed', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    preparing: { label: 'Preparing', color: 'text-orange-500', bg: 'bg-orange-500/10' },
    ready: { label: 'Ready', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    dispatched: { label: 'Out for Delivery', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    delivered: { label: 'Delivered', color: 'text-neutral-500', bg: 'bg-neutral-800' },
}

// Mock data
const mockDeliveries: ActiveDelivery[] = [
    {
        id: '1',
        orderNumber: 7801,
        customerName: 'Ali Hassan',
        customerPhone: '+92 300 1234567',
        address: 'Block 5, Clifton, Karachi',
        status: 'dispatched',
        rider: { name: 'Ahmed Khan', phone: '+92 321 9876543', status: 'busy' },
        items: 3,
        total: 1250,
        createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
        eta: 8,
    },
    {
        id: '2',
        orderNumber: 7802,
        customerName: 'Sara Ahmed',
        customerPhone: '+92 333 5555555',
        address: 'DHA Phase 6, Lahore',
        status: 'ready',
        rider: null,
        items: 2,
        total: 850,
        createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
        eta: 0,
    },
    {
        id: '3',
        orderNumber: 7803,
        customerName: 'Usman Malik',
        customerPhone: '+92 345 6666666',
        address: 'F-7 Markaz, Islamabad',
        status: 'preparing',
        rider: null,
        items: 5,
        total: 2100,
        createdAt: new Date(Date.now() - 8 * 60000).toISOString(),
        eta: 0,
    },
    {
        id: '4',
        orderNumber: 7804,
        customerName: 'Fatima Noor',
        customerPhone: '+92 306 7777777',
        address: 'Gulberg 3, Lahore',
        status: 'dispatched',
        rider: { name: 'Bilal Ahmad', phone: '+92 312 1111111', status: 'busy' },
        items: 4,
        total: 1800,
        createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
        eta: 5,
    },
]

const mockRiders: Rider[] = [
    { id: '1', name: 'Ahmed Khan', phone: '+92 321 9876543', status: 'busy', activeDeliveries: 1 },
    { id: '2', name: 'Bilal Ahmad', phone: '+92 312 1111111', status: 'busy', activeDeliveries: 1 },
    { id: '3', name: 'Faraz Ali', phone: '+92 333 2222222', status: 'online', activeDeliveries: 0 },
    { id: '4', name: 'Hassan Raza', phone: '+92 344 3333333', status: 'offline', activeDeliveries: 0 },
]

export default function DeliveryMonitorPage() {
    const { restaurant } = useAuthStore()
    const { success, error: showError } = useToast()
    const [isLoading, setIsLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [deliveries, setDeliveries] = useState<ActiveDelivery[]>(mockDeliveries)
    const [riders, setRiders] = useState<Rider[]>(mockRiders)
    const [selectedDelivery, setSelectedDelivery] = useState<ActiveDelivery | null>(null)

    useEffect(() => {
        setTimeout(() => setIsLoading(false), 500)
        const interval = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    // Stats
    const stats = useMemo(() => ({
        totalActive: deliveries.filter(d => d.status !== 'delivered').length,
        inKitchen: deliveries.filter(d => ['new', 'confirmed', 'preparing'].includes(d.status)).length,
        readyForPickup: deliveries.filter(d => d.status === 'ready').length,
        outForDelivery: deliveries.filter(d => d.status === 'dispatched').length,
        avgDeliveryTime: 28,
        ridersOnline: riders.filter(r => r.status === 'online').length,
        ridersBusy: riders.filter(r => r.status === 'busy').length,
    }), [deliveries, riders])

    const getElapsedTime = (createdAt: string) => {
        return Math.floor((currentTime.getTime() - new Date(createdAt).getTime()) / 60000)
    }

    const assignRider = (deliveryId: string, riderId: string) => {
        const rider = riders.find(r => r.id === riderId)
        if (!rider) return

        setDeliveries(prev => prev.map(d =>
            d.id === deliveryId
                ? { ...d, rider: { name: rider.name, phone: rider.phone, status: 'busy' as RiderStatus }, status: 'dispatched' as DeliveryStatus, eta: 25 }
                : d
        ))

        setRiders(prev => prev.map(r =>
            r.id === riderId
                ? { ...r, status: 'busy' as RiderStatus, activeDeliveries: r.activeDeliveries + 1 }
                : r
        ))

        success('Rider Assigned', `${rider.name} is now delivering order #${deliveries.find(d => d.id === deliveryId)?.orderNumber}`)
        setSelectedDelivery(null)
    }

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.05 } }
    }

    const itemVariant = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
    }

    return (
        <div className="min-h-screen pb-20">
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">

                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div className="space-y-3">
                        <motion.div variants={itemVariant} className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl flex items-center justify-center shadow-xl shadow-purple-600/30">
                                <Activity className="w-5 h-5 text-white" />
                            </div>
                            <Badge variant="outline" className="border-purple-600/20 text-purple-500 bg-purple-600/5 px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                                REAL-TIME
                            </Badge>
                        </motion.div>
                        <motion.h1 variants={itemVariant} className="text-4xl lg:text-6xl font-display font-bold text-white tracking-tight uppercase">
                            Delivery <span className="text-purple-500">Monitor</span>
                        </motion.h1>
                        <motion.p variants={itemVariant} className="text-neutral-500 text-lg font-medium">
                            Live overview of all active deliveries and rider status
                        </motion.p>
                    </div>

                    <motion.div variants={itemVariant} className="flex items-center gap-4">
                        <div className="bg-black px-6 py-3 rounded-2xl border border-neutral-800 flex items-center gap-3">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-sm font-bold text-white tabular-nums">
                                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            className="h-12 px-6 rounded-xl border-neutral-800 text-neutral-400 font-bold uppercase tracking-widest text-[10px] hover:text-white"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                    </motion.div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    {[
                        { label: 'Active Orders', value: stats.totalActive, icon: Package, color: 'text-white', accent: 'bg-white/5' },
                        { label: 'In Kitchen', value: stats.inKitchen, icon: ChefHat, color: 'text-orange-500', accent: 'bg-orange-500/10' },
                        { label: 'Ready', value: stats.readyForPickup, icon: CheckCircle2, color: 'text-emerald-500', accent: 'bg-emerald-500/10' },
                        { label: 'Out for Delivery', value: stats.outForDelivery, icon: Truck, color: 'text-purple-500', accent: 'bg-purple-500/10' },
                        { label: 'Avg Time', value: `${stats.avgDeliveryTime}m`, icon: Timer, color: 'text-blue-500', accent: 'bg-blue-500/10' },
                        { label: 'Available Riders', value: stats.ridersOnline, icon: User, color: 'text-emerald-500', accent: 'bg-emerald-500/10' },
                        { label: 'Busy Riders', value: stats.ridersBusy, icon: Navigation, color: 'text-purple-500', accent: 'bg-purple-500/10' },
                    ].map((stat, idx) => (
                        <motion.div key={idx} variants={itemVariant}>
                            <Card className={cn("p-4 bg-neutral-950 border-neutral-900 hover:border-neutral-800 transition-all rounded-2xl", stat.accent)}>
                                <div className="flex items-center gap-3">
                                    <stat.icon className={cn("w-5 h-5", stat.color)} />
                                    <div>
                                        <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest">{stat.label}</p>
                                        <h3 className="text-xl font-black text-white">{stat.value}</h3>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Active Deliveries */}
                    <div className="xl:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white uppercase tracking-widest">Active Deliveries</h2>
                            <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 px-3 py-1">
                                {stats.totalActive} orders
                            </Badge>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-20"><LoadingSpinner /></div>
                        ) : (
                            <div className="space-y-3">
                                {deliveries.filter(d => d.status !== 'delivered').map((delivery) => {
                                    const statusCfg = statusConfig[delivery.status]
                                    const elapsed = getElapsedTime(delivery.createdAt)
                                    const isLate = elapsed > 30

                                    return (
                                        <motion.div key={delivery.id} variants={itemVariant} layout>
                                            <Card className={cn(
                                                "p-5 bg-neutral-950 border-neutral-900 hover:border-neutral-800 transition-all rounded-2xl cursor-pointer group",
                                                isLate && "border-l-4 border-l-rose-500"
                                            )} onClick={() => setSelectedDelivery(delivery)}>
                                                <div className="flex items-center gap-6">
                                                    {/* Order Number */}
                                                    <div className="w-16 h-16 shrink-0 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center group-hover:border-purple-500/30 transition-colors">
                                                        <span className="text-xl font-black text-white">#{delivery.orderNumber}</span>
                                                    </div>

                                                    {/* Customer Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h3 className="font-bold text-white truncate">{delivery.customerName}</h3>
                                                            <Badge className={cn("px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-none", statusCfg.bg, statusCfg.color)}>
                                                                {statusCfg.label}
                                                            </Badge>
                                                            {isLate && (
                                                                <Badge className="bg-rose-500/10 text-rose-500 border-none px-2 py-0.5 text-[9px] font-black">
                                                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                                                    LATE
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs text-neutral-500">
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="w-3 h-3" />
                                                                {delivery.address}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Package className="w-3 h-3" />
                                                                {delivery.items} items
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Rider / Time Info */}
                                                    <div className="text-right shrink-0">
                                                        {delivery.rider ? (
                                                            <div>
                                                                <p className="text-sm font-bold text-purple-400">{delivery.rider.name}</p>
                                                                <p className="text-xs text-neutral-500">ETA: {delivery.eta} min</p>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <p className="text-sm font-bold text-orange-500">No Rider</p>
                                                                <p className="text-xs text-neutral-500">{elapsed}m ago</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Amount */}
                                                    <div className="shrink-0 text-right">
                                                        <p className="text-lg font-black text-white tabular-nums">Rs.{delivery.total}</p>
                                                    </div>

                                                    <Eye className="w-5 h-5 text-neutral-700 group-hover:text-purple-500 transition-colors shrink-0" />
                                                </div>
                                            </Card>
                                        </motion.div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Rider Status Panel */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white uppercase tracking-widest">Rider Fleet</h2>
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">
                                {stats.ridersOnline} available
                            </Badge>
                        </div>

                        <Card className="p-0 bg-neutral-950 border-neutral-900 rounded-2xl overflow-hidden divide-y divide-neutral-900">
                            {riders.map((rider) => (
                                <div key={rider.id} className="p-4 flex items-center gap-4 hover:bg-neutral-900/50 transition-colors">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-bold text-lg">
                                            {rider.name.charAt(0)}
                                        </div>
                                        <div className={cn(
                                            "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-neutral-950",
                                            rider.status === 'online' ? 'bg-emerald-500' :
                                                rider.status === 'busy' ? 'bg-purple-500' : 'bg-neutral-600'
                                        )} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white truncate">{rider.name}</h3>
                                        <p className="text-xs text-neutral-500">{rider.phone}</p>
                                    </div>
                                    <div className="text-right">
                                        <Badge className={cn(
                                            "px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-none",
                                            rider.status === 'online' ? 'bg-emerald-500/10 text-emerald-500' :
                                                rider.status === 'busy' ? 'bg-purple-500/10 text-purple-500' : 'bg-neutral-800 text-neutral-500'
                                        )}>
                                            {rider.status === 'busy' ? `${rider.activeDeliveries} active` : rider.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </Card>

                        {/* Quick Stats */}
                        <Card className="p-6 bg-gradient-to-br from-purple-600/10 to-purple-800/5 border-purple-500/20 rounded-2xl">
                            <div className="flex items-center gap-4 mb-4">
                                <TrendingUp className="w-6 h-6 text-purple-500" />
                                <h3 className="font-bold text-white uppercase tracking-widest text-sm">Today's Performance</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Completed</p>
                                    <p className="text-2xl font-black text-white">24</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-1">On Time</p>
                                    <p className="text-2xl font-black text-emerald-500">92%</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Delivery Detail Modal */}
                <Modal
                    isOpen={!!selectedDelivery}
                    onClose={() => setSelectedDelivery(null)}
                    title={`ORDER #${selectedDelivery?.orderNumber}`}
                    size="lg"
                >
                    {selectedDelivery && (
                        <div className="space-y-6 p-2">
                            {/* Status */}
                            <div className="text-center py-6">
                                <Badge className={cn(
                                    "px-4 py-2 text-sm font-black uppercase tracking-widest border-none",
                                    statusConfig[selectedDelivery.status].bg,
                                    statusConfig[selectedDelivery.status].color
                                )}>
                                    {statusConfig[selectedDelivery.status].label}
                                </Badge>
                            </div>

                            {/* Customer Info */}
                            <div className="p-5 bg-black rounded-2xl border border-neutral-900 space-y-4">
                                <div className="flex items-center gap-4">
                                    <User className="w-5 h-5 text-purple-500" />
                                    <div>
                                        <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Customer</p>
                                        <p className="font-bold text-white">{selectedDelivery.customerName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Phone className="w-5 h-5 text-purple-500" />
                                    <div>
                                        <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Phone</p>
                                        <p className="font-bold text-white">{selectedDelivery.customerPhone}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <MapPin className="w-5 h-5 text-purple-500" />
                                    <div>
                                        <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Address</p>
                                        <p className="font-bold text-white">{selectedDelivery.address}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Assign Rider */}
                            {selectedDelivery.status === 'ready' && !selectedDelivery.rider && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-bold text-white uppercase tracking-widest">Assign Rider</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {riders.filter(r => r.status === 'online').map((rider) => (
                                            <Button
                                                key={rider.id}
                                                variant="outline"
                                                className="h-16 rounded-xl border-neutral-800 hover:border-purple-500/50 flex flex-col items-center justify-center gap-1"
                                                onClick={() => assignRider(selectedDelivery.id, rider.id)}
                                            >
                                                <span className="font-bold text-white">{rider.name}</span>
                                                <span className="text-xs text-emerald-500">Available</span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Current Rider */}
                            {selectedDelivery.rider && (
                                <div className="p-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-bold text-xl">
                                            {selectedDelivery.rider.name.charAt(0)}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-white">{selectedDelivery.rider.name}</p>
                                            <p className="text-sm text-neutral-400">{selectedDelivery.rider.phone}</p>
                                        </div>
                                        <Button className="h-12 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold uppercase tracking-widest text-[10px]">
                                            <Phone className="w-4 h-4 mr-2" />
                                            Call
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Close Button */}
                            <Button
                                variant="outline"
                                className="w-full h-14 rounded-xl border-neutral-800 text-neutral-400 font-bold uppercase tracking-widest text-xs"
                                onClick={() => setSelectedDelivery(null)}
                            >
                                Close
                            </Button>
                        </div>
                    )}
                </Modal>
            </motion.div>
        </div>
    )
}
