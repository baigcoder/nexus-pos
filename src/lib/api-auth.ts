import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@/types'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { STAFF_SESSION_COOKIE, verifyStaffSessionToken } from '@/lib/auth/staff-session'

export interface ApiAuthContext {
    staffId: string
    role: UserRole
    restaurantId: string
    email: string
}

export async function getAuthenticatedStaff(request: NextRequest): Promise<ApiAuthContext | null> {
    try {
        // Try cookie-based auth (owner login via Supabase session cookies)
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
            // Check if they have a staff record
            const { data: staff } = await supabase
                .from('staff')
                .select('id, role, restaurant_id, email')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle()

            if (staff) {
                return { staffId: staff.id, role: staff.role as UserRole, restaurantId: staff.restaurant_id, email: staff.email || user.email || '' }
            }

            // If no staff record but authenticated, check if they own a restaurant
            const { data: restaurant } = await supabase
                .from('restaurants')
                .select('id')
                .eq('owner_id', user.id)
                .maybeSingle()

            if (restaurant) {
                // Check if owner has a staff record
                const adminClient = createAdminClient()
                const { data: ownerStaff } = await adminClient
                    .from('staff')
                    .select('id, role, restaurant_id, email')
                    .eq('user_id', user.id)
                    .maybeSingle()

                // If staff record exists, use it
                if (ownerStaff) {
                    return { staffId: ownerStaff.id, role: ownerStaff.role as UserRole, restaurantId: ownerStaff.restaurant_id, email: ownerStaff.email || '' }
                }

                // Create staff record for owner if it doesn't exist
                const { data: newStaff, error } = await adminClient
                    .from('staff')
                    .insert({
                        user_id: user.id,
                        restaurant_id: restaurant.id,
                        email: user.email || '',
                        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Owner',
                        role: 'owner',
                        is_active: true,
                    })
                    .select('id, role, restaurant_id, email')
                    .maybeSingle()

                if (newStaff && !error) {
                    return { staffId: newStaff.id, role: newStaff.role as UserRole, restaurantId: newStaff.restaurant_id, email: newStaff.email || '' }
                }

                // Fallback - should not happen
                return { staffId: user.id, role: 'owner' as UserRole, restaurantId: restaurant.id, email: user.email || '' }
            }
        }

        // Staff PIN/email login: signed httpOnly cookie set by the login routes
        const staffId = verifyStaffSessionToken(request.cookies.get(STAFF_SESSION_COOKIE)?.value)
        if (staffId) {
            const adminClient = createAdminClient()
            const { data: staff } = await adminClient
                .from('staff')
                .select('id, role, restaurant_id, email, is_active')
                .eq('id', staffId)
                .single()
            if (staff && staff.is_active) {
                return { staffId: staff.id, role: staff.role as UserRole, restaurantId: staff.restaurant_id, email: staff.email || '' }
            }
        }

        return null
    } catch {
        return null
    }
}

export function requireRole(allowedRoles: UserRole[]) {
    return async (request: NextRequest) => {
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return {
                auth: null as ApiAuthContext | null,
                response: NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 }),
            }
        }
        if (!allowedRoles.includes(auth.role)) {
            console.warn(`[RBAC] ${auth.role} ${auth.email} tried to access ${request.nextUrl.pathname} (requires ${allowedRoles.join('/')})`)
            return {
                auth,
                response: NextResponse.json(
                    { success: false, error: `Access denied. Required role: ${allowedRoles.join(' or ')}` },
                    { status: 403 }
                ),
            }
        }
        return { auth, response: null }
    }
}

export function requireOwner() {
    return requireRole(['owner'])
}

export function requireManagerOrOwner() {
    return requireRole(['owner', 'manager'])
}

export function requireStaff() {
    return requireRole(['owner', 'manager', 'waiter', 'kitchen', 'cashier', 'delivery', 'rider'])
}

export function requireKitchenStaff() {
    return requireRole(['owner', 'manager', 'kitchen'])
}

export function requireCashierOrAbove() {
    return requireRole(['owner', 'manager', 'cashier'])
}

export function requireWaiterOrAbove() {
    return requireRole(['owner', 'manager', 'waiter'])
}