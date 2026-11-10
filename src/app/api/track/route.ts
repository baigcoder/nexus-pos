import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { privateOrderHeaders, verifyOrderAccessToken } from '@/lib/order-access'

function normalizeTrackingStatus(params: {
    orderStatus: string | null | undefined
    deliveryStatus?: string | null
    hasDeliveryAssignment: boolean
    hasRiderLocation: boolean
}) {
    const orderStatus = params.orderStatus?.toLowerCase()
    const deliveryStatus = params.deliveryStatus?.toLowerCase()

    if (deliveryStatus === 'delivered' || (!params.hasDeliveryAssignment && orderStatus === 'paid')) {
        return 'delivered'
    }

    if (
        deliveryStatus === 'dispatched' ||
        deliveryStatus === 'out_for_delivery' ||
        deliveryStatus === 'picked_up' || deliveryStatus === 'en_route' || deliveryStatus === 'arrived'
    ) {
        return 'dispatched'
    }

    if (orderStatus === 'served') {
        return (params.hasDeliveryAssignment || params.hasRiderLocation) ? 'dispatched' : 'ready'
    }

    if (orderStatus === 'ready') {
        return 'ready'
    }

    if (orderStatus === 'preparing') {
        return 'preparing'
    }

    return 'pending'
}

export async function GET(request: NextRequest) {
    const headers = privateOrderHeaders
    try {
        const orderId = verifyOrderAccessToken(request.headers.get('authorization'))
        if (!orderId) {
            return NextResponse.json(
                { success: false, error: 'A valid order link is required' },
                { status: 401, headers }
            )
        }

        const supabase = createAdminClient()
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
                id,
                order_number,
                status,
                total,
                restaurant_id,
                created_at,
                restaurant:restaurants(
                    id,
                    name,
                    address,
                    phone,
                    latitude,
                    longitude
                )
            `)
            .eq('id', orderId)
            .single()

        if (orderError || !order) {
            return NextResponse.json(
                { success: false, error: 'Order not found' },
                { status: 404, headers }
            )
        }

        // Get delivery assignment if exists
        const { data: assignment } = await supabase
            .from('delivery_assignments')
            .select(`
                id,
                status,
                delivery_lat,
                delivery_lng,
                pickup_lat,
                pickup_lng,
                estimated_delivery_time,
                rider:staff(
                    id,
                    name
                )
            `)
            .eq('order_id', order.id)
            .eq('restaurant_id', order.restaurant_id)
            .single()

        // Get rider location if assigned
        let riderLocation = null
        let etaMinutes = null

        // Handle rider data (could be array or object depending on join)
        const rider = Array.isArray(assignment?.rider) ? assignment.rider[0] : assignment?.rider

        const isInTransit = assignment && ['picked_up', 'dispatched', 'out_for_delivery', 'en_route', 'arrived'].includes(assignment.status)
        if (rider?.id && isInTransit && assignment) {
            const { data: location } = await supabase
                .from('rider_location_history')
                .select('latitude, longitude, heading, speed, recorded_at')
                .eq('rider_id', rider.id)
                .eq('order_id', order.id)
                .gte('recorded_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
                .order('recorded_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (location) {
                riderLocation = {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    heading: location.heading,
                    speed: location.speed,
                    is_online: true,
                    updated_at: location.recorded_at,
                }

                // Calculate ETA if destination available
                if (assignment.delivery_lat && assignment.delivery_lng) {
                    const { data: eta } = await supabase.rpc('calculate_eta', {
                        p_rider_lat: location.latitude,
                        p_rider_lng: location.longitude,
                        p_dest_lat: assignment.delivery_lat,
                        p_dest_lng: assignment.delivery_lng,
                    })
                    etaMinutes = eta
                }
            }
        }

        const trackingStatus = normalizeTrackingStatus({
            orderStatus: order.status,
            deliveryStatus: assignment?.status,
            hasDeliveryAssignment: !!assignment,
            hasRiderLocation: !!riderLocation,
        })

        const deliveryInfo = {
            status: trackingStatus,
            destination: assignment ? {
                lat: assignment.delivery_lat,
                lng: assignment.delivery_lng,
            } : null,
            pickup: assignment ? {
                lat: assignment.pickup_lat,
                lng: assignment.pickup_lng,
            } : null,
            rider: assignment?.rider
                ? {
                    name: (Array.isArray(assignment.rider) ? assignment.rider[0] : assignment.rider)?.name,
                }
                : null,
            estimated_delivery: assignment?.estimated_delivery_time || null,
        }

        // Restaurant info with default location if not set
        const restaurant = order.restaurant as {
            name?: string
            address?: string
            phone?: string
            latitude?: number
            longitude?: number
        } | null
        const restaurantInfo = {
            name: restaurant?.name || 'Restaurant',
            address: restaurant?.address || '',
            phone: restaurant?.phone || '',
            location: {
                lat: restaurant?.latitude || 24.8607,
                lng: restaurant?.longitude || 67.0011,
            }
        }

        return NextResponse.json({
            success: true,
            order: {
                order_number: order.order_number,
                status: trackingStatus,
                raw_status: order.status,
                total: order.total,
                created_at: order.created_at,
            },
            delivery: deliveryInfo,
            rider_location: riderLocation,
            restaurant: restaurantInfo,
            eta_minutes: etaMinutes,
        }, { headers })

    } catch (error) {
        console.error('Track API error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to get tracking info' },
            { status: 500, headers }
        )
    }
}
