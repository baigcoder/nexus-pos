import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicKey, getSupabaseUrl } from './config'

const ROLE_ROUTES: Record<string, string[]> = {
    owner: ['*'],
    manager: ['*'],
    waiter: ['/dashboard', '/dashboard/orders', '/dashboard/tables', '/dashboard/menu', '/waiter', '/dashboard/my-orders', '/dashboard/take-order', '/dashboard/kitchen-view'],
    kitchen: ['/dashboard', '/dashboard/kitchen', '/dashboard/kitchen-view', '/dashboard/my-orders', '/dashboard/orders'],
    cashier: ['/dashboard', '/dashboard/billing', '/dashboard/orders', '/dashboard/tables', '/dashboard/menu', '/dashboard/cashier'],
    delivery: ['/dashboard', '/dashboard/deliveries', '/dashboard/delivery-boy', '/dashboard/delivery-monitor', '/dashboard/orders', '/dashboard/my-shift', '/dashboard/tips'],
}

const PUBLIC_ROUTES = [
    '/', '/login', '/register', '/menu', '/auth/callback', '/demo',
    '/verify-otp', '/forgot-password', '/staff-login', '/staff-setup', '/screen-login',
]

const PUBLIC_PREFIXES = ['/menu/', '/track/', '/order/', '/api/', '/display/']

function isPublicRoute(pathname: string): boolean {
    if (PUBLIC_ROUTES.includes(pathname)) return true
    return PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

function getDefaultRouteForRole(role: string): string {
    switch (role) {
        case 'kitchen': return '/dashboard/kitchen-view'
        case 'waiter': return '/dashboard/orders'
        case 'cashier': return '/dashboard/billing'
        case 'delivery': return '/dashboard/delivery-boy'
        default: return '/dashboard'
    }
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabaseUrl = getSupabaseUrl()
    const supabaseAnonKey = getSupabasePublicKey()

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('[AUTH_MIDDLEWARE] Supabase not configured. Skipping auth checks.')
        return supabaseResponse
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                supabaseResponse = NextResponse.next({ request })
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options)
                )
            },
        },
    })

    const { data: { user } } = await supabase.auth.getUser()
    const pathname = request.nextUrl.pathname

    if (!user && !isPublicRoute(pathname)) {
        const isStaffRoute = pathname.startsWith('/dashboard') || pathname === '/staff-portal'

        if (!isStaffRoute) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.searchParams.set('redirect', pathname)
            return NextResponse.redirect(url)
        }
    }

    if (user) {
        const { data: restaurant } = await supabase
            .from('restaurants')
            .select('id')
            .eq('owner_id', user.id)
            .single()

        if (!restaurant) {
            const { data: staff } = await supabase
                .from('staff')
                .select('role')
                .eq('user_id', user.id)
                .single()

            if (staff) {
                const role = staff.role as string
                const allowedRoutes = ROLE_ROUTES[role] || []

                if (!allowedRoutes.includes('*')) {
                    const isDashboardRoute = pathname.startsWith('/dashboard')
                    if (isDashboardRoute) {
                        const isAllowed = allowedRoutes.some(route =>
                            pathname === route || pathname.startsWith(route + '/')
                        )

                        if (!isAllowed) {
                            const url = request.nextUrl.clone()
                            url.pathname = getDefaultRouteForRole(role)
                            return NextResponse.redirect(url)
                        }
                    }
                }
            }
        }
    }

    return supabaseResponse
}