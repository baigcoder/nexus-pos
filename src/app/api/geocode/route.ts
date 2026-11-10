import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedStaff } from '@/lib/api-auth'
import { geocodeAddress } from '@/lib/geocode'
import { checkRateLimitPersistent } from '@/lib/auth'

export async function GET(request: NextRequest) {
    const auth = await getAuthenticatedStaff(request)
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['owner', 'manager', 'cashier'].includes(auth.role)) {
        return NextResponse.json({ error: 'Geocoding access denied' }, { status: 403 })
    }

    const address = request.nextUrl.searchParams.get('address')?.trim()
    if (!address || address.length > 300) {
        return NextResponse.json({ error: 'A valid address is required' }, { status: 400 })
    }

    const rate = await checkRateLimitPersistent(`geocode:${auth.restaurantId}:${auth.staffId}`, {
        maxRequests: 60,
        windowMs: 60_000,
    })
    if (!rate.allowed) {
        return NextResponse.json({ error: 'Too many geocoding requests' }, { status: 429 })
    }

    const result = await geocodeAddress(address)
    if (!result) {
        return NextResponse.json({ error: 'Unable to geocode address' }, { status: 404 })
    }

    return NextResponse.json({ success: true, ...result })
}
