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
