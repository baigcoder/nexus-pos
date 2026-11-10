import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimitPersistent, getClientIp } from '@/lib/auth'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders })
}

// Convert "7:30 PM" style strings to 24h "19:30:00" TIME format
function parseTimeTo24h(time: string): string | null {
    const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!match) {
        // Already 24h "HH:MM" format
        if (/^\d{2}:\d{2}$/.test(time.trim())) return `${time.trim()}:00`
        return null
    }
    let hours = parseInt(match[1])
    const minutes = match[2]
    const period = match[3].toUpperCase()
    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0
    return `${String(hours).padStart(2, '0')}:${minutes}:00`
}

// POST /api/v1/reservations - Public table booking
export async function POST(request: NextRequest) {
    try {
        const clientIp = getClientIp(request)
        const rate = await checkRateLimitPersistent(`reservations:${clientIp}`, { maxRequests: 8, windowMs: 15 * 60 * 1000 })
        if (!rate.allowed) {
            return NextResponse.json(
                { error: 'Too many reservation attempts. Please try again later.' },
                { status: 429, headers: corsHeaders }
            )
        }

        const body = await request.json()
        const {
            restaurant_slug,
            customer_name,
            customer_phone,
            customer_email,
            party_size,
            date,
            time,
            special_requests,
            seating_preference,
        } = body

        if (!restaurant_slug) {
            return NextResponse.json({ error: 'restaurant_slug is required' }, { status: 400, headers: corsHeaders })
        }

        if (!customer_name || typeof customer_name !== 'string' || !customer_name.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400, headers: corsHeaders })
        }

        if (!customer_phone || !/^[\d\s\-+()]{7,20}$/.test(customer_phone)) {
            return NextResponse.json({ error: 'A valid phone number is required' }, { status: 400, headers: corsHeaders })
        }

        if (customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400, headers: corsHeaders })
        }

        const partySize = parseInt(party_size)
        if (!partySize || partySize < 1 || partySize > 50) {
            return NextResponse.json({ error: 'Invalid party size' }, { status: 400, headers: corsHeaders })
        }

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json({ error: 'A valid date is required' }, { status: 400, headers: corsHeaders })
        }

        const reservationTime = parseTimeTo24h(time || '')
        if (!reservationTime) {
            return NextResponse.json({ error: 'A valid time is required' }, { status: 400, headers: corsHeaders })
        }

        const supabase = createAdminClient()

        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('id, name, is_active')
            .eq('slug', restaurant_slug)
            .single()

        if (restaurantError || !restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404, headers: corsHeaders })
        }

        if (!restaurant.is_active) {
            return NextResponse.json({ error: 'This restaurant is not accepting reservations' }, { status: 503, headers: corsHeaders })
        }

        // Combine seating preference into special requests
        const notes = [
            seating_preference ? `Seating preference: ${String(seating_preference).slice(0, 100)}` : null,
            special_requests ? String(special_requests).slice(0, 500) : null,
        ].filter(Boolean).join('\n') || null

        const { data: reservation, error: insertError } = await supabase
            .from('reservations')
            .insert({
                restaurant_id: restaurant.id,
                customer_name: customer_name.trim().slice(0, 255),
                customer_phone: customer_phone.trim().slice(0, 50),
                customer_email: customer_email ? customer_email.trim().slice(0, 255) : null,
                party_size: partySize,
                reservation_date: date,
                reservation_time: reservationTime,
                status: 'pending',
                special_requests: notes,
            })
            .select('id, reservation_date, reservation_time, party_size, status')
            .single()

        if (insertError || !reservation) {
            console.error('[RESERVATIONS] Insert error:', insertError)
            return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500, headers: corsHeaders })
        }

        return NextResponse.json({
            success: true,
            reservation: {
                id: reservation.id,
                date: reservation.reservation_date,
                time: reservation.reservation_time,
                party_size: reservation.party_size,
                status: reservation.status,
            },
            restaurant_name: restaurant.name,
            message: 'Reservation request received. The restaurant will confirm shortly.',
        }, { status: 201, headers: corsHeaders })
    } catch (error) {
        console.error('[RESERVATIONS] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
    }
}
