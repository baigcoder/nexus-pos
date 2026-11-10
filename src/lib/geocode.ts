export interface GeocodeResult {
    lat: number
    lng: number
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
    const apiKey = process.env.GOOGLE_MAPS_GEOCODING_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey || !address.trim()) return null

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', address)
    url.searchParams.set('key', apiKey)

    const response = await fetch(url.toString())
    if (!response.ok) return null

    const data = await response.json() as {
        status: string
        results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>
    }

    const location = data.results?.[0]?.geometry?.location
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
        return null
    }

    return { lat: location.lat, lng: location.lng }
}
