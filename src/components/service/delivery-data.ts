'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { withStaffAuthHeaders } from '@/lib/staff-api'
import { createClient } from '@/lib/supabase/client'

type Amount = number | string | null
type Relation<T> = T | T[] | null
type Point = { lat: number; lng: number }
type Order = {
    id: string
    order_number: number | null
    status: string
    total: Amount
    amount_paid: Amount
    payment_method: string | null
    order_items?: { quantity: number; menu_item: Relation<{ name: string }> }[]
}

export type Delivery = {
    id: string
    order_id: string
    rider_id: string | null
    status: string
    created_at: string
    actual_delivery_time?: string | null
    customer_name?: string | null
    customer_phone?: string | null
    delivery_address?: string | null
    pickup_lat?: Amount
    pickup_lng?: Amount
    delivery_lat?: Amount
    delivery_lng?: Amount
    cod_collected_at?: string | null
    cod_amount_collected?: Amount
    cod_settled?: boolean
    cancel_reason?: string | null
    order: Order | null
}

export type Rider = { id: string; name: string; phone: string | null; is_active: boolean }
type Location = { rider_id: string; is_online: boolean; latitude: Amount; longitude: Amount; updated_at: string }

export const stages = {
    kitchen: { label: 'In the kitchen', tone: 'neutral' },
    unassigned: { label: 'Needs a rider', tone: 'amber' },
    pickup: { label: 'Ready for pickup', tone: 'amber' },
    picked: { label: 'Picked up', tone: 'blue' },
    route: { label: 'On the way', tone: 'blue' },
    arrived: { label: 'At the drop-off', tone: 'blue' },
    exception: { label: 'Issue reported', tone: 'red' },
    delivered: { label: 'Delivered', tone: 'green' },
    review: { label: 'Check status', tone: 'neutral' },
} as const

export function stage(delivery: Delivery): keyof typeof stages {
    if (delivery.status === 'delivered') return 'delivered'
    if (delivery.status === 'dispatch_exception') return 'exception'
    if (delivery.status === 'picked_up') return 'picked'
    if (delivery.status === 'arrived') return 'arrived'
    if (['en_route', 'dispatched', 'out_for_delivery'].includes(delivery.status)) return 'route'
    if (!['pending_dispatch', 'assigned', 'ready_pickup'].includes(delivery.status)) return 'review'
    const ready = ['ready', 'served', 'paid'].includes(delivery.order?.status || '')
    if (!ready) return 'kitchen'
    return delivery.rider_id ? 'pickup' : 'unassigned'
}

export function inProgress(delivery: Delivery) {
    return !['delivered', 'dispatch_exception', 'cancelled'].includes(delivery.status)
}

export function onTrip(delivery: Delivery) {
    return ['picked', 'route', 'arrived'].includes(stage(delivery))
}

export function orderLabel(delivery: Delivery) {
    return delivery.order?.order_number != null ? `Order #${delivery.order.order_number}` : `Delivery ${delivery.id.slice(0, 8)}`
}

function first<T>(value: Relation<T>) {
    return Array.isArray(value) ? value[0] ?? null : value
}

export function lineItems(delivery: Delivery) {
    return (delivery.order?.order_items || []).map(item => ({
        name: first(item.menu_item)?.name || 'Menu item',
        quantity: item.quantity,
    }))
}

export function cashDue(delivery: Delivery) {
    const order = delivery.order
    return order?.payment_method === 'cash_on_delivery'
        ? Math.max(0, Math.round((Number(order.total) - Number(order.amount_paid || 0)) * 100) / 100)
        : 0
}

export function cashToSettle(delivery: Delivery) {
    return delivery.status === 'delivered' && delivery.cod_collected_at && !delivery.cod_settled
        ? Number(delivery.cod_amount_collected || 0) : 0
}

export function point(lat: Amount | undefined, lng: Amount | undefined): Point | undefined {
    if (lat == null || lng == null || lat === '' || lng === '') return undefined
    const position = { lat: Number(lat), lng: Number(lng) }
    if (Math.abs(position.lat) <= 90 && Math.abs(position.lng) <= 180) return position
}

export function locationState(location: Location | undefined, checkedAt: number) {
    if (!location) return 'No location'
    return location.is_online && checkedAt - Date.parse(location.updated_at) < 120_000 && point(location.latitude, location.longitude)
        ? 'Recent GPS' : 'Last seen'
}

export function timeLabel(value: string) {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'
}

export function phoneLink(phone?: string | null) {
    const number = phone?.replace(/[^+\d]/g, '')
    return number && /\d/.test(number) ? `tel:${number}` : undefined
}

export async function deliveryAction(assignmentId: string, status: string, details?: { riderId?: string; cashCollected?: number; reason?: string }) {
    const response = await fetch('/api/delivery/assignments', {
        method: 'PATCH',
        headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ assignmentId, status, ...details }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Could not update the delivery. Try again.')
}

async function fetchDeliveries(_restaurantId: string, signal: AbortSignal) {
    const response = await fetch('/api/delivery/assignments', { headers: withStaffAuthHeaders(), cache: 'no-store', signal })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Could not load deliveries.')
    return {
        deliveries: (data.assignments as (Omit<Delivery, 'order'> & { order: Relation<Order> })[]).map(
            row => ({ ...row, order: first(row.order) })
        ),
        scope: data.scope as 'mine' | 'restaurant',
        role: data.role as string,
        staffId: data.staffId as string,
    }
}

async function fetchRoster(restaurantId: string, signal: AbortSignal) {
    const db = createClient()
    const [staff, positions] = await Promise.all([
        db.from('staff').select('id, name, phone, is_active').eq('restaurant_id', restaurantId)
            .in('role', ['rider', 'delivery']).order('name').abortSignal(signal),
        db.from('rider_locations').select('rider_id, is_online, latitude, longitude, updated_at')
            .eq('restaurant_id', restaurantId).abortSignal(signal),
    ])
    if (staff.error) throw new Error('Could not load the rider roster.')
    return {
        riders: (staff.data || []) as Rider[],
        locations: new Map<string, Location>(((positions.data || []) as Location[]).map(row => [row.rider_id, row])),
        locationError: Boolean(positions.error),
    }
}

function useDeliveryFeed<T>(restaurantId: string, load: (id: string, signal: AbortSignal) => Promise<T>) {
    const [data, setData] = useState<T>()
    const [error, setError] = useState('')
    const [syncedAt, setSyncedAt] = useState(0)
    const [loading, setLoading] = useState(true)
    const request = useRef<AbortController | null>(null)
    const active = useRef(false)

    const refresh = useCallback(async (replace = true) => {
        if (!active.current || (!replace && request.current)) return
        request.current?.abort()
        const controller = new AbortController()
        request.current = controller
        setLoading(true)
        try {
            const next = await load(restaurantId, controller.signal)
            if (controller.signal.aborted) return
            setData(next)
            setError('')
            setSyncedAt(Date.now())
            return next
        } catch (failure) {
            if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not refresh.')
        } finally {
            if (!controller.signal.aborted) {
                request.current = null
                setLoading(false)
            }
        }
    }, [load, restaurantId])

    useEffect(() => {
        active.current = true
        void refresh()
        const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh(false) }
        const timer = window.setInterval(visibleRefresh, 15_000)
        document.addEventListener('visibilitychange', visibleRefresh)
        return () => {
            active.current = false
            request.current?.abort()
            request.current = null
            clearInterval(timer)
            document.removeEventListener('visibilitychange', visibleRefresh)
        }
    }, [refresh])

    return { data, error, loading, syncedAt, refresh }
}

export function useDeliveries(restaurantId: string) {
    return useDeliveryFeed(restaurantId, fetchDeliveries)
}

export function useRiderRoster(restaurantId: string) {
    return useDeliveryFeed(restaurantId, fetchRoster)
}
