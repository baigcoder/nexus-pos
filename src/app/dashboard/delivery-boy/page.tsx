'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Truck,
  MapPin,
  Phone,
  Package,
  Clock,
  CheckCircle2,
  Navigation,
  Play,
  Bell,
  ChefHat,
  RefreshCw,
  Map
} from 'lucide-react'
import { Card, Button, Badge, LoadingSpinner } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { withStaffAuthHeaders } from '@/lib/staff-api'
import LiveTrackingMap from '@/components/maps/LiveTrackingMap'

// Types
type DeliveryStatus = 'assigned' | 'ready_pickup' | 'picked_up' | 'in_transit' | 'delivered'

interface AssignedOrder {
  id: string
  orderId: string
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

const statusConfig: Record<DeliveryStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  assigned: { label: 'Assigned', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Bell },
  ready_pickup: { label: 'Ready for Pickup', color: 'text-brand', bg: 'bg-brand-subtle', icon: ChefHat },
  picked_up: { label: 'Picked Up', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: Package },
  in_transit: { label: 'In Transit', color: 'text-brand', bg: 'bg-brand-subtle', icon: Navigation },
  delivered: { label: 'Delivered', color: 'text-[var(--text-muted)]', bg: 'bg-[var(--surface-active)]', icon: CheckCircle2 },
}

function normalizeAssignmentStatus(status?: string): DeliveryStatus {
  if (status === 'delivered') return 'delivered'
  if (status === 'en_route' || status === 'arrived') return 'in_transit'
  if (status === 'picked_up') return 'picked_up'
  if (status === 'assigned' || status === 'pending') return 'assigned'
  return 'ready_pickup'
}

export default function DeliveryBoyPage() {
  const { staff, userRole } = useAuthStore()
  const { success, error: showError } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [orders, setOrders] = useState<AssignedOrder[]>([])
  const [deliveryScope, setDeliveryScope] = useState<'mine' | 'restaurant'>('mine')
  const [serverRole, setServerRole] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<AssignedOrder | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isTracking, setIsTracking] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const loadAssignedOrders = useCallback(async () => {
      if (!staff?.id) return
      setIsLoading(true)
      const res = await fetch('/api/delivery/assignments', {
        headers: withStaffAuthHeaders(),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        showError('Delivery Error', data.error || 'Failed to load deliveries')
        setIsLoading(false)
        return
      }

      setDeliveryScope(data.scope || 'mine')
      setServerRole(data.role || null)
      setOrders((data.assignments || []).map((assignment: any) => {
        const order = Array.isArray(assignment.order) ? assignment.order[0] : assignment.order
        return {
          id: assignment.id,
          orderId: order?.id || '',
          orderNumber: order?.order_number || 0,
          customerName: assignment.customer_name || 'Customer',
          customerPhone: assignment.customer_phone || '',
          address: assignment.delivery_address || '',
          status: normalizeAssignmentStatus(assignment.status),
          items: (order?.order_items || []).map((item: any) => ({
            name: item.menu_item?.name || 'Menu Item',
            quantity: Number(item.quantity || 0),
          })),
          total: Number(order?.total || 0),
          createdAt: order?.created_at || assignment.created_at,
          restaurantLocation: {
            lat: Number(assignment.pickup_lat || 24.8607),
            lng: Number(assignment.pickup_lng || 67.0011),
          },
          customerLocation: {
            lat: Number(assignment.delivery_lat || 24.8607),
            lng: Number(assignment.delivery_lng || 67.0011),
          },
        }
      }))
      setIsLoading(false)
  }, [staff?.id, showError])

  useEffect(() => {
    loadAssignedOrders()
  }, [loadAssignedOrders])

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
              headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
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
  const updateOrderStatus = async (orderId: string, newStatus: DeliveryStatus) => {
    const assignmentStatus =
      newStatus === 'picked_up' ? 'picked_up' :
        newStatus === 'in_transit' ? 'en_route' :
          newStatus === 'delivered' ? 'delivered' :
            'assigned'

    const res = await fetch('/api/delivery/assignments', {
      method: 'PATCH',
      headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ assignmentId: orderId, status: assignmentStatus }),
    })
    const result = await res.json()

    if (!res.ok || !result.success) {
      showError('Update Failed', result.error || 'Could not update delivery')
      return
    }

    const order = orders.find(o => o.id === orderId)
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: newStatus } : o
    ))

    if (newStatus === 'picked_up') {
      success('Order Picked Up', `Order #${order?.orderNumber} collected from kitchen`)
    } else if (newStatus === 'in_transit') {
      startTracking(order?.orderId)
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

  const effectiveRole = serverRole || userRole || staff?.role
  const canWorkDelivery = effectiveRole === 'delivery' || effectiveRole === 'rider'
  const canManageDelivery = effectiveRole === 'owner' || effectiveRole === 'manager'
  const canChangeStatus = canWorkDelivery || canManageDelivery

  return (
    <div className="min-h-screen pb-20">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3">
            <motion.div variants={itemVariant} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-xl flex items-center justify-center shadow-cyan-500/30">
                <Truck className="w-5 h-5 text-[var(--text-primary)]" />
              </div>
              <Badge variant="outline" className="border-brand/20 text-brand bg-cyan-500/5 px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                {deliveryScope === 'restaurant' ? 'DELIVERY MONITOR' : 'DELIVERY PORTAL'}
              </Badge>
            </motion.div>
            <motion.h1 variants={itemVariant} className="text-4xl lg:text-6xl font-display font-bold text-[var(--text-primary)] tracking-tight uppercase">
              My <span className="text-brand">Deliveries</span>
            </motion.h1>
            <motion.p variants={itemVariant} className="text-[var(--text-muted)] text-lg font-medium">
              {deliveryScope === 'restaurant'
                ? `Viewing all delivery work for ${staff?.name ? `${staff.name}'s restaurant` : 'this restaurant'}`
                : `Welcome back, ${staff?.name || 'Driver'}`}
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
              onClick={loadAssignedOrders}
              disabled={isLoading}
              className="h-12 px-6 rounded-xl border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-widest text-[10px] hover:text-[var(--text-primary)]"
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </motion.div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pending', value: stats.pending, color: 'text-brand', bg: 'bg-brand-subtle' },
            { label: 'Active', value: stats.active, color: 'text-brand', bg: 'bg-brand-subtle' },
            { label: 'Completed', value: stats.completed, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          ].map((stat, idx) => (
            <motion.div key={idx} variants={itemVariant}>
              <Card className={cn("p-5 bg-[var(--background)] border-[var(--surface-raised)] rounded-2xl", stat.bg)}>
                <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">{stat.label}</p>
                <p className={cn("text-3xl font-black", stat.color)}>{stat.value}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Active Delivery Map */}
        {activeOrder && (
          <motion.div variants={itemVariant}>
            <Card className="p-0 bg-[var(--background)] border-brand/20 rounded-[2rem] overflow-hidden">
              <div className="p-6 border-b border-[var(--surface-raised)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-subtle flex items-center justify-center">
                    <Navigation className="w-6 h-6 text-brand animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)]">Active Delivery - Order #{activeOrder.orderNumber}</h3>
                    <p className="text-sm text-[var(--text-muted)]">{activeOrder.address}</p>
                  </div>
                </div>
                <Button
                  className="h-12 px-8 bg-emerald-500 hover:bg-emerald-600 text-[var(--text-primary)] rounded-xl font-bold uppercase tracking-widest text-xs"
                  onClick={() => updateOrderStatus(activeOrder.id, 'delivered')}
                  disabled={!canChangeStatus}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Delivered
                </Button>
              </div>

              {/* Live Map */}
              <div className="h-80">
                {currentLocation && activeOrder.customerLocation ? (
                  <LiveTrackingMap
                    restaurantLocation={activeOrder.restaurantLocation}
                    customerLocation={activeOrder.customerLocation}
                    riderLocation={currentLocation}
                    riderName={staff?.name || 'Rider'}
                    showRoute={true}
                    className="h-full"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-gradient-to-b from-[var(--surface-raised)] to-black">
                    <div className="text-center z-10">
                      <MapPin className="w-12 h-12 text-brand mx-auto mb-3 animate-bounce" />
                      <p className="text-sm font-bold text-[var(--text-primary)]">Waiting for GPS Signal...</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Customer can see your location in real-time
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Orders List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-widest">Assigned Orders</h2>

          {isLoading ? (
            <div className="flex justify-center py-20"><LoadingSpinner /></div>
          ) : orders.filter(o => o.status !== 'delivered').length === 0 ? (
            <Card className="p-16 bg-[var(--surface-raised)]/30 border-[var(--border)]/50 text-center rounded-[2rem] border-dashed">
              <Package className="w-16 h-16 text-[var(--text-secondary)] mx-auto mb-6" />
              <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-widest mb-2">No Orders</h3>
              <p className="text-[var(--text-muted)]">
                {deliveryScope === 'restaurant' ? 'No active delivery orders for this restaurant' : 'Wait for manager to assign orders'}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {orders.filter(o => o.status !== 'delivered').map((order) => {
                const statusCfg = statusConfig[order.status]
                const elapsed = getElapsedTime(order.createdAt)
                const StatusIcon = statusCfg.icon

                return (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} layout>
                    <Card className="p-0 bg-[var(--background)] border-[var(--surface-raised)] hover:border-[var(--border)] transition-all rounded-[2rem] overflow-hidden">
                      {/* Order Header */}
                      <div className="p-6 border-b border-[var(--surface-raised)] flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                          <span className="text-xl font-black text-[var(--text-primary)]">#{order.orderNumber}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-[var(--text-primary)]">{order.customerName}</h3>
                            <Badge className={cn("px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-none", statusCfg.bg, statusCfg.color)}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusCfg.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-[var(--text-muted)]">{order.address}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-[var(--text-primary)] tabular-nums">Rs.{order.total}</p>
                          <p className="text-xs text-[var(--text-muted)]">{elapsed}m ago</p>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="px-6 py-4 bg-[var(--surface)]/30">
                        <div className="flex flex-wrap gap-2">
                          {order.items.map((item, idx) => (
                            <span key={idx} className="px-3 py-1 bg-[var(--surface-active)] rounded-full text-xs text-[var(--text-secondary)]">
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
                          onClick={() => {
                            if (order.customerPhone) window.location.href = `tel:${order.customerPhone}`
                          }}
                          className="h-14 flex-1 rounded-xl border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-widest text-[10px] hover:text-[var(--text-primary)]"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Call Customer
                        </Button>

                        {/* Status Actions */}
                        {order.status === 'assigned' && (
                          <Button
                            className="h-14 flex-1 bg-[var(--surface-active)] hover:bg-[var(--surface-active)] text-[var(--text-primary)] rounded-xl font-bold uppercase tracking-widest text-xs"
                            disabled
                          >
                            <Clock className="w-4 h-4 mr-2" />
                            Waiting for Kitchen
                          </Button>
                        )}

                        {order.status === 'ready_pickup' && (
                          <Button
                            className="h-14 flex-1 bg-brand hover:bg-brand-hover text-[var(--text-primary)] rounded-xl font-bold uppercase tracking-widest text-xs shadow-brand/20"
                            onClick={() => updateOrderStatus(order.id, 'picked_up')}
                            disabled={!canChangeStatus}
                          >
                            <ChefHat className="w-4 h-4 mr-2" />
                            Confirm Pickup
                          </Button>
                        )}

                        {order.status === 'picked_up' && (
                          <Button
                            className="h-14 flex-1 bg-cyan-600 hover:bg-cyan-500 text-[var(--text-primary)] rounded-xl font-bold uppercase tracking-widest text-xs shadow-cyan-600/20"
                            onClick={() => updateOrderStatus(order.id, 'in_transit')}
                            disabled={!canChangeStatus}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Start Delivery
                          </Button>
                        )}

                        {order.status === 'in_transit' && (
                          <Button
                            className="h-14 flex-1 bg-emerald-500 hover:bg-emerald-600 text-[var(--text-primary)] rounded-xl font-bold uppercase tracking-widest text-xs shadow-emerald-500/20"
                            onClick={() => updateOrderStatus(order.id, 'delivered')}
                            disabled={!canChangeStatus}
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
