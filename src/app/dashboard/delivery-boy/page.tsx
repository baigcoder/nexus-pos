'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Truck,
    MapPin,
    Phone,
    Package,
    Clock,
    CheckCircle2,
    Navigation,
    Play,
    Square,
    User,
    Bell,
    AlertTriangle,
    ChefHat,
    Zap,
    Timer,
    Star,
    RefreshCw
} from 'lucide-react'
import { Card, Button, Badge, Modal, LoadingSpinner } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'

// Types
type DeliveryStatus = 'assigned' | 'ready_pickup' | 'picked_up' | 'in_transit' | 'delivered'

interface AssignedOrder {
    id: string
    orderNumber: number
    customerName: string
    customerPhone: string
    address: string
    status: DeliveryStatus
    items: { name: string; quantity: number }[]
    total: number
    createdAt: string
    restaurantLocation: { lat: number; lng: number }
    customerLocation: { lat: number; lng: number }
}

const statusConfig: Record<DeliveryStatus, { label: string; color: string; bg: string; icon: any }> = {
    assigned: { label: 'Assigned', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Bell },
    ready_pickup: { label: 'Ready for Pickup', color: 'text-orange-500', bg: 'bg-orange-500/10', icon: ChefHat },
    picked_up: { label: 'Picked Up', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: Package },
    in_transit: { label: 'In Transit', color: 'text-purple-500', bg: 'bg-purple-500/10', icon: Navigation },
    delivered: { label: 'Delivered', color: 'text-neutral-500', bg: 'bg-neutral-800', icon: CheckCircle2 },
}

// Mock data
const mockOrders: AssignedOrder[] = [
    {
        id: '1',
        orderNumber: 7901,
        customerName: 'Ahmed Hassan',
        customerPhone: '+92 300 1234567',
        address: 'House 45, Block 5, Clifton, Karachi',
        status: 'ready_pickup',
        items: [
            { name: 'Butter Chicken', quantity: 2 },
            { name: 'Naan', quantity: 4 },
        ],
        total: 1450,
        createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
        restaurantLocation: { lat: 24.8607, lng: 67.0011 },
        customerLocation: { lat: 24.8150, lng: 67.0300 },
    },
    {
        id: '2',
        orderNumber: 7895,
        customerName: 'Sara Khan',
        customerPhone: '+92 321 9876543',
        address: 'Apt 12, DHA Phase 6, Karachi',
        status: 'assigned',
        items: [
            { name: 'Biryani', quantity: 1 },
            { name: 'Raita', quantity: 1 },
        ],
        total: 850,
        createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
        restaurantLocation: { lat: 24.8607, lng: 67.0011 },
        customerLocation: { lat: 24.7850, lng: 67.0650 },
    },
]

export default function DeliveryBoyPage() {
    const { staff, restaurant } = useAuthStore()
    const { success, error: showError } = useToast()
    const [isLoading, setIsLoading] = useState(true)
    const [orders, setOrders] = useState<AssignedOrder[]>(mockOrders)
    const [activeOrder, setActiveOrder] = useState<AssignedOrder | null>(null)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [isTracking, setIsTracking] = useState(false)
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)

    useEffect(() => {
        setTimeout(() => setIsLoading(false), 500)
        const interval = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    const getElapsedTime = (createdAt: string) => {
        return Math.floor((currentTime.getTime() - new Date(createdAt).getTime()) / 60000)
    }

    const stats = useMemo(() => ({
        pending: orders.filter(o => ['assigned', 'ready_pickup'].includes(o.status)).length,
        active: orders.filter(o => ['picked_up', 'in_transit'].includes(o.status)).length,
        completed: orders.filter(o => o.status === 'delivered').length,
    }), [orders])

    // Start GPS tracking and send updates to backend
    const startTracking = (orderId?: string) => {
        if (!staff?.id) {
            showError('Error', 'Staff ID not found')
            return
        }

        if (navigator.geolocation) {
            setIsTracking(true)

            const watchId = navigator.geolocation.watchPosition(
                async (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    }
                    setCurrentLocation(location)

                    // Send location update to backend
                    try {
                        await fetch('/api/delivery/location', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                rider_id: staff.id,
                                latitude: location.lat,
                                longitude: location.lng,
                                accuracy: position.coords.accuracy,
                                heading: position.coords.heading,
                                speed: position.coords.speed ? position.coords.speed * 3.6 : null, // m/s to km/h
                                order_id: orderId,
                            }),
                        })
                    } catch (err) {
                        console.error('Failed to send location:', err)
                    }
                },
                (error) => {
                    console.error('GPS Error:', error)
                    showError('GPS Error', 'Could not get your location. Please enable location access.')
                    setIsTracking(false)
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 5000, // 5 seconds
                    timeout: 10000
                }
            )

            // Store watch ID to clear later
            return watchId
        } else {
            showError('GPS Not Available', 'Your device does not support GPS tracking')
        }
    }

    // Stop tracking
    const stopTracking = () => {
        setIsTracking(false)
        setCurrentLocation(null)
    }

    const updateOrderStatus = (orderId: string, newStatus: DeliveryStatus) => {
        setOrders(prev => prev.map(o =>
            o.id === orderId ? { ...o, status: newStatus } : o
        ))

        const order = orders.find(o => o.id === orderId)
        const statusLabel = statusConfig[newStatus].label

        if (newStatus === 'picked_up') {
            success('Order Picked Up', `Order #${order?.orderNumber} collected from kitchen`)
        } else if (newStatus === 'in_transit') {
            startTracking()
            success('Delivery Started', `GPS tracking active for Order #${order?.orderNumber}`)
            setActiveOrder(orders.find(o => o.id === orderId) || null)
        } else if (newStatus === 'delivered') {
            setIsTracking(false)
            setActiveOrder(null)
            success('Delivery Complete!', `Order #${order?.orderNumber} delivered successfully`)
        }
    }

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
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
                            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-xl flex items-center justify-center shadow-xl shadow-cyan-500/30">
                                <Truck className="w-5 h-5 text-white" />
                            </div>
                            <Badge variant="outline" className="border-cyan-500/20 text-cyan-500 bg-cyan-500/5 px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                                DELIVERY PORTAL
                            </Badge>
                        </motion.div>
                        <motion.h1 variants={itemVariant} className="text-4xl lg:text-6xl font-display font-bold text-white tracking-tight uppercase">
                            My <span className="text-cyan-500">Deliveries</span>
                        </motion.h1>
                        <motion.p variants={itemVariant} className="text-neutral-500 text-lg font-medium">
                            Welcome back, {staff?.name || 'Driver'}
                        </motion.p>
                    </div>

                    {/* Live Status */}
                    <motion.div variants={itemVariant} className="flex items-center gap-4">
                        {isTracking && (
                            <div className="flex items-center gap-3 px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-sm font-bold text-emerald-500">GPS Active</span>
                            </div>
                        )}
                        <Button
                            variant="outline"
                            className="h-12 px-6 rounded-xl border-neutral-800 text-neutral-400 font-bold uppercase tracking-widest text-[10px] hover:text-white"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                    </motion.div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Pending', value: stats.pending, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                        { label: 'Active', value: stats.active, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
                        { label: 'Completed', value: stats.completed, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    ].map((stat, idx) => (
                        <motion.div key={idx} variants={itemVariant}>
                            <Card className={cn("p-5 bg-neutral-950 border-neutral-900 rounded-2xl", stat.bg)}>
                                <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mb-1">{stat.label}</p>
                                <p className={cn("text-3xl font-black", stat.color)}>{stat.value}</p>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Active Delivery Map Placeholder */}
                {activeOrder && (
                    <motion.div variants={itemVariant}>
                        <Card className="p-0 bg-neutral-950 border-cyan-500/20 rounded-[2rem] overflow-hidden">
                            <div className="p-6 border-b border-neutral-900 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                                        <Navigation className="w-6 h-6 text-cyan-500 animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">Active Delivery - Order #{activeOrder.orderNumber}</h3>
                                        <p className="text-sm text-neutral-500">{activeOrder.address}</p>
                                    </div>
                                </div>
                                <Button
                                    className="h-12 px-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs"
                                    onClick={() => updateOrderStatus(activeOrder.id, 'delivered')}
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Mark Delivered
                                </Button>
                            </div>

                            {/* Map Placeholder */}
                            <div className="h-64 bg-gradient-to-b from-neutral-900 to-black flex items-center justify-center relative">
                                <div className="absolute inset-0 opacity-20" style={{
                                    backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%2306b6d4\' fill-opacity=\'0.3\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                                }} />
                                <div className="text-center z-10">
                                    <MapPin className="w-12 h-12 text-cyan-500 mx-auto mb-3 animate-bounce" />
                                    <p className="text-sm font-bold text-white">Live GPS Tracking Active</p>
                                    <p className="text-xs text-neutral-500 mt-1">
                                        Customer can see your location in real-time
                                    </p>
                                    {currentLocation && (
                                        <p className="text-xs text-cyan-500 mt-2 font-mono">
                                            {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* Orders List */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-white uppercase tracking-widest">Assigned Orders</h2>

                    {isLoading ? (
                        <div className="flex justify-center py-20"><LoadingSpinner /></div>
                    ) : orders.filter(o => o.status !== 'delivered').length === 0 ? (
                        <Card className="p-16 bg-neutral-900/30 border-neutral-800/50 text-center rounded-[2rem] border-dashed">
                            <Package className="w-16 h-16 text-neutral-800 mx-auto mb-6" />
                            <h3 className="text-xl font-bold text-white uppercase tracking-widest mb-2">No Orders</h3>
                            <p className="text-neutral-500">Wait for manager to assign orders</p>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {orders.filter(o => o.status !== 'delivered').map((order) => {
                                const statusCfg = statusConfig[order.status]
                                const elapsed = getElapsedTime(order.createdAt)
                                const StatusIcon = statusCfg.icon

                                return (
                                    <motion.div key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} layout>
                                        <Card className="p-0 bg-neutral-950 border-neutral-900 hover:border-neutral-800 transition-all rounded-[2rem] overflow-hidden">
                                            {/* Order Header */}
                                            <div className="p-6 border-b border-neutral-900 flex items-center gap-6">
                                                <div className="w-16 h-16 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center">
                                                    <span className="text-xl font-black text-white">#{order.orderNumber}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h3 className="font-bold text-white">{order.customerName}</h3>
                                                        <Badge className={cn("px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-none", statusCfg.bg, statusCfg.color)}>
                                                            <StatusIcon className="w-3 h-3 mr-1" />
                                                            {statusCfg.label}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-neutral-500">{order.address}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xl font-black text-white tabular-nums">Rs.{order.total}</p>
                                                    <p className="text-xs text-neutral-500">{elapsed}m ago</p>
                                                </div>
                                            </div>

                                            {/* Items */}
                                            <div className="px-6 py-4 bg-black/30">
                                                <div className="flex flex-wrap gap-2">
                                                    {order.items.map((item, idx) => (
                                                        <span key={idx} className="px-3 py-1 bg-neutral-800 rounded-full text-xs text-neutral-300">
                                                            {item.quantity}x {item.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="p-6 flex gap-3">
                                                {/* Call Customer */}
                                                <Button
                                                    variant="outline"
                                                    className="h-14 flex-1 rounded-xl border-neutral-800 text-neutral-400 font-bold uppercase tracking-widest text-[10px] hover:text-white"
                                                >
                                                    <Phone className="w-4 h-4 mr-2" />
                                                    Call Customer
                                                </Button>

                                                {/* Status Actions */}
                                                {order.status === 'assigned' && (
                                                    <Button
                                                        className="h-14 flex-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold uppercase tracking-widest text-xs"
                                                        disabled
                                                    >
                                                        <Clock className="w-4 h-4 mr-2" />
                                                        Waiting for Kitchen
                                                    </Button>
                                                )}

                                                {order.status === 'ready_pickup' && (
                                                    <Button
                                                        className="h-14 flex-1 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-orange-600/20"
                                                        onClick={() => updateOrderStatus(order.id, 'picked_up')}
                                                    >
                                                        <ChefHat className="w-4 h-4 mr-2" />
                                                        Confirm Pickup
                                                    </Button>
                                                )}

                                                {order.status === 'picked_up' && (
                                                    <Button
                                                        className="h-14 flex-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-cyan-600/20"
                                                        onClick={() => updateOrderStatus(order.id, 'in_transit')}
                                                    >
                                                        <Play className="w-4 h-4 mr-2" />
                                                        Start Delivery
                                                    </Button>
                                                )}

                                                {order.status === 'in_transit' && (
                                                    <Button
                                                        className="h-14 flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20"
                                                        onClick={() => updateOrderStatus(order.id, 'delivered')}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                                        Mark Delivered
                                                    </Button>
                                                )}
                                            </div>
                                        </Card>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

            </motion.div>
        </div>
    )
}
