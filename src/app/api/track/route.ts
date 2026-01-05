import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client
function getAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase configuration missing')
    }

    return createClient(supabaseUrl, supabaseServiceKey)
}

// GET /api/track?order_number=1234 - Get tracking info for an order
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const orderNumber = searchParams.get('order_number')
        const orderId = searchParams.get('order_id')

        if (!orderNumber && !orderId) {
            return NextResponse.json(
                { success: false, error: 'order_number or order_id is required' },
                { status: 400 }
            )
        }

        const supabase = getAdminClient()

        // Find the order
        let orderQuery = supabase
            .from('orders')
            .select(`
                id,
                order_number,
                status,
                total,
                notes,
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

        if (orderNumber) {
            orderQuery = orderQuery.eq('order_number', parseInt(orderNumber))
        } else {
            orderQuery = orderQuery.eq('id', orderId)
        }

        const { data: order, error: orderError } = await orderQuery.single()

        if (orderError || !order) {
            return NextResponse.json(
                { success: false, error: 'Order not found' },
                { status: 404 }
            )
        }

        // Get delivery assignment if exists
        const { data: assignment } = await supabase
            .from('delivery_assignments')
            .select(`
                id,
                status,
                customer_name,
                customer_phone,
                delivery_address,
                delivery_lat,
                delivery_lng,
                pickup_lat,
                pickup_lng,
                estimated_delivery_time,
                rider:staff(
                    id,
                    name,
                    phone
                )
            `)
            .eq('order_id', order.id)
            .single()

        // Get rider location if assigned
        let riderLocation = null
        let etaMinutes = null

        // Handle rider data (could be array or object depending on join)
        const rider = Array.isArray(assignment?.rider) ? assignment.rider[0] : assignment?.rider

        if (rider?.id && assignment) {
            const { data: location } = await supabase
                .from('rider_locations')
                .select('*')
                .eq('rider_id', rider.id)
                .single()

            if (location) {
                riderLocation = {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    heading: location.heading,
                    speed: location.speed,
                    is_online: location.is_online,
                    updated_at: location.updated_at,
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

        // Parse delivery info from order notes if no assignment
        let deliveryInfo = {
            status: assignment?.status || order.status,
            customer_name: assignment?.customer_name || '',
            delivery_address: assignment?.delivery_address || '',
            destination: assignment ? {
                lat: assignment.delivery_lat,
                lng: assignment.delivery_lng,
            } : null,
            pickup: assignment ? {
                lat: assignment.pickup_lat,
                lng: assignment.pickup_lng,
            } : null,
            rider: assignment?.rider || null,
            estimated_delivery: assignment?.estimated_delivery_time || null,
        }

        // Extract info from notes if not in assignment (legacy orders)
        if (!assignment && order.notes) {
            const parts = order.notes.split(' | ')
            if (parts.length >= 2) {
                deliveryInfo.customer_name = parts[1] || ''
                deliveryInfo.delivery_address = parts[3] || ''
            }
        }

        // Restaurant info with default location if not set
        const restaurant = order.restaurant as any
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
                status: order.status,
                total: order.total,
                created_at: order.created_at,
            },
            delivery: deliveryInfo,
            rider_location: riderLocation,
            restaurant: restaurantInfo,
            eta_minutes: etaMinutes,
        })

    } catch (error) {
        console.error('Track API error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to get tracking info' },
            { status: 500 }
        )
    }
}
