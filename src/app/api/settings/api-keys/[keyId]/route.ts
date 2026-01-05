import { NextRequest, NextResponse } from 'next/server'
import { revokeApiKey } from '@/lib/api-keys'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// DELETE /api/settings/api-keys/[keyId] - Revoke an API key
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ keyId: string }> }
) {
    try {
        const { keyId } = await params

        if (!keyId) {
            return NextResponse.json(
                { success: false, error: 'Key ID is required' },
                { status: 400 }
            )
        }

        // Verify user is authenticated
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Get admin client for checking ownership
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { success: false, error: 'Server configuration error' },
                { status: 500 }
            )
        }

        const adminClient = createAdminClient(supabaseUrl, supabaseServiceKey)

        // Get the API key and verify ownership
        const { data: apiKey } = await adminClient
            .from('api_keys')
            .select('id, restaurant_id')
            .eq('id', keyId)
            .single()

        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: 'API key not found' },
                { status: 404 }
            )
        }

        // Check if user owns the restaurant
        const { data: restaurant } = await adminClient
            .from('restaurants')
            .select('id, owner_id')
            .eq('id', apiKey.restaurant_id)
            .single()

        if (!restaurant || restaurant.owner_id !== user.id) {
            return NextResponse.json(
                { success: false, error: 'Access denied' },
                { status: 403 }
            )
        }

        // Revoke the key
        const success = await revokeApiKey(keyId)

        if (!success) {
            return NextResponse.json(
                { success: false, error: 'Failed to revoke API key' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'API key revoked successfully',
        })

    } catch (error) {
        console.error('Revoke API key error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to revoke API key' },
            { status: 500 }
        )
    }
}
