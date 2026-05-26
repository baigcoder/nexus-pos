import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedStaff } from '@/lib/api-auth'

type RouteContext = {
    params: Promise<{ id: string }>
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        if (auth.role !== 'owner') {
            return NextResponse.json(
                { success: false, error: 'Only the owner can delete advertisement content' },
                { status: 403 }
            )
        }

        const { id } = await context.params
        if (!id) {
            return NextResponse.json({ success: false, error: 'Advertisement id is required' }, { status: 400 })
        }

        const { searchParams } = new URL(request.url)
        const restaurantId = searchParams.get('restaurantId')
        if (!restaurantId) {
            return NextResponse.json({ success: false, error: 'restaurantId is required' }, { status: 400 })
        }

        if (restaurantId !== auth.restaurantId) {
            return NextResponse.json(
                { success: false, error: 'Cannot delete advertisement content from another restaurant' },
                { status: 403 }
            )
        }

        const supabase = createAdminClient()

        const { data: adContent, error: fetchError } = await supabase
            .from('ad_content')
            .select('id, restaurant_id, title')
            .eq('id', id)
            .eq('restaurant_id', restaurantId)
            .maybeSingle()

        if (fetchError) {
            console.error('Ad content lookup error:', fetchError)
            return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
        }

        if (!adContent) {
            return NextResponse.json({ success: false, error: 'Advertisement content not found' }, { status: 404 })
        }

        const { error: deleteError } = await supabase
            .from('ad_content')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId)

        if (deleteError) {
            console.error('Ad content delete error:', deleteError)
            return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, deletedId: id })
    } catch (error: unknown) {
        console.error('Ad content DELETE error:', error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to delete advertisement content' },
            { status: 500 }
        )
    }
}
