import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

/**
 * Admin-only endpoint to migrate plain-text PINs to bcrypt hashes
 * This should be run once to upgrade legacy staff PINs
 * 
 * POST /api/auth/migrate-pins
 * Body: { confirm: true }
 * Header: X-Admin-Key (from env ADMIN_SECRET_KEY)
 */
export async function POST(request: NextRequest) {
    try {
        // Verify admin authorization
        const adminKey = request.headers.get('x-admin-key')
        const expectedKey = process.env.ADMIN_SECRET_KEY

        if (!expectedKey) {
            return NextResponse.json(
                { error: 'Migration not configured. Set ADMIN_SECRET_KEY in environment.' },
                { status: 500 }
            )
        }

        if (!adminKey || adminKey !== expectedKey) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const body = await request.json()
        if (!body.confirm) {
            return NextResponse.json(
                {
                    error: 'Confirmation required',
                    message: 'Send { "confirm": true } to proceed with migration',
                    warning: 'This will hash all plain-text PINs. Make sure you have a backup!'
                },
                { status: 400 }
            )
        }

        // Initialize Supabase with service role
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Get all staff with PINs
        const { data: staffList, error: fetchError } = await supabase
            .from('staff')
            .select('id, name, pin')
            .not('pin', 'is', null)

        if (fetchError) {
            return NextResponse.json(
                { error: `Failed to fetch staff: ${fetchError.message}` },
                { status: 500 }
            )
        }

        if (!staffList || staffList.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No staff members with PINs found',
                migrated: 0,
                skipped: 0,
            })
        }

        let migrated = 0
        let skipped = 0
        let errors: string[] = []

        for (const staff of staffList) {
            // Skip if already hashed (bcrypt hashes start with $2)
            if (staff.pin && staff.pin.startsWith('$2')) {
                skipped++
                continue
            }

            // Skip empty PINs
            if (!staff.pin || staff.pin.trim() === '') {
                skipped++
                continue
            }

            try {
                // Hash the plain-text PIN
                const hashedPin = await bcrypt.hash(staff.pin, 10)

                // Update the staff record
                const { error: updateError } = await supabase
                    .from('staff')
                    .update({ pin: hashedPin })
                    .eq('id', staff.id)

                if (updateError) {
                    errors.push(`Staff ${staff.name} (${staff.id}): ${updateError.message}`)
                } else {
                    migrated++
                }
            } catch (hashError) {
                errors.push(`Staff ${staff.name} (${staff.id}): Failed to hash PIN`)
            }
        }

        // Log the migration
        console.log(`PIN Migration completed: ${migrated} migrated, ${skipped} skipped, ${errors.length} errors`)

        return NextResponse.json({
            success: true,
            message: 'PIN migration completed',
            summary: {
                total: staffList.length,
                migrated,
                skipped,
                errors: errors.length,
            },
            errorDetails: errors.length > 0 ? errors : undefined,
        })

    } catch (error) {
        console.error('PIN migration error:', error)
        return NextResponse.json(
            { error: 'Migration failed' },
            { status: 500 }
        )
    }
}

/**
 * GET to check migration status (read-only)
 */
export async function GET(request: NextRequest) {
    try {
        // Verify admin authorization
        const adminKey = request.headers.get('x-admin-key')
        const expectedKey = process.env.ADMIN_SECRET_KEY

        if (!expectedKey || !adminKey || adminKey !== expectedKey) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Get PIN statistics
        const { data: staffList } = await supabase
            .from('staff')
            .select('id, pin')
            .not('pin', 'is', null)

        if (!staffList) {
            return NextResponse.json({
                total: 0,
                hashed: 0,
                plaintext: 0,
                needsMigration: false,
            })
        }

        const hashed = staffList.filter(s => s.pin?.startsWith('$2')).length
        const plaintext = staffList.filter(s => s.pin && !s.pin.startsWith('$2')).length

        return NextResponse.json({
            total: staffList.length,
            hashed,
            plaintext,
            needsMigration: plaintext > 0,
            message: plaintext > 0
                ? `${plaintext} staff members have plain-text PINs that need migration`
                : 'All PINs are properly hashed',
        })

    } catch (error) {
        console.error('PIN status check error:', error)
        return NextResponse.json(
            { error: 'Status check failed' },
            { status: 500 }
        )
    }
}
