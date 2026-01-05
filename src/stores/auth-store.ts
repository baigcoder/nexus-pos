import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Restaurant, Staff, AuthUser, UserRole } from '@/types'

type LoginMode = 'owner' | 'staff'

interface AuthState {
    user: AuthUser | null
    restaurant: Restaurant | null
    staff: Staff | null
    userRole: UserRole | null
    loginMode: LoginMode
    isLoading: boolean
    isAuthenticated: boolean
    pendingOtpEmail: string | null // Email awaiting OTP verification

    // Actions
    setUser: (user: AuthUser | null) => void
    setRestaurant: (restaurant: Restaurant | null) => void
    setStaff: (staff: Staff | null) => void
    setUserRole: (role: UserRole | null) => void
    setLoginMode: (mode: LoginMode) => void
    setLoading: (loading: boolean) => void
    setPendingOtpEmail: (email: string | null) => void
    login: (user: AuthUser, restaurant?: Restaurant, staff?: Staff, role?: UserRole) => void
    loginAsStaff: (staff: Staff, restaurant: Restaurant) => void
    logout: () => void
    reset: () => void
}

const initialState = {
    user: null,
    restaurant: null,
    staff: null,
    userRole: null,
    loginMode: 'owner' as LoginMode,
    isLoading: true,
    isAuthenticated: false,
    pendingOtpEmail: null,
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            ...initialState,

            setUser: (user) => set({
                user,
                isAuthenticated: !!user,
                isLoading: false
            }),

            setRestaurant: (restaurant) => set({ restaurant }),

            setStaff: (staff) => set({ staff }),

            setUserRole: (userRole) => set({ userRole }),

            setLoginMode: (loginMode) => set({ loginMode }),

            setLoading: (isLoading) => set({ isLoading }),

            setPendingOtpEmail: (pendingOtpEmail) => set({ pendingOtpEmail }),

            login: (user, restaurant, staff, role) => set({
                user,
                restaurant: restaurant || null,
                staff: staff || null,
                userRole: role || 'owner',
                isAuthenticated: true,
                isLoading: false,
                pendingOtpEmail: null,
            }),

            loginAsStaff: (staff, restaurant) => set({
                user: null, // Staff don't have a full auth.users account for PIN login
                restaurant,
                staff,
                userRole: staff.role,
                isAuthenticated: true,
                isLoading: false,
                pendingOtpEmail: null,
            }),

            logout: () => set({
                ...initialState,
                isLoading: false,
            }),

            reset: () => set(initialState),
        }),
        {
            name: 'orderflow-auth',
            partialize: (state) => ({
                user: state.user,
                restaurant: state.restaurant,
                staff: state.staff,
                userRole: state.userRole,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)

// ============================================
// COMPUTED SELECTORS
// Permission-based access and common state patterns
// ============================================

// Role permissions map
const ROLE_PERMISSIONS: Record<string, string[]> = {
    owner: ['*'], // Owner has all permissions
    manager: ['dashboard', 'orders', 'menu', 'tables', 'staff', 'reports', 'inventory', 'settings', 'reservations', 'billing'],
    waiter: ['orders', 'tables', 'menu'],
    kitchen: ['orders', 'kitchen'],
    cashier: ['orders', 'billing', 'tables'],
    delivery: ['orders', 'delivery'],
}

// Check if current user has permission for a specific feature
export const useHasPermission = (permission: string): boolean => {
    return useAuthStore((state) => {
        const role = state.userRole
        if (!role) return false

        const permissions = ROLE_PERMISSIONS[role] || []
        return permissions.includes('*') || permissions.includes(permission)
    })
}

// Check if user can access multiple permissions
export const useHasAnyPermission = (permissions: string[]): boolean => {
    return useAuthStore((state) => {
        const role = state.userRole
        if (!role) return false

        const rolePermissions = ROLE_PERMISSIONS[role] || []
        if (rolePermissions.includes('*')) return true
        return permissions.some(p => rolePermissions.includes(p))
    })
}

// Get current restaurant ID (commonly needed)
export const useRestaurantId = (): string | undefined => {
    return useAuthStore((state) => state.restaurant?.id)
}

// Get current restaurant name
export const useRestaurantName = (): string | undefined => {
    return useAuthStore((state) => state.restaurant?.name)
}

// Get current user role
export const useUserRole = () => {
    return useAuthStore((state) => state.userRole)
}

// Check if user is owner
export const useIsOwner = (): boolean => {
    return useAuthStore((state) => state.userRole === 'owner')
}

// Check if user is manager or owner
export const useIsManagerOrOwner = (): boolean => {
    return useAuthStore((state) =>
        state.userRole === 'owner' || state.userRole === 'manager'
    )
}

// Get current staff member info
export const useCurrentStaff = () => {
    return useAuthStore((state) => state.staff)
}

// Get current staff name
export const useStaffName = (): string | undefined => {
    return useAuthStore((state) => state.staff?.name || state.user?.full_name)
}

// Auth actions (for easier import)
export const useAuthActions = () => {
    return useAuthStore((state) => ({
        setUser: state.setUser,
        setRestaurant: state.setRestaurant,
        setStaff: state.setStaff,
        setUserRole: state.setUserRole,
        setLoginMode: state.setLoginMode,
        setLoading: state.setLoading,
        setPendingOtpEmail: state.setPendingOtpEmail,
        login: state.login,
        loginAsStaff: state.loginAsStaff,
        logout: state.logout,
        reset: state.reset,
    }))
}

// Check if fully authenticated with restaurant
export const useIsFullyAuthenticated = (): boolean => {
    return useAuthStore((state) =>
        state.isAuthenticated && state.restaurant !== null
    )
}
