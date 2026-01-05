import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Role-based route access configuration
const ROLE_ROUTES: Record<string, string[]> = {
    owner: ['*'], // Full access
    manager: ['*'], // Full access
    waiter: ['/dashboard', '/dashboard/orders', '/dashboard/tables', '/waiter'],
    kitchen: ['/dashboard', '/dashboard/kitchen'],
    cashier: ['/dashboard', '/dashboard/billing', '/dashboard/orders'],
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // If Supabase is not configured, skip auth checks (dev mode)
    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('⚠️ Supabase not configured. Running in development mode without auth.')
        return supabaseResponse
    }

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    // Define public routes that don't require authentication
    const publicRoutes = ['/', '/login', '/register', '/menu', '/auth/callback', '/demo', '/verify-otp', '/forgot-password', '/staff-login', '/staff-setup', '/screen-login']
    const isPublicRoute = publicRoutes.some(route =>
        pathname === route ||
        pathname.startsWith('/menu/') ||
        pathname.startsWith('/track/') ||
        pathname.startsWith('/order/') ||
        pathname.startsWith('/api/') ||  // All API routes are public (they handle their own auth)
        pathname.startsWith('/display/')  // Public display pages
    )

    // Staff-only routes (PIN-based auth, check is handled by client-side store)
    // All dashboard routes are accessible - client-side auth will verify
    const staffPinRoutes = [
        '/dashboard/kitchen',
        '/dashboard/orders',
        '/dashboard/billing',
        '/dashboard/waiter',
        '/dashboard/tables',
        '/dashboard/menu',
        '/dashboard/take-order',
        '/dashboard/my-orders',
        '/dashboard/kitchen-view',
        '/dashboard/my-shift',
        '/dashboard/tips',
        '/dashboard/cashier',
        '/dashboard/riders',
        '/dashboard/deliveries',
        '/dashboard/delivery-boy',
        '/dashboard/delivery-monitor',
    ]

    if (!user && !isPublicRoute) {
        // Allow ALL dashboard routes to be accessed - staff uses PIN-based auth stored client-side
        // Full verification happens in the client-side auth store
        const isStaffRoute = pathname.startsWith('/dashboard')

        // For staff routes, we check client-side auth (PIN-based), so let middleware pass
        // The client-side check will redirect if needed
        if (!isStaffRoute) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }
    }

    // Role-based route protection for authenticated users
    if (user) {
        // Fetch user's staff record to determine role
        const { data: restaurant } = await supabase
            .from('restaurants')
            .select('id')
            .eq('owner_id', user.id)
            .single()

        if (restaurant) {
            // User is an owner - full access
            // No restrictions needed
        } else {
            // User might be a staff member linked to auth.users
            const { data: staff } = await supabase
                .from('staff')
                .select('role')
                .eq('user_id', user.id)
                .single()

            if (staff) {
                const role = staff.role as string
                const allowedRoutes = ROLE_ROUTES[role] || []

                // Check if current path is allowed for this role
                if (!allowedRoutes.includes('*')) {
                    const isDashboardRoute = pathname.startsWith('/dashboard')
                    if (isDashboardRoute) {
                        const isAllowed = allowedRoutes.some(route =>
                            pathname === route || pathname.startsWith(route + '/')
                        )

                        if (!isAllowed) {
                            // Redirect to role-appropriate default page
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

function getDefaultRouteForRole(role: string): string {
    switch (role) {
        case 'kitchen':
            return '/dashboard/kitchen'
        case 'waiter':
            return '/dashboard/orders'
        case 'cashier':
            return '/dashboard/billing'
        default:
            return '/dashboard'
    }
}
