import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwner } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
    try {
        const { auth, response } = await requireOwner()(request)
        if (response) return response

        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const restaurantId = formData.get('restaurantId') as string | null

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        if (!restaurantId) {
            return NextResponse.json({ error: 'Restaurant ID is required' }, { status: 400 })
        }

        const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']
        if (!validTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type. Supported: SVG, PNG, JPEG, WebP' }, { status: 400 })
        }

        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json({ error: 'File size must be under 2MB' }, { status: 400 })
        }

        const fileExt = file.name.split('.').pop() || 'png'
        const filePath = `logos/${restaurantId}/${Date.now()}.${fileExt}`

        const supabase = createAdminClient()

        const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true,
            })

        if (uploadError) {
            console.error('Logo upload error:', uploadError)
            return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 })
        }

        const { data: urlData } = supabase.storage
            .from('media')
            .getPublicUrl(filePath)

        const logoUrl = urlData.publicUrl

        const { data: updated, error: updateError } = await supabase
            .from('restaurants')
            .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
            .eq('id', restaurantId)
            .select()
            .single()

        if (updateError) {
            console.error('Logo URL update error:', updateError)
            return NextResponse.json({ error: 'Failed to update logo URL' }, { status: 500 })
        }

        return NextResponse.json({ success: true, logoUrl, restaurant: updated })
    } catch (error: unknown) {
        console.error('Logo upload API error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to upload logo' },
            { status: 500 }
        )
    }
}