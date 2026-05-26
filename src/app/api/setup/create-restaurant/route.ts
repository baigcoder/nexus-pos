import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function generateSlug(name: string) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
}

async function getAvailableSlug(supabase: ReturnType<typeof createAdminClient>, baseSlug: string) {
    let slug = baseSlug
    let suffix = 2

    while (suffix < 100) {
        const { data } = await supabase
            .from('restaurants')
            .select('id')
            .eq('slug', slug)
            .maybeSingle()

        if (!data) return slug

        slug = `${baseSlug}-${suffix}`
        suffix++
    }

    throw new Error('Could not generate a unique restaurant slug')
}

export async function POST(request: NextRequest) {
    try {
        const sessionClient = await createClient()
        const { data: { user }, error: userError } = await sessionClient.auth.getUser()

        if (userError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized. Please log in before creating a restaurant.' },
                { status: 401 }
            )
        }

        const supabase = createAdminClient()

        const body = await request.json()
        const {
            name,
            slug,
            address,
            phone,
            email,
            currency,
            tax_rate,
            operating_hours
        } = body

        if (!name) {
            return NextResponse.json(
                { error: 'Restaurant name is required' },
                { status: 400 }
            )
        }

        const { data: existingRestaurant } = await supabase
            .from('restaurants')
            .select('id, name, slug')
            .eq('owner_id', user.id)
            .maybeSingle()

        if (existingRestaurant) {
            return NextResponse.json(
                { error: 'This account already has a restaurant.', restaurant: existingRestaurant },
                { status: 409 }
            )
        }

        const baseSlug = generateSlug(slug || name)
        if (!baseSlug) {
            return NextResponse.json(
                { error: 'Restaurant name must contain letters or numbers' },
                { status: 400 }
            )
        }
        const finalSlug = await getAvailableSlug(supabase, baseSlug)

        // Create the restaurant
        const { data: restaurant, error: createError } = await supabase
            .from('restaurants')
            .insert({
                owner_id: user.id,
                name: name.trim(),
                slug: finalSlug,
                address: address || '',
                phone: phone || '',
                email: email || user.email || '',
                currency: currency || 'PKR',
                tax_rate: tax_rate || 16,
                operating_hours: operating_hours || {},
                is_active: true,
            })
            .select()
            .single()

        if (createError) {
            console.error('Insert error:', createError)
            return NextResponse.json(
                { error: `Database error: ${createError.message}` },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true, restaurant })

    } catch (error: unknown) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Server error' },
            { status: 500 }
        )
    }
}
