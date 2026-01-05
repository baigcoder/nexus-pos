import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client for server-side operations
function getAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase configuration missing')
    }

    return createClient(supabaseUrl, supabaseServiceKey)
}

// POST /api/delivery/location - Update rider location
export async function POST(request: NextRequest) {
    try {
        const supabase = getAdminClient()

        const body = await request.json()
        const {
            rider_id,
            latitude,
            longitude,
            accuracy,
            heading,
            speed,
            battery_level,
            order_id, // Optional: track for specific order
        } = body

        if (!rider_id || latitude === undefined || longitude === undefined) {
            return NextResponse.json(
                { error: 'rider_id, latitude, and longitude are required' },
                { status: 400 }
            )
        }

        // Validate coordinates
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return NextResponse.json(
                { error: 'Invalid coordinates' },
                { status: 400 }
            )
        }

        // Get restaurant ID for the rider
        const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('restaurant_id')
            .eq('id', rider_id)
            .single()

        if (staffError || !staff) {
            return NextResponse.json(
                { error: 'Rider not found' },
                { status: 404 }
            )
        }

        // Upsert current location
        const { error: locationError } = await supabase
            .from('rider_locations')
            .upsert({
                rider_id,
                restaurant_id: staff.restaurant_id,
                latitude,
                longitude,
                accuracy: accuracy || null,
                heading: heading || null,
                speed: speed || null,
                battery_level: battery_level || null,
                is_online: true,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'rider_id'
            })

        if (locationError) {
            console.error('Location update error:', locationError)
            return NextResponse.json(
                { error: 'Failed to update location' },
                { status: 500 }
            )
        }

        // If tracking for a specific order, record in history
        if (order_id) {
            await supabase
                .from('rider_location_history')
                .insert({
                    rider_id,
                    order_id,
                    latitude,
                    longitude,
                    accuracy,
                    heading,
                    speed,
                })
        }

        return NextResponse.json({
            success: true,
            message: 'Location updated',
        })

    } catch (error) {
        console.error('Location API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// GET /api/delivery/location?rider_id=xxx - Get rider location
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const riderId = searchParams.get('rider_id')
        const orderId = searchParams.get('order_id')

        if (!riderId && !orderId) {
            return NextResponse.json(
                { error: 'rider_id or order_id is required' },
                { status: 400 }
            )
        }

        const supabase = getAdminClient()

        if (riderId) {
            // Get current location for rider
            const { data: location, error } = await supabase
                .from('rider_locations')
                .select('*')
                .eq('rider_id', riderId)
                .single()

            if (error || !location) {
                return NextResponse.json(
                    { error: 'Location not found' },
                    { status: 404 }
                )
            }

            return NextResponse.json({
                success: true,
                location: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    accuracy: location.accuracy,
                    heading: location.heading,
                    speed: location.speed,
                    is_online: location.is_online,
                    updated_at: location.updated_at,
                },
            })
        }

        if (orderId) {
            // Get delivery assignment and rider location for an order
            const { data: assignment, error: assignmentError } = await supabase
                .from('delivery_assignments')
                .select(`
                    *,
                    rider:staff(id, name, phone),
                    order:orders(id, order_number, status)
                `)
                .eq('order_id', orderId)
                .single()

            if (assignmentError || !assignment) {
                return NextResponse.json(
                    { error: 'Delivery assignment not found' },
                    { status: 404 }
                )
            }

            // Get rider's current location
            const { data: location } = await supabase
                .from('rider_locations')
                .select('*')
                .eq('rider_id', assignment.rider_id)
                .single()

            // Calculate ETA if both locations available
            let eta = null
            if (location && assignment.delivery_lat && assignment.delivery_lng) {
                const { data: etaResult } = await supabase.rpc('calculate_eta', {
                    p_rider_lat: location.latitude,
                    p_rider_lng: location.longitude,
                    p_dest_lat: assignment.delivery_lat,
                    p_dest_lng: assignment.delivery_lng,
                })
                eta = etaResult
            }

            return NextResponse.json({
                success: true,
                delivery: {
                    id: assignment.id,
                    status: assignment.status,
                    customer_name: assignment.customer_name,
                    delivery_address: assignment.delivery_address,
                    destination: {
                        lat: assignment.delivery_lat,
                        lng: assignment.delivery_lng,
                    },
                    pickup: {
                        lat: assignment.pickup_lat,
                        lng: assignment.pickup_lng,
                    },
                    rider: assignment.rider,
                    estimated_delivery: assignment.estimated_delivery_time,
                },
                rider_location: location ? {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    heading: location.heading,
                    speed: location.speed,
                    updated_at: location.updated_at,
                    is_online: location.is_online,
                } : null,
                eta_minutes: eta,
            })
        }

    } catch (error) {
        console.error('Location GET API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
