import { NextRequest, NextResponse } from 'next/server'
import { generateApiKey, listApiKeys, revokeApiKey } from '@/lib/api-keys'
import { createClient } from '@/lib/supabase/server'

// GET /api/settings/api-keys - List API keys for a restaurant
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const restaurantId = searchParams.get('restaurant_id')

        if (!restaurantId) {
            return NextResponse.json(
                { success: false, error: 'restaurant_id is required' },
                { status: 400 }
            )
        }

        // Verify user has access to this restaurant
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Check if user owns this restaurant
        const { data: restaurant } = await supabase
            .from('restaurants')
            .select('id, owner_id')
            .eq('id', restaurantId)
            .single()

        if (!restaurant || restaurant.owner_id !== user.id) {
            return NextResponse.json(
                { success: false, error: 'Access denied' },
                { status: 403 }
            )
        }

        const keys = await listApiKeys(restaurantId)

        return NextResponse.json({
            success: true,
            keys,
        })

    } catch (error) {
        console.error('List API keys error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to list API keys' },
            { status: 500 }
        )
    }
}

// POST /api/settings/api-keys - Create a new API key
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            restaurant_id,
            name,
            is_live = true,
            permissions = ['menu:read', 'orders:create'],
            allowed_origins = [],
            rate_limit_per_minute = 60,
            expires_in_days
        } = body

        if (!restaurant_id || !name) {
            return NextResponse.json(
                { success: false, error: 'restaurant_id and name are required' },
                { status: 400 }
            )
        }

        // Verify user has access to this restaurant
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Check if user owns this restaurant
        const { data: restaurant } = await supabase
            .from('restaurants')
            .select('id, owner_id')
            .eq('id', restaurant_id)
            .single()

        if (!restaurant || restaurant.owner_id !== user.id) {
            return NextResponse.json(
                { success: false, error: 'Access denied' },
                { status: 403 }
            )
        }

        // Calculate expiration if provided
        let expiresAt: Date | undefined
        if (expires_in_days && expires_in_days > 0) {
            expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + expires_in_days)
        }

        // Validate permissions
        const validPermissions = ['menu:read', 'orders:create', 'orders:read']
        const filteredPermissions = permissions.filter((p: string) => validPermissions.includes(p))

        const result = await generateApiKey(restaurant_id, name, {
            isLive: is_live,
            permissions: filteredPermissions,
            allowedOrigins: allowed_origins,
            rateLimitPerMinute: rate_limit_per_minute,
            expiresAt,
        })

        return NextResponse.json({
            success: true,
            key: result.key,
            keyId: result.keyId,
            message: 'API key created. Store it securely - you won\'t be able to see it again!',
        }, { status: 201 })

    } catch (error) {
        console.error('Create API key error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to create API key' },
            { status: 500 }
        )
    }
}
