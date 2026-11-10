import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@/types'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readStaffSession } from '@/lib/staff-session'

export interface ApiAuthContext {
    staffId: string
    role: UserRole
    restaurantId: string
    email: string
}

async function staffContextFromRow(staff: {
    id: string
    role: string
    restaurant_id: string
    email?: string | null
}, fallbackEmail = ''): Promise<ApiAuthContext> {
    return {
        staffId: staff.id,
        role: staff.role as UserRole,
        restaurantId: staff.restaurant_id,
        email: staff.email || fallbackEmail,
    }
}

export async function getAuthenticatedStaff(request: NextRequest): Promise<ApiAuthContext | null> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
            const { data: staff } = await supabase
                .from('staff')
                .select('id, role, restaurant_id, email')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle()

            if (staff) {
                return staffContextFromRow(staff, user.email || '')
            }

            const { data: restaurant } = await supabase
                .from('restaurants')
                .select('id')
                .eq('owner_id', user.id)
                .maybeSingle()

            if (restaurant) {
                const adminClient = createAdminClient()
                const { data: ownerStaff } = await adminClient
                    .from('staff')
                    .select('id, role, restaurant_id, email, is_active')
                    .eq('user_id', user.id)
                    .eq('restaurant_id', restaurant.id)
                    .eq('role', 'owner')
                    .maybeSingle()

                if (ownerStaff) {
                    return ownerStaff.is_active ? staffContextFromRow(ownerStaff, user.email || '') : null
                }

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
                    return staffContextFromRow(newStaff, user.email || '')
                }

                // A failed provisioning attempt cannot stand in for an active staff identity.
                return null
            }
        }

        const session = await readStaffSession(request)
        if (!session) return null

        const adminClient = createAdminClient()
        const { data: staff } = await adminClient
            .from('staff')
            .select('id, role, restaurant_id, email, is_active')
            .eq('id', session.staffId)
            .eq('restaurant_id', session.restaurantId)
            .maybeSingle()

        if (!staff || !staff.is_active) return null

        return staffContextFromRow(staff)
    } catch {
        return null
    }
}

export function assertSameRestaurant(auth: ApiAuthContext, restaurantId: string | null | undefined): boolean {
    if (!restaurantId) return false
    return auth.restaurantId === restaurantId
}

export function tenantMismatchResponse() {
    return NextResponse.json({ success: false, error: 'Access denied for this restaurant' }, { status: 403 })
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
