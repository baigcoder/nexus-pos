import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Restaurant, Staff, AuthUser, UserRole } from '@/types'

type LoginMode = 'owner' | 'staff'

interface RestaurantWithOwner extends Restaurant {
    owner_name?: string
}

interface AuthState {
    user: AuthUser | null
    restaurant: RestaurantWithOwner | null
    staff: Staff | null
    userRole: UserRole | null
    loginMode: LoginMode
    isLoading: boolean
    isAuthenticated: boolean
    pendingOtpEmail: string | null
    sessionExpiry: number | null
    lastActivity: number | null
    isHydrated: boolean

    setUser: (user: AuthUser | null) => void
    setRestaurant: (restaurant: RestaurantWithOwner | null) => void
    setStaff: (staff: Staff | null) => void
    setUserRole: (role: UserRole | null) => void
    setLoginMode: (mode: LoginMode) => void
    setLoading: (loading: boolean) => void
    setPendingOtpEmail: (email: string | null) => void
    setHydrated: (hydrated: boolean) => void
    login: (user: AuthUser, restaurant?: RestaurantWithOwner, staff?: Staff, role?: UserRole) => void
    loginAsStaff: (staff: Staff, restaurant: RestaurantWithOwner) => void
    logout: () => void
    reset: () => void
    refreshSession: () => void
    isSessionValid: () => boolean
}

const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000
const ACTIVITY_REFRESH_MS = 30 * 60 * 1000

const initialState = {
    user: null as AuthUser | null,
    restaurant: null as RestaurantWithOwner | null,
    staff: null as Staff | null,
    userRole: null as UserRole | null,
    loginMode: 'owner' as LoginMode,
    isLoading: true,
    isAuthenticated: false,
    pendingOtpEmail: null as string | null,
    sessionExpiry: null as number | null,
    lastActivity: null as number | null,
    isHydrated: false,
}

export const defaultRestaurant: RestaurantWithOwner = {
    id: '',
    owner_id: '',
    name: '',
    slug: '',
    logo_url: null,
    address: null,
    phone: null,
    email: null,
    operating_hours: null,
    settings: null,
    currency: 'PKR',
    tax_rate: 16,
    is_active: true,
    created_at: '',
    updated_at: '',
    owner_name: 'Owner',
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            ...initialState,

            setUser: (user) => set({
                user,
                isAuthenticated: !!user,
                isLoading: false,
                lastActivity: Date.now(),
            }),

            setRestaurant: (restaurant) => set({ restaurant }),

            setStaff: (staff) => set({ staff }),

            setUserRole: (userRole) => set({ userRole }),

            setLoginMode: (loginMode) => set({ loginMode }),

            setLoading: (isLoading) => set({ isLoading }),

            setPendingOtpEmail: (pendingOtpEmail) => set({ pendingOtpEmail }),

            setHydrated: (hydrated) => set({ isHydrated: hydrated }),

            login: (user, restaurant, staff, role) => set({
                user,
                restaurant: restaurant || null,
                staff: staff || null,
                userRole: role || 'owner',
                isAuthenticated: true,
                isLoading: false,
                pendingOtpEmail: null,
                sessionExpiry: Date.now() + SESSION_TIMEOUT_MS,
                lastActivity: Date.now(),
            }),

            loginAsStaff: (staff, restaurant) => set({
                user: null,
                restaurant,
                staff,
                userRole: staff.role,
                isAuthenticated: true,
                isLoading: false,
                pendingOtpEmail: null,
                sessionExpiry: Date.now() + SESSION_TIMEOUT_MS,
                lastActivity: Date.now(),
            }),

            logout: () => set({
                ...initialState,
                isLoading: false,
                isHydrated: true,
            }),

            reset: () => set(initialState),

            refreshSession: () => {
                const state = get()
                if (!state.isAuthenticated) return
                set({
                    sessionExpiry: Date.now() + SESSION_TIMEOUT_MS,
                    lastActivity: Date.now(),
                })
            },

            isSessionValid: () => {
                const state = get()
                if (!state.isAuthenticated) return false
                if (!state.sessionExpiry) return true
                if (Date.now() > state.sessionExpiry) return false
                if (state.lastActivity && Date.now() - state.lastActivity > ACTIVITY_REFRESH_MS) {
                    return false
                }
                return true
            },
        }),
        {
            name: 'orderflow-auth',
            partialize: (state) => ({
                user: state.user,
                restaurant: state.restaurant,
                staff: state.staff,
                userRole: state.userRole,
                isAuthenticated: state.isAuthenticated,
                sessionExpiry: state.sessionExpiry,
                lastActivity: state.lastActivity,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.setHydrated(true)
                }
            },
        }
    )
)

// ============================================
// GRANULAR RBAC PERMISSION SYSTEM
// ============================================

export type Permission =
    // Page-level permissions
    | 'page:dashboard' | 'page:orders' | 'page:my_orders' | 'page:take_order'
    | 'page:tables' | 'page:menu' | 'page:kitchen' | 'page:kitchen_view'
    | 'page:cashier' | 'page:billing' | 'page:delivery_boy' | 'page:delivery_monitor'
    | 'page:riders' | 'page:staff' | 'page:staff_performance' | 'page:shifts'
    | 'page:my_shift' | 'page:tips' | 'page:inventory' | 'page:reservations'
    | 'page:discounts' | 'page:specials' | 'page:reports' | 'page:analytics'
    | 'page:expenses' | 'page:feedback' | 'page:loyalty' | 'page:qr_ordering'
    | 'page:display_manager' | 'page:settings' | 'page:api_keys' | 'page:profile'
    | 'page:order_desk' | 'page:franchise'
    // Action-level permissions
    | 'staff:invite' | 'staff:edit' | 'staff:archive' | 'staff:delete' | 'staff:view'
    | 'staff:bulk_action' | 'staff:export'
    | 'billing:view_all' | 'billing:view_own' | 'billing:process' | 'billing:refund'
    | 'menu:crud' | 'menu:view' | 'menu:update_availability'
    | 'table:crud' | 'table:change_status' | 'table:view'
    | 'order:view_all' | 'order:manage' | 'order:kitchen_update' | 'order:create'
    | 'report:view' | 'analytics:view' | 'expense:view' | 'expense:manage'
    | 'setting:view' | 'setting:manage' | 'setting:api_keys'
    | 'discount:manage' | 'loyalty:manage' | 'reservation:manage'
    | 'inventory:manage' | 'inventory:view'
    | 'display:manage' | 'qr:manage'
    | 'shift:view_all' | 'shift:manage_all' | 'shift:clock'
    | 'tip:view_own' | 'tip:view_all' | 'tip:manage'
    | 'delivery:view_all' | 'delivery:manage_fleet' | 'delivery:own'
    | 'page:messages' | 'message:send' | 'message:view' | 'message:broadcast' | 'message:call'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    owner: [
        'page:dashboard', 'page:orders', 'page:my_orders', 'page:tables', 'page:menu',
        'page:kitchen', 'page:kitchen_view', 'page:cashier', 'page:billing',
        'page:delivery_boy', 'page:delivery_monitor', 'page:riders', 'page:staff',
        'page:staff_performance', 'page:shifts',
        'page:inventory', 'page:reservations', 'page:discounts', 'page:specials',
        'page:reports', 'page:analytics', 'page:expenses', 'page:feedback',
        'page:loyalty', 'page:qr_ordering', 'page:display_manager', 'page:settings',
        'page:api_keys', 'page:profile', 'page:order_desk', 'page:franchise',
        'page:take_order',
        'staff:invite', 'staff:edit', 'staff:archive', 'staff:delete', 'staff:view',
        'staff:bulk_action', 'staff:export',
        'billing:view_all', 'billing:process', 'billing:refund',
        'menu:crud', 'menu:view', 'menu:update_availability',
        'table:crud', 'table:change_status', 'table:view',
        'order:view_all', 'order:manage', 'order:kitchen_update', 'order:create',
        'report:view', 'analytics:view', 'expense:view', 'expense:manage',
        'setting:view', 'setting:manage', 'setting:api_keys',
        'discount:manage', 'loyalty:manage', 'reservation:manage',
        'inventory:manage', 'inventory:view',
        'display:manage', 'qr:manage',
        'shift:view_all', 'shift:manage_all',
        'tip:view_all', 'tip:manage',
        'delivery:view_all', 'delivery:manage_fleet', 'delivery:own',
        'page:messages', 'message:send', 'message:view', 'message:broadcast', 'message:call',
    ],
    manager: [
        'page:dashboard', 'page:orders', 'page:my_orders', 'page:tables', 'page:menu',
        'page:kitchen', 'page:kitchen_view', 'page:cashier', 'page:billing',
        'page:delivery_monitor', 'page:riders', 'page:staff', 'page:staff_performance',
        'page:shifts', 'page:my_shift', 'page:tips', 'page:inventory',
        'page:reservations', 'page:discounts', 'page:specials', 'page:feedback',
        'page:loyalty', 'page:display_manager', 'page:profile', 'page:order_desk', 'page:take_order',
        'staff:edit', 'staff:view',
        'billing:view_all', 'billing:process',
        'menu:crud', 'menu:view', 'menu:update_availability',
        'table:crud', 'table:change_status', 'table:view',
        'order:view_all', 'order:manage', 'order:kitchen_update', 'order:create',
        'setting:view',
        'discount:manage', 'loyalty:manage', 'reservation:manage',
        'inventory:manage', 'inventory:view',
        'display:manage',
        'shift:view_all', 'shift:manage_all', 'shift:clock',
        'tip:view_own', 'tip:view_all', 'tip:manage',
        'delivery:view_all', 'delivery:manage_fleet',
        'page:messages', 'message:send', 'message:view', 'message:call',
    ],
    waiter: [
        'page:my_orders', 'page:take_order', 'page:tables', 'page:menu',
        'page:kitchen_view', 'page:my_shift', 'page:tips', 'page:profile',
        'table:change_status', 'table:view',
        'menu:view',
        'order:create',
        'shift:clock',
        'tip:view_own',
        'page:messages', 'message:send', 'message:view', 'message:call',
    ],
    kitchen: [
        'page:my_orders', 'page:menu', 'page:kitchen', 'page:kitchen_view',
        'page:my_shift', 'page:profile',
        'menu:view', 'menu:update_availability',
        'order:kitchen_update',
        'shift:clock',
        'page:messages', 'message:send', 'message:view', 'message:call',
    ],
    cashier: [
        'page:my_orders', 'page:tables', 'page:menu', 'page:cashier',
        'page:billing', 'page:my_shift', 'page:tips', 'page:profile',
        'billing:view_own', 'billing:process',
        'table:change_status', 'table:view',
        'menu:view',
        'order:manage',
        'shift:clock',
        'tip:view_own',
        'page:messages', 'message:send', 'message:view', 'message:call',
    ],
    delivery: [
        'page:delivery_boy', 'page:my_shift', 'page:profile',
        'delivery:own',
        'shift:clock',
        'page:messages', 'message:send', 'message:view', 'message:call',
    ],
    rider: [
        'page:delivery_boy', 'page:my_shift', 'page:profile',
        'delivery:own',
        'shift:clock',
        'page:messages', 'message:send', 'message:view', 'message:call',
    ],
}

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
    'page:dashboard': 'View overview dashboard',
    'page:orders': 'View all orders',
    'page:my_orders': 'View assigned orders',
    'page:take_order': 'Take customer orders',
    'page:tables': 'Manage tables',
    'page:menu': 'View menu',
    'page:kitchen': 'Kitchen display system',
    'page:kitchen_view': 'Compact kitchen view',
    'page:cashier': 'Cashier POS station',
    'page:billing': 'Billing & invoices',
    'page:delivery_boy': 'My deliveries',
    'page:delivery_monitor': 'Delivery fleet monitor',
    'page:riders': 'Rider management',
    'page:staff': 'Staff management',
    'page:staff_performance': 'Staff performance metrics',
    'page:shifts': 'Shift scheduling',
    'page:my_shift': 'My shift clock-in/out',
    'page:tips': 'Tip tracking',
    'page:inventory': 'Inventory management',
    'page:reservations': 'Table reservations',
    'page:discounts': 'Discounts & promos',
    'page:specials': 'Daily specials',
    'page:reports': 'Financial reports',
    'page:analytics': 'Business analytics',
    'page:expenses': 'Expense tracking',
    'page:feedback': 'Customer feedback',
    'page:loyalty': 'Loyalty program',
    'page:qr_ordering': 'QR code ordering setup',
    'page:display_manager': 'Display screen management',
    'page:settings': 'Restaurant settings',
    'page:api_keys': 'API key management',
    'page:profile': 'My profile',
    'page:order_desk': 'Order monitoring desk',
    'page:franchise': 'Franchise management',
    'staff:invite': 'Invite new staff members',
    'staff:edit': 'Edit staff information',
    'staff:archive': 'Archive staff members',
    'staff:delete': 'Permanently delete staff',
    'staff:view': 'View staff list',
    'staff:bulk_action': 'Bulk enable/disable/archive',
    'staff:export': 'Export staff list to CSV',
    'billing:view_all': 'View all transactions',
    'billing:view_own': 'View own shift transactions',
    'billing:process': 'Process payments',
    'billing:refund': 'Process refunds',
    'menu:crud': 'Add/edit/delete menu items',
    'menu:view': 'View menu items',
    'menu:update_availability': 'Mark items available/unavailable',
    'table:crud': 'Add/remove tables',
    'table:change_status': 'Change table status',
    'table:view': 'View table layout',
    'order:view_all': 'View all restaurant orders',
    'order:manage': 'Manage orders (update status)',
    'order:kitchen_update': 'Update kitchen order status',
    'order:create': 'Create new orders',
    'report:view': 'View reports',
    'analytics:view': 'View analytics dashboard',
    'expense:view': 'View expenses',
    'expense:manage': 'Add/edit expenses',
    'setting:view': 'View settings',
    'setting:manage': 'Change settings (tax, currency, theme)',
    'setting:api_keys': 'Manage API keys',
    'discount:manage': 'Create/edit discounts',
    'loyalty:manage': 'Manage loyalty program',
    'reservation:manage': 'Manage reservations',
    'inventory:manage': 'Add/edit inventory items',
    'inventory:view': 'View inventory',
    'display:manage': 'Manage display screens',
    'qr:manage': 'Manage QR ordering setup',
    'shift:view_all': 'View all staff shifts',
    'shift:manage_all': 'Schedule and manage shifts',
    'shift:clock': 'Clock in/out for own shift',
    'tip:view_own': 'View own tips',
    'tip:view_all': 'View all staff tips',
    'tip:manage': 'Distribute and manage tips',
    'delivery:view_all': 'View all deliveries',
    'delivery:manage_fleet': 'Manage rider fleet',
    'delivery:own': 'View and update own deliveries',
    'page:messages': 'View messaging page',
    'message:send': 'Send direct messages',
    'message:view': 'View conversations',
    'message:broadcast': 'Send broadcast messages to all staff',
    'message:call': 'Initiate audio calls',
}

export function hasPermission(role: UserRole | null, permission: Permission): boolean {
    if (!role) return false
    const permissions = ROLE_PERMISSIONS[role] || []
    return permissions.includes(permission)
}

export function hasAnyPermission(role: UserRole | null, permissions: Permission[]): boolean {
    if (!role) return false
    const rolePerms = ROLE_PERMISSIONS[role] || []
    return permissions.some((p) => rolePerms.includes(p))
}

export function getRolePermissions(role: UserRole | null): Permission[] {
    if (!role) return []
    return ROLE_PERMISSIONS[role] || []
}

export const useHasPermission = (permission: Permission): boolean => {
    return useAuthStore((state) => hasPermission(state.userRole, permission))
}

export const useHasAnyPermission = (permissions: Permission[]): boolean => {
    return useAuthStore((state) => hasAnyPermission(state.userRole, permissions))
}

export const useRolePermissions = (): Permission[] => {
    return useAuthStore((state) => getRolePermissions(state.userRole))
}

export const useRestaurantId = (): string | undefined => {
    return useAuthStore((state) => state.restaurant?.id)
}

export const useRestaurantName = (): string | undefined => {
    return useAuthStore((state) => state.restaurant?.name)
}

export const useUserRole = () => {
    return useAuthStore((state) => state.userRole)
}

export const useIsOwner = (): boolean => {
    return useAuthStore((state) => state.userRole === 'owner')
}

export const useIsManagerOrOwner = (): boolean => {
    return useAuthStore((state) =>
        state.userRole === 'owner' || state.userRole === 'manager'
    )
}

export const useIsStaff = (): boolean => {
    return useAuthStore((state) => state.loginMode === 'staff')
}

export const useCurrentStaff = () => {
    return useAuthStore((state) => state.staff)
}

export const useStaffName = (): string | undefined => {
    return useAuthStore((state) => state.staff?.name || state.user?.full_name)
}

export const useAuthActions = () => {
    return useAuthStore((state) => ({
        setUser: state.setUser,
        setRestaurant: state.setRestaurant,
        setStaff: state.setStaff,
        setUserRole: state.setUserRole,
        setLoginMode: state.setLoginMode,
        setLoading: state.setLoading,
        setPendingOtpEmail: state.setPendingOtpEmail,
        setHydrated: state.setHydrated,
        login: state.login,
        loginAsStaff: state.loginAsStaff,
        logout: state.logout,
        reset: state.reset,
        refreshSession: state.refreshSession,
        isSessionValid: state.isSessionValid,
    }))
}

export const useIsFullyAuthenticated = (): boolean => {
    return useAuthStore((state) =>
        state.isAuthenticated && state.restaurant !== null
    )
}

export const useIsHydrated = (): boolean => {
    return useAuthStore((state) => state.isHydrated)
}
