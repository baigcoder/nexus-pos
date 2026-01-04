import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const body = await request.json()
        const {
            owner_id,
            user_email,
            name,
            slug,
            address,
            phone,
            email,
            currency,
            tax_rate,
            operating_hours
        } = body

        if (!name || !slug) {
            return NextResponse.json(
                { error: 'Missing restaurant name or slug' },
                { status: 400 }
            )
        }

        let finalOwnerId = owner_id
        const lookupEmail = user_email || email

        // If owner_id provided, verify it exists first
        if (owner_id) {
            const { data: userData, error: userError } = await supabase.auth.admin.getUserById(owner_id)
            if (!userError && userData?.user) {
                finalOwnerId = userData.user.id
                console.log('Verified owner_id:', finalOwnerId)
            } else {
                console.log('owner_id invalid, will try email lookup')
                finalOwnerId = null
            }
        }

        // If no valid owner_id, look up by email using admin API
        if (!finalOwnerId && lookupEmail) {
            console.log('Looking up user by email:', lookupEmail)

            // Use listUsers with pagination to find the user
            let page = 1
            let found = false

            while (!found && page <= 10) { // Max 10 pages to avoid infinite loop
                const { data, error } = await supabase.auth.admin.listUsers({
                    page: page,
                    perPage: 50
                })

                if (error) {
                    console.error('listUsers error:', error)
                    break
                }

                const user = data?.users?.find(u => u.email === lookupEmail)
                if (user) {
                    finalOwnerId = user.id
                    console.log('Found user:', finalOwnerId)
                    found = true
                } else if (!data?.users || data.users.length < 50) {
                    break // No more pages
                }

                page++
            }
        }

        if (!finalOwnerId) {
            return NextResponse.json(
                { error: `User not found. Please log in at /login first, then return to /setup.` },
                { status: 400 }
            )
        }

        // Create the restaurant
        const { data: restaurant, error: createError } = await supabase
            .from('restaurants')
            .insert({
                owner_id: finalOwnerId,
                name,
                slug,
                address: address || '',
                phone: phone || '',
                email: email || lookupEmail || '',
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

    } catch (error: any) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: error?.message || 'Server error' },
            { status: 500 }
        )
    }
}
