import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwner, requireManagerOrOwner } from '@/lib/api-auth'

function getAdminClient() {
    return createAdminClient()
}

function isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
}

export async function PUT(request: NextRequest) {
    try {
        const { auth, response } = await requireOwner()(request)
        if (response) return response

        const body = await request.json()
        const {
            restaurantId,
            name,
            address,
            phone,
            email,
            currency,
            taxRate,
            serviceCharge,
            serviceChargeType,
            taxMode,
            priceRounding,
            operatingHours,
            settings
        } = body

        if (!restaurantId) {
            return NextResponse.json({ error: 'Restaurant ID is required' }, { status: 400 })
        }

        if (!isValidUUID(restaurantId)) {
            return NextResponse.json({ error: 'Invalid restaurant ID format' }, { status: 400 })
        }

        const supabase = getAdminClient()

        // Fetch existing restaurant to merge settings
        const { data: existing, error: fetchError } = await supabase
            .from('restaurants')
            .select('id, owner_id, settings, operating_hours')
            .eq('id', restaurantId)
            .single()

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
        }

        const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString()
        }

        // Top-level columns
        if (name !== undefined) {
            if (!name.trim()) {
                return NextResponse.json({ error: 'Restaurant name cannot be empty' }, { status: 400 })
            }
            updates.name = name.trim()
        }

        if (address !== undefined) {
            updates.address = address?.trim() || null
        }

        if (phone !== undefined) {
            updates.phone = phone?.trim() || null
        }

        if (email !== undefined) {
            updates.email = email?.trim() || null
        }

        if (currency !== undefined) {
            updates.currency = currency
        }

        if (taxRate !== undefined) {
            const tax = parseFloat(taxRate)
            if (isNaN(tax) || tax < 0 || tax > 100) {
                return NextResponse.json({ error: 'Tax rate must be between 0 and 100' }, { status: 400 })
            }
            updates.tax_rate = tax
        }

        // Operating hours - top-level column
        if (operatingHours !== undefined) {
            updates.operating_hours = operatingHours
        }

        // JSONB settings merge
        const existingSettings = (existing.settings as Record<string, unknown>) || {}
        const settingsUpdate: Record<string, unknown> = { ...existingSettings }

        if (serviceCharge !== undefined) {
            const charge = parseFloat(serviceCharge)
            if (isNaN(charge) || charge < 0 || charge > 100) {
                return NextResponse.json({ error: 'Service charge must be between 0 and 100' }, { status: 400 })
            }
            settingsUpdate.service_charge = charge
        }

        if (serviceChargeType !== undefined) {
            if (!['percentage', 'fixed'].includes(serviceChargeType)) {
                return NextResponse.json({ error: 'Invalid service charge type' }, { status: 400 })
            }
            settingsUpdate.service_charge_type = serviceChargeType
        }

        if (taxMode !== undefined) {
            if (!['inclusive', 'exclusive'].includes(taxMode)) {
                return NextResponse.json({ error: 'Invalid tax mode' }, { status: 400 })
            }
            settingsUpdate.tax_mode = taxMode
        }

        if (priceRounding !== undefined) {
            if (!['none', 'up', 'down', 'nearest'].includes(priceRounding)) {
                return NextResponse.json({ error: 'Invalid price rounding option' }, { status: 400 })
            }
            settingsUpdate.price_rounding = priceRounding
        }

        // Merge any additional settings passed directly
        if (settings !== undefined && typeof settings === 'object') {
            Object.assign(settingsUpdate, settings)
        }

        updates.settings = settingsUpdate

        const { data: updated, error: updateError } = await supabase
            .from('restaurants')
            .update(updates)
            .eq('id', restaurantId)
            .select()
            .single()

        if (updateError) {
            console.error('Restaurant update error:', updateError)
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            restaurant: updated
        })

    } catch (error: unknown) {
        console.error('Restaurant update API error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update restaurant' },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    try {
        const { auth, response } = await requireManagerOrOwner()(request)
        if (response) return response

        const { searchParams } = new URL(request.url)
        const restaurantId = searchParams.get('restaurantId')

        if (!restaurantId) {
            return NextResponse.json({ error: 'Restaurant ID is required' }, { status: 400 })
        }

        if (!isValidUUID(restaurantId)) {
            return NextResponse.json({ error: 'Invalid restaurant ID format' }, { status: 400 })
        }

        const supabase = getAdminClient()

        const { data: restaurant, error } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', restaurantId)
            .single()

        if (error) {
            console.error('Restaurant fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, restaurant })

    } catch (error: unknown) {
        console.error('Restaurant fetch API error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch restaurant' },
            { status: 500 }
        )
    }
}

// PATCH for danger zone actions (activate/deactivate)
export async function PATCH(request: NextRequest) {
    try {
        const { auth, response } = await requireOwner()(request)
        if (response) return response

        const body = await request.json()
        const { restaurantId, action } = body

        if (!restaurantId) {
            return NextResponse.json({ error: 'Restaurant ID is required' }, { status: 400 })
        }

        if (!isValidUUID(restaurantId)) {
            return NextResponse.json({ error: 'Invalid restaurant ID format' }, { status: 400 })
        }

        const supabase = getAdminClient()

        if (action === 'deactivate') {
            const { data, error } = await supabase
                .from('restaurants')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', restaurantId)
                .select()
                .single()

            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json({ success: true, restaurant: data })
        }

        if (action === 'reactivate') {
            const { data, error } = await supabase
                .from('restaurants')
                .update({ is_active: true, updated_at: new Date().toISOString() })
                .eq('id', restaurantId)
                .select()
                .single()

            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json({ success: true, restaurant: data })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (error: unknown) {
        console.error('Restaurant action API error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to perform action' },
            { status: 500 }
        )
    }
}