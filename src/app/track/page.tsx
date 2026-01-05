'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
    MapPin,
    Clock,
    Phone,
    Package,
    ChefHat,
    Truck,
    CheckCircle2,
    Navigation,
    User,
    Star,
    RefreshCw,
    AlertTriangle
} from 'lucide-react'
import { Card, Badge } from '@/components/ui/common'
import LiveTrackingMap from '@/components/maps/LiveTrackingMap'
import { createClient } from '@/lib/supabase/client'

interface TrackingData {
    order: {
        order_number: number
        status: string
        total: number
        created_at: string
    }
    delivery: {
        status: string
        customer_name: string
        delivery_address: string
        destination: { lat: number; lng: number } | null
        pickup: { lat: number; lng: number } | null
        rider: {
            id: string
            name: string
            phone: string
        } | null
    }
    rider_location: {
        latitude: number
        longitude: number
        heading: number
        speed: number
        is_online: boolean
        updated_at: string
    } | null
    restaurant: {
        name: string
        address: string
        phone: string
        location: { lat: number; lng: number }
    }
    eta_minutes: number | null
}

const statusFlow = [
    { key: 'pending', label: 'Order Placed', icon: Package },
    { key: 'preparing', label: 'Preparing', icon: ChefHat },
    { key: 'ready', label: 'Ready', icon: CheckCircle2 },
    { key: 'dispatched', label: 'On the Way', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
]

export default function TrackOrderPage({
    searchParams,
}: {
    searchParams: Promise<{ order?: string; token?: string }>
}) {
    const [trackingData, setTrackingData] = useState<TrackingData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

    const params = searchParams as unknown as { order?: string; token?: string }
    const orderNumber = params.order

    const fetchTrackingData = useCallback(async () => {
        if (!orderNumber) {
            setError('Order number is required')
            setIsLoading(false)
            return
        }

        try {
            const response = await fetch(`/api/track?order_number=${orderNumber}`)
            const data = await response.json()

            if (data.success) {
                setTrackingData(data)
                setLastUpdated(new Date())
            } else {
                setError(data.error || 'Order not found')
            }
        } catch (err) {
            setError('Failed to load tracking data')
        } finally {
            setIsLoading(false)
        }
    }, [orderNumber])

    // Initial fetch
    useEffect(() => {
        fetchTrackingData()
    }, [fetchTrackingData])

    // Real-time subscription for rider location
    useEffect(() => {
        if (!trackingData?.delivery?.rider?.id) return

        const supabase = createClient()

        const channel = supabase
            .channel('rider-location')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rider_locations',
                    filter: `rider_id=eq.${trackingData.delivery.rider.id}`,
                },
                (payload) => {
                    setTrackingData(prev => {
                        if (!prev) return prev
                        return {
                            ...prev,
                            rider_location: {
                                latitude: payload.new.latitude,
                                longitude: payload.new.longitude,
                                heading: payload.new.heading,
                                speed: payload.new.speed,
                                is_online: payload.new.is_online,
                                updated_at: payload.new.updated_at,
                            }
                        }
                    })
                    setLastUpdated(new Date())
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [trackingData?.delivery?.rider?.id])

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(fetchTrackingData, 30000)
        return () => clearInterval(interval)
    }, [fetchTrackingData])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
                    <p className="text-white text-lg">Loading tracking info...</p>
                </div>
            </div>
        )
    }

    if (error || !trackingData) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 bg-neutral-950 border-neutral-900 text-center">
                    <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Order Not Found</h1>
                    <p className="text-neutral-400 mb-6">{error || 'Unable to find this order'}</p>
                    <a
                        href="/"
                        className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors"
                    >
                        Go Home
                    </a>
                </Card>
            </div>
        )
    }

    const currentStatusIndex = statusFlow.findIndex(s => s.key === trackingData.order.status)
    const isDelivered = trackingData.order.status === 'delivered'
    const hasRider = !!trackingData.delivery.rider
    const hasRiderLocation = !!trackingData.rider_location

    // Demo locations if real ones not available
    const restaurantLocation = trackingData.restaurant.location || { lat: 24.8607, lng: 67.0011 }
    const customerLocation = trackingData.delivery.destination || { lat: 24.8797, lng: 67.0311 }
    const riderLocation = hasRiderLocation ? {
        lat: trackingData.rider_location!.latitude,
        lng: trackingData.rider_location!.longitude,
    } : undefined

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <div className="bg-gradient-to-b from-purple-900/30 to-transparent">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 mb-2">
                                LIVE TRACKING
                            </Badge>
                            <h1 className="text-2xl font-bold text-white">
                                Order #{trackingData.order.order_number}
                            </h1>
                        </div>
                        <button
                            onClick={fetchTrackingData}
                            className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-purple-500/50 transition-colors"
                        >
                            <RefreshCw className="w-5 h-5 text-neutral-400" />
                        </button>
                    </div>

                    {/* Status Progress */}
                    <div className="flex items-center justify-between relative mb-8">
                        {/* Progress Line */}
                        <div className="absolute left-0 right-0 top-5 h-1 bg-neutral-800 rounded-full -z-10">
                            <motion.div
                                className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min((currentStatusIndex / (statusFlow.length - 1)) * 100, 100)}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                        </div>

                        {statusFlow.map((status, idx) => {
                            const isCompleted = idx < currentStatusIndex
                            const isCurrent = idx === currentStatusIndex
                            const Icon = status.icon

                            return (
                                <div key={status.key} className="flex flex-col items-center">
                                    <motion.div
                                        className={`
                                            w-10 h-10 rounded-full flex items-center justify-center mb-2
                                            ${isCompleted ? 'bg-purple-600 text-white' :
                                                isCurrent ? 'bg-purple-600 text-white ring-4 ring-purple-500/30' :
                                                    'bg-neutral-800 text-neutral-500'}
                                        `}
                                        initial={{ scale: 0.8 }}
                                        animate={{ scale: isCurrent ? 1.1 : 1 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </motion.div>
                                    <span className={`text-xs font-medium ${isCurrent ? 'text-purple-400' : 'text-neutral-500'}`}>
                                        {status.label}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 pb-8 space-y-6">
                {/* ETA Card */}
                {!isDelivered && trackingData.eta_minutes && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Card className="p-6 bg-gradient-to-br from-purple-600/20 to-purple-900/10 border-purple-500/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-purple-300 font-medium mb-1">Estimated Arrival</p>
                                    <h2 className="text-4xl font-black text-white">
                                        {trackingData.eta_minutes} <span className="text-xl text-purple-300">min</span>
                                    </h2>
                                </div>
                                <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center">
                                    <Clock className="w-8 h-8 text-purple-400" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* Map */}
                {(trackingData.order.status === 'dispatched' || hasRiderLocation) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Card className="overflow-hidden bg-neutral-950 border-neutral-900">
                            <LiveTrackingMap
                                restaurantLocation={restaurantLocation}
                                customerLocation={customerLocation}
                                riderLocation={riderLocation}
                                riderName={trackingData.delivery.rider?.name}
                                showRoute={true}
                                className="h-[300px] md:h-[400px]"
                            />
                        </Card>

                        {hasRiderLocation && (
                            <p className="text-xs text-neutral-500 mt-2 text-center">
                                Last updated: {new Date(trackingData.rider_location!.updated_at).toLocaleTimeString()}
                            </p>
                        )}
                    </motion.div>
                )}

                {/* Rider Info */}
                {hasRider && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Card className="p-5 bg-neutral-950 border-neutral-900">
                            <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4">
                                Your Rider
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-bold text-xl">
                                    {trackingData.delivery.rider!.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-white text-lg">{trackingData.delivery.rider!.name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                                        <span className="text-sm text-neutral-400">4.9</span>
                                        <span className="text-neutral-600">•</span>
                                        <span className="text-sm text-neutral-400">200+ deliveries</span>
                                    </div>
                                </div>
                                <a
                                    href={`tel:${trackingData.delivery.rider!.phone}`}
                                    className="w-12 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center transition-colors"
                                >
                                    <Phone className="w-5 h-5 text-white" />
                                </a>
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* Delivery Address */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card className="p-5 bg-neutral-950 border-neutral-900">
                        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4">
                            Delivery Address
                        </h3>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                <MapPin className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="font-bold text-white">{trackingData.delivery.customer_name}</p>
                                <p className="text-neutral-400 text-sm mt-1">{trackingData.delivery.delivery_address}</p>
                            </div>
                        </div>
                    </Card>
                </motion.div>

                {/* Restaurant Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card className="p-5 bg-neutral-950 border-neutral-900">
                        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4">
                            Restaurant
                        </h3>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                <ChefHat className="w-5 h-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="font-bold text-white">{trackingData.restaurant.name}</p>
                                <p className="text-neutral-400 text-sm mt-1">{trackingData.restaurant.address}</p>
                            </div>
                        </div>
                    </Card>
                </motion.div>

                {/* Footer */}
                <div className="text-center pt-8">
                    <p className="text-neutral-500 text-sm">
                        Powered by <span className="text-purple-400 font-bold">Nexus POS</span>
                    </p>
                </div>
            </div>
        </div>
    )
}
