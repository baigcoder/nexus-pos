import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey, getCorsHeaders } from '@/lib/api-keys'

// Default CORS headers for backward compatibility
const defaultCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Restaurant-ID',
}

// Handle preflight
export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get('origin')
    const apiKey = request.headers.get('x-api-key')

    // If API key provided, validate and get CORS settings
    if (apiKey) {
        const validation = await validateApiKey(apiKey, origin)
        if (validation.valid && validation.allowedOrigins) {
            return NextResponse.json({}, {
                headers: getCorsHeaders(origin, validation.allowedOrigins)
            })
        }
    }

    return NextResponse.json({}, { headers: defaultCorsHeaders })
}

// GET /api/v1/menu?restaurant=slug
export async function GET(request: NextRequest) {
    const origin = request.headers.get('origin')
    const apiKey = request.headers.get('x-api-key')

    try {
        const { searchParams } = new URL(request.url)
        const restaurantSlug = searchParams.get('restaurant')
        const restaurantId = request.headers.get('X-Restaurant-ID')

        if (!restaurantSlug && !restaurantId) {
            return NextResponse.json(
                { error: 'Missing restaurant parameter or X-Restaurant-ID header' },
                { status: 400, headers: defaultCorsHeaders }
            )
        }

        // Determine CORS headers based on API key
        let corsHeaders: Record<string, string> = defaultCorsHeaders
        if (apiKey) {
            const validation = await validateApiKey(apiKey, origin)

            if (!validation.valid) {
                return NextResponse.json(
                    { error: validation.error || 'Invalid API key' },
                    { status: 401, headers: defaultCorsHeaders }
                )
            }

            // Check permission
            if (!validation.permissions?.includes('menu:read')) {
                return NextResponse.json(
                    { error: 'API key does not have permission to read menu' },
                    { status: 403, headers: defaultCorsHeaders }
                )
            }

            corsHeaders = getCorsHeaders(origin, validation.allowedOrigins || [])
        }

        const supabase = await createClient()

        // Get restaurant
        let restaurantQuery = supabase.from('restaurants').select('*')
        if (restaurantSlug) {
            restaurantQuery = restaurantQuery.eq('slug', restaurantSlug)
        } else {
            restaurantQuery = restaurantQuery.eq('id', restaurantId)
        }

        const { data: restaurant, error: restaurantError } = await restaurantQuery.single()

        if (restaurantError || !restaurant) {
            return NextResponse.json(
                { error: 'Restaurant not found' },
                { status: 404, headers: corsHeaders }
            )
        }

        // Check if restaurant is active
        if (!restaurant.is_active) {
            return NextResponse.json(
                { error: 'Restaurant is currently unavailable' },
                { status: 503, headers: corsHeaders }
            )
        }

        // Get categories
        const { data: categories } = await supabase
            .from('categories')
            .select('id, name, description, image_url, display_order')
            .eq('restaurant_id', restaurant.id)
            .eq('is_active', true)
            .order('display_order')

        // Get menu items
        const { data: items } = await supabase
            .from('menu_items')
            .select('id, category_id, name, description, price, image_url, dietary_tags, is_available, is_special, preparation_time')
            .eq('restaurant_id', restaurant.id)
            .eq('is_available', true)
            .order('display_order')

        // Get daily specials if any
        const today = new Date().toISOString().split('T')[0]
        const { data: dailySpecials } = await supabase
            .from('daily_specials')
            .select('menu_item_id, discount_percentage')
            .eq('restaurant_id', restaurant.id)
            .eq('special_date', today)
            .eq('is_active', true)

        // Apply daily special discounts to items
        const specialsMap = new Map(
            dailySpecials?.map(s => [s.menu_item_id, s.discount_percentage]) || []
        )

        const itemsWithSpecials = items?.map(item => ({
            ...item,
            has_special: specialsMap.has(item.id),
            special_discount: specialsMap.get(item.id) || 0,
            special_price: specialsMap.has(item.id)
                ? Math.round(item.price * (1 - (specialsMap.get(item.id) || 0) / 100))
                : null,
        })) || []

        // Calculate category item counts
        const categoriesWithCounts = categories?.map(cat => ({
            ...cat,
            item_count: itemsWithSpecials.filter(item => item.category_id === cat.id).length,
        })) || []

        return NextResponse.json({
            success: true,
            restaurant: {
                id: restaurant.id,
                name: restaurant.name,
                slug: restaurant.slug,
                logo_url: restaurant.logo_url,
                address: restaurant.address,
                phone: restaurant.phone,
                currency: restaurant.currency,
                tax_rate: restaurant.tax_rate,
                operating_hours: restaurant.operating_hours,
            },
            categories: categoriesWithCounts,
            items: itemsWithSpecials,
            meta: {
                total_categories: categoriesWithCounts.length,
                total_items: itemsWithSpecials.length,
                available_items: itemsWithSpecials.filter(i => i.is_available).length,
                specials_today: dailySpecials?.length || 0,
            }
        }, { headers: corsHeaders })

    } catch (error) {
        console.error('Menu API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers: defaultCorsHeaders }
        )
    }
}
