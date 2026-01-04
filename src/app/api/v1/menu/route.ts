import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// CORS headers for external access
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Restaurant-ID',
}

// Handle preflight
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders })
}

// GET /api/v1/menu?restaurant=slug
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const restaurantSlug = searchParams.get('restaurant')
        const restaurantId = request.headers.get('X-Restaurant-ID')

        if (!restaurantSlug && !restaurantId) {
            return NextResponse.json(
                { error: 'Missing restaurant parameter or X-Restaurant-ID header' },
                { status: 400, headers: corsHeaders }
            )
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
            .select('id, category_id, name, description, price, image_url, dietary_tags, is_available, preparation_time')
            .eq('restaurant_id', restaurant.id)
            .eq('is_available', true)
            .order('display_order')

        return NextResponse.json({
            success: true,
            restaurant: {
                id: restaurant.id,
                name: restaurant.name,
                slug: restaurant.slug,
                logo_url: restaurant.logo_url,
                currency: restaurant.currency,
                tax_rate: restaurant.tax_rate,
            },
            categories: categories || [],
            items: items || [],
        }, { headers: corsHeaders })

    } catch (error) {
        console.error('Menu API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders }
        )
    }
}
