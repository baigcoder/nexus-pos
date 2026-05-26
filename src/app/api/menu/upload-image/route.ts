import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwner, requireManagerOrOwner } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
    try {
        const { auth, response } = await requireManagerOrOwner()(request)
        if (response) return response
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const type = (formData.get('type') as string) || 'menu-items'

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
        if (!validTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type. Supported: SVG, PNG, JPEG, WebP, GIF' }, { status: 400 })
        }

        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File size must be under 5MB' }, { status: 400 })
        }

        const fileExt = file.name.split('.').pop() || 'png'
        const fileName = `${type}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

        const supabase = createAdminClient()

        const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(fileName, file, { cacheControl: '3600', upsert: true })

        if (uploadError) {
            console.error('Menu image upload error:', uploadError)
            return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
        }

        const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName)

        return NextResponse.json({ success: true, url: urlData.publicUrl })
    } catch (error: unknown) {
        console.error('Menu image upload API error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to upload image' },
            { status: 500 }
        )
    }
}