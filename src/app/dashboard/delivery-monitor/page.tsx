'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  XCircle,
  Map as MapIcon
} from 'lucide-react'
import { Card, Button, Badge, Modal, LoadingSpinner } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import FleetMap from '@/components/maps/FleetMap'
import LiveTrackingMap from '@/components/maps/LiveTrackingMap'

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
    id?: string
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
  preparing: { label: 'Preparing', color: 'text-brand', bg: 'bg-brand-subtle' },
  ready: { label: 'Ready', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  dispatched: { label: 'Out for Delivery', color: 'text-brand', bg: 'bg-brand-subtle' },
  delivered: { label: 'Delivered', color: 'text-[var(--text-muted)]', bg: 'bg-[var(--surface-active)]' },
}

function normalizeDeliveryStatus(assignmentStatus?: string, orderStatus?: string): DeliveryStatus {
  if (assignmentStatus === 'delivered' || orderStatus === 'paid') return 'delivered'
  if (['picked_up', 'en_route', 'arrived'].includes(assignmentStatus || '')) return 'dispatched'
  if (assignmentStatus === 'assigned') return 'ready'
  if (orderStatus === 'ready' || orderStatus === 'served') return 'ready'
  if (orderStatus === 'preparing') return 'preparing'
  if (orderStatus === 'pending') return 'new'
  return 'confirmed'
}

export default function DeliveryMonitorPage() {
  const { restaurant } = useAuthStore()
  const { success, error: showError } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [deliveries, setDeliveries] = useState<ActiveDelivery[]>([])
  const [riders, setRiders] = useState<Rider[]>([])
  const [selectedDelivery, setSelectedDelivery] = useState<ActiveDelivery | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [mapView, setMapView] = useState<'fleet' | 'delivery'>('fleet')

  // Initialize time only on client to avoid hydration mismatch
  useEffect(() => {
    setCurrentTime(new Date())
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Default restaurant location (fallback to center of major cities)
  const restaurantLocation = useMemo(() => {
    // Parse from restaurant settings or use defaults
    if (restaurant?.address) {
      // TODO: Geocode address to lat/lng
    }
    // Default to Karachi, Pakistan
    return { lat: 24.8607, lng: 67.0011 }
  }, [restaurant])

  // Get rider locations for fleet map
  const riderLocations = useMemo(() => {
    return riders
      .filter(r => r.location)
      .map(r => ({
        id: r.id,
        name: r.name,
        position: r.location!,
        status: r.status as 'available' | 'busy' | 'offline'
      }))
  }, [riders])

  const loadDeliveryData = useCallback(async () => {
    if (!restaurant?.id) return
    setIsLoading(true)
    const supabase = createClient()

    try {
      // Query delivery assignments without nested selects first
      const assignmentsResult = await supabase
        .from('delivery_assignments')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false })

      // Valid restaurant ID check
      if (!restaurant?.id || typeof restaurant.id !== 'string' || restaurant.id.length < 10) {
        setIsLoading(false)
        return
      }

      // Query all active staff (with phone for delivery)
      const ridersResult = await supabase
        .from('staff')
        .select('id, name, role')
        .eq('restaurant_id', restaurant.id)

      // Query rider locations (only select columns we know exist)
      const locationsResult = await supabase
        .from('rider_locations')
        .select('rider_id, is_online, latitude, longitude')
        .eq('restaurant_id', restaurant.id)

      // Handle errors gracefully - just log them
      if (assignmentsResult.error) console.warn('Assignments query error:', assignmentsResult.error.message)
      if (ridersResult.error) console.warn('Riders query error:', ridersResult.error.message)

      const activeAssignments = (assignmentsResult.data || []) as any[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const busyRiderIds = new Set(activeAssignments.filter((assignment: any) => !['delivered', 'cancelled'].includes(assignment.status || '')).map((assignment: any) => assignment.rider_id).filter(Boolean))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const locationByRider = new Map((locationsResult.data || []).map((location: any) => [location.rider_id, location]))

      // Build rider lookup map
      const riderMap = new Map((ridersResult.data || []).map((r: any) => [r.id, r]))

      setDeliveries(activeAssignments
        .filter((a: any) => a.status !== 'cancelled')
        .map((assignment: any) => {
          const rider = assignment.rider_id ? riderMap.get(assignment.rider_id) as any : null
          const eta = assignment.estimated_delivery_time
            ? Math.max(0, Math.ceil((new Date(assignment.estimated_delivery_time).getTime() - Date.now()) / 60000))
            : 0

          return {
            id: assignment.id,
            orderNumber: assignment.order_id ? parseInt(assignment.order_id.slice(-4), 16) % 10000 : 0,
            customerName: assignment.customer_name || 'Customer',
            customerPhone: assignment.customer_phone || '',
            address: assignment.delivery_address || '',
            status: normalizeDeliveryStatus(assignment.status),
            rider: rider ? {
              id: rider.id,
              name: rider.name,
              phone: 'Contact via phone',
              status: busyRiderIds.has(rider.id) ? 'busy' : 'online',
            } : null,
            items: 0,
            total: 0,
            createdAt: assignment.created_at,
            eta,
          }
        }))

    setRiders((ridersResult.data || []).map((rider: any) => {
      const location = locationByRider.get(rider.id) as any
      return {
        id: rider.id,
        name: rider.name,
        phone: 'No phone', // Not selected, always fallback
        status: busyRiderIds.has(rider.id) ? 'busy' : location?.is_online ? 'online' : 'offline',
        activeDeliveries: activeAssignments.filter((assignment: any) => assignment.rider_id === rider.id && !['delivered', 'cancelled'].includes(assignment.status)).length,
        location: location ? { lat: Number(location.latitude), lng: Number(location.longitude) } : undefined,
      }
    }))

      setIsLoading(false)
    } catch (err) {
      console.error('Failed to load delivery data:', err)
      showError('Error', 'Failed to load delivery data')
      setIsLoading(false)
    }
  }, [restaurant?.id, showError])

  // Initial data load
  useEffect(() => {
    loadDeliveryData()
  }, [loadDeliveryData])

  // Realtime subscription for live updates
  useEffect(() => {
    if (!restaurant?.id || isLoading) return

    const supabase = createClient()

    // Subscribe to delivery assignments changes
    const channel = supabase
      .channel('delivery-monitor')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_assignments',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        (payload: any) => {
          console.log('Delivery update:', payload)
          // Refresh data on any change
          loadDeliveryData()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rider_locations',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        (payload: any) => {
          console.log('Rider location update:', payload)
          // Refresh data on location update
          loadDeliveryData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurant?.id, isLoading, loadDeliveryData])

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
    if (!currentTime) return 0
    return Math.floor((currentTime.getTime() - new Date(createdAt).getTime()) / 60000)
  }

  const assignRider = async (deliveryId: string, riderId: string) => {
    const rider = riders.find(r => r.id === riderId)
    if (!rider) return

    const supabase = createClient()
    const { error } = await supabase
      .from('delivery_assignments')
      .update({
        rider_id: riderId,
        status: 'assigned',
      })
      .eq('id', deliveryId)

    if (error) {
      showError('Assignment Failed', error.message)
      return
    }

    setDeliveries(prev => prev.map(d =>
      d.id === deliveryId
        ? { ...d, rider: { id: rider.id, name: rider.name, phone: 'No phone', status: 'busy' as RiderStatus }, status: 'dispatched' as DeliveryStatus, eta: 30 }
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
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl flex items-center justify-center shadow-purple-600/30">
                <Activity className="w-5 h-5 text-[var(--text-primary)]" />
              </div>
              <Badge variant="outline" className="border-brand/20 text-brand bg-purple-600/5 px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                REAL-TIME
              </Badge>
            </motion.div>
            <motion.h1 variants={itemVariant} className="text-4xl lg:text-6xl font-display font-bold text-[var(--text-primary)] tracking-tight uppercase">
              Delivery <span className="text-brand">Monitor</span>
            </motion.h1>
            <motion.p variants={itemVariant} className="text-[var(--text-muted)] text-lg font-medium">
              Live overview of all active deliveries and rider status
            </motion.p>
          </div>

          <motion.div variants={itemVariant} className="flex items-center gap-4">
            <Button
              variant={showMap ? 'primary' : 'outline'}
              className={cn(
                "h-12 px-6 rounded-xl font-bold uppercase tracking-widest text-[10px]",
                showMap ? "bg-purple-600 hover:bg-purple-500" : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
              onClick={() => setShowMap(!showMap)}
            >
              <MapIcon className="w-4 h-4 mr-2" />
              {showMap ? 'Hide Map' : 'Show Map'}
            </Button>
            <div className="bg-[var(--surface)] px-6 py-3 rounded-2xl border border-[var(--border)] flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                {currentTime ? currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '--:--:--'}
              </span>
            </div>
            <Button
              variant="outline"
              className="h-12 px-6 rounded-xl border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-widest text-[10px] hover:text-[var(--text-primary)]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </motion.div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {[
            { label: 'Active Orders', value: stats.totalActive, icon: Package, color: 'text-[var(--text-primary)]', accent: 'bg-white/5' },
            { label: 'In Kitchen', value: stats.inKitchen, icon: ChefHat, color: 'text-brand', accent: 'bg-brand-subtle' },
            { label: 'Ready', value: stats.readyForPickup, icon: CheckCircle2, color: 'text-emerald-500', accent: 'bg-emerald-500/10' },
            { label: 'Out for Delivery', value: stats.outForDelivery, icon: Truck, color: 'text-brand', accent: 'bg-brand-subtle' },
            { label: 'Avg Time', value: `${stats.avgDeliveryTime}m`, icon: Timer, color: 'text-blue-500', accent: 'bg-blue-500/10' },
            { label: 'Available Riders', value: stats.ridersOnline, icon: User, color: 'text-emerald-500', accent: 'bg-emerald-500/10' },
            { label: 'Busy Riders', value: stats.ridersBusy, icon: Navigation, color: 'text-brand', accent: 'bg-brand-subtle' },
          ].map((stat, idx) => (
            <motion.div key={idx} variants={itemVariant}>
              <Card className={cn("p-4 bg-[var(--background)] border-[var(--surface-raised)] hover:border-[var(--border)] transition-all rounded-2xl", stat.accent)}>
                <div className="flex items-center gap-3">
                  <stat.icon className={cn("w-5 h-5", stat.color)} />
                  <div>
                    <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{stat.label}</p>
                    <h3 className="text-xl font-black text-[var(--text-primary)]">{stat.value}</h3>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Map Section */}
        {showMap && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-widest">Live Map</h2>
              <div className="flex gap-2">
                <Button
                  variant={mapView === 'fleet' ? 'primary' : 'outline'}
                  size="sm"
                  className={cn(
                    "h-8 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                    mapView === 'fleet' ? "bg-purple-600" : "border-[var(--border)] text-[var(--text-muted)]"
                  )}
                  onClick={() => setMapView('fleet')}
                >
                  Fleet View
                </Button>
                <Button
                  variant={mapView === 'delivery' && selectedDelivery ? 'primary' : 'outline'}
                  size="sm"
                  className={cn(
                    "h-8 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                    mapView === 'delivery' && selectedDelivery ? "bg-purple-600" : "border-[var(--border)] text-[var(--text-muted)]"
                  )}
                  onClick={() => setMapView('delivery')}
                  disabled={!selectedDelivery}
                >
                  Delivery View
                </Button>
              </div>
            </div>

            {mapView === 'fleet' ? (
              <Card className="p-2 bg-[var(--background)] border-[var(--surface-raised)] rounded-2xl overflow-hidden">
                <div className="h-[400px]">
                  <FleetMap
                    restaurantLocation={restaurantLocation}
                    riders={riderLocations}
                    onRiderClick={(rider) => {
                      // Find delivery for this rider
                      const delivery = deliveries.find(d => d.rider?.id === rider.id)
                      if (delivery) {
                        setSelectedDelivery(delivery)
                        setMapView('delivery')
                      }
                    }}
                    className="h-full"
                  />
                </div>
              </Card>
            ) : selectedDelivery ? (
              <Card className="p-2 bg-[var(--background)] border-[var(--surface-raised)] rounded-2xl overflow-hidden">
                <div className="h-[400px]">
                  <LiveTrackingMap
                    restaurantLocation={restaurantLocation}
                    customerLocation={restaurantLocation} // TODO: Geocode customer address
                    riderLocation={riders.find(r => r.id === selectedDelivery.rider?.id)?.location}
                    riderName={selectedDelivery.rider?.name}
                    showRoute={true}
                    className="h-full"
                  />
                </div>
              </Card>
            ) : (
              <Card className="p-8 bg-[var(--background)] border-[var(--surface-raised)] rounded-2xl text-center">
                <MapPin className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">Select a delivery to view live tracking</p>
              </Card>
            )}
          </motion.div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Active Deliveries */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-widest">Active Deliveries</h2>
              <Badge className="bg-brand-subtle text-brand border-brand/20 px-3 py-1">
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
                        "p-5 bg-[var(--background)] border-[var(--surface-raised)] hover:border-[var(--border)] transition-all rounded-2xl cursor-pointer group",
                        isLate && "border-l-4 border-l-rose-500"
                      )} onClick={() => setSelectedDelivery(delivery)}>
                        <div className="flex items-center gap-6">
                          {/* Order Number */}
                          <div className="w-16 h-16 shrink-0 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center group-hover:border-brand/30 transition-colors">
                            <span className="text-xl font-black text-[var(--text-primary)]">#{delivery.orderNumber}</span>
                          </div>

                          {/* Customer Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-[var(--text-primary)] truncate">{delivery.customerName}</h3>
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
                            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
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
                                <p className="text-xs text-[var(--text-muted)]">ETA: {delivery.eta} min</p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm font-bold text-brand">No Rider</p>
                                <p className="text-xs text-[var(--text-muted)]">{elapsed}m ago</p>
                              </div>
                            )}
                          </div>

                          {/* Amount */}
                          <div className="shrink-0 text-right">
                            <p className="text-lg font-black text-[var(--text-primary)] tabular-nums">Rs.{delivery.total}</p>
                          </div>

                          <Eye className="w-5 h-5 text-[var(--text-muted)] group-hover:text-brand transition-colors shrink-0" />
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
              <h2 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-widest">Rider Fleet</h2>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">
                {stats.ridersOnline} available
              </Badge>
            </div>

            <Card className="p-0 bg-[var(--background)] border-[var(--surface-raised)] rounded-2xl overflow-hidden divide-y divide-[var(--surface-raised)]">
              {riders.map((rider) => (
                <div key={rider.id} className="p-4 flex items-center gap-4 hover:bg-[var(--surface-raised)]/50 transition-colors">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-[var(--text-primary)] font-bold text-lg">
                      {rider.name.charAt(0)}
                    </div>
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--background)]",
                      rider.status === 'online' ? 'bg-emerald-500' :
                        rider.status === 'busy' ? 'bg-purple-500' : 'bg-[var(--surface-active)]'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[var(--text-primary)] truncate">{rider.name}</h3>
                    <p className="text-xs text-[var(--text-muted)]">{rider.phone}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={cn(
                      "px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-none",
                      rider.status === 'online' ? 'bg-emerald-500/10 text-emerald-500' :
                        rider.status === 'busy' ? 'bg-brand-subtle text-brand' : 'bg-[var(--surface-active)] text-[var(--text-muted)]'
                    )}>
                      {rider.status === 'busy' ? `${rider.activeDeliveries} active` : rider.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </Card>

            {/* Quick Stats */}
            <Card className="p-6 bg-gradient-to-br from-purple-600/10 to-purple-800/5 border-brand/20 rounded-2xl">
              <div className="flex items-center gap-4 mb-4">
                <TrendingUp className="w-6 h-6 text-brand" />
                  <h3 className="font-bold text-[var(--text-primary)] uppercase tracking-widest text-sm">Today&apos;s Performance</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Completed</p>
                  <p className="text-2xl font-black text-[var(--text-primary)]">24</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">On Time</p>
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
              <div className="p-5 bg-[var(--surface)] rounded-2xl border border-[var(--surface-raised)] space-y-4">
                <div className="flex items-center gap-4">
                  <User className="w-5 h-5 text-brand" />
                  <div>
                    <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Customer</p>
                    <p className="font-bold text-[var(--text-primary)]">{selectedDelivery.customerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Phone className="w-5 h-5 text-brand" />
                  <div>
                    <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Phone</p>
                    <p className="font-bold text-[var(--text-primary)]">{selectedDelivery.customerPhone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <MapPin className="w-5 h-5 text-brand" />
                  <div>
                    <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Address</p>
                    <p className="font-bold text-[var(--text-primary)]">{selectedDelivery.address}</p>
                  </div>
                </div>
              </div>

              {/* Assign Rider */}
              {selectedDelivery.status === 'ready' && !selectedDelivery.rider && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">Assign Rider</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {riders.filter(r => r.status === 'online').map((rider) => (
                      <Button
                        key={rider.id}
                        variant="outline"
                        className="h-16 rounded-xl border-[var(--border)] hover:border-brand/50 flex flex-col items-center justify-center gap-1"
                        onClick={() => assignRider(selectedDelivery.id, rider.id)}
                      >
                        <span className="font-bold text-[var(--text-primary)]">{rider.name}</span>
                        <span className="text-xs text-emerald-500">Available</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Current Rider */}
              {selectedDelivery.rider && (
                <div className="p-5 bg-brand-subtle border border-brand/20 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-[var(--text-primary)] font-bold text-xl">
                      {selectedDelivery.rider.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-[var(--text-primary)]">{selectedDelivery.rider.name}</p>
                      <p className="text-sm text-[var(--text-muted)]">{selectedDelivery.rider.phone}</p>
                    </div>
                    <Button className="h-12 px-6 bg-purple-600 hover:bg-purple-500 text-[var(--text-primary)] rounded-xl font-bold uppercase tracking-widest text-[10px]">
                      <Phone className="w-4 h-4 mr-2" />
                      Call
                    </Button>
                  </div>
                </div>
              )}

              {/* Close Button */}
              <Button
                variant="outline"
                className="w-full h-14 rounded-xl border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-widest text-xs"
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
