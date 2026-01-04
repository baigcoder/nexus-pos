import { createBrowserClient } from '@supabase/ssr'
import type { AuthUser, Staff, Restaurant, UserRole } from '@/types'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

// ============================================
// GOOGLE OAUTH AUTHENTICATION
// ============================================

/**
 * Sign in or sign up with Google OAuth.
 * Redirects to Google, then back to /auth/callback.
 */
export async function signInWithGoogle() {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
        },
    })
    return { data, error }
}

// ============================================
// OTP AUTHENTICATION HELPERS
// ============================================

/**
 * Send an OTP code to the user's email for verification.
 * Uses Supabase's built-in magic link / OTP system.
 */
export async function sendOtpEmail(email: string) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: false, // Only for existing users
        },
    })
    return { data, error }
}

/**
 * Send OTP for new user registration (creates user if not exists).
 */
export async function sendSignUpOtp(email: string) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: true,
        },
    })
    return { data, error }
}

/**
 * Verify the OTP token entered by the user.
 */
export async function verifyOtp(email: string, token: string) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
    })
    return { data, error }
}

// ============================================
// STAFF PIN-BASED AUTHENTICATION
// ============================================

/**
 * Authenticate a staff member using their restaurant slug and PIN.
 * This is for quick access for waiters and kitchen staff.
 * Uses server-side API for secure bcrypt PIN validation and rate limiting.
 */
export async function signInWithPin(restaurantSlug: string, pin: string): Promise<{
    success: boolean
    staff?: Staff
    restaurant?: Restaurant
    error?: string
    remainingAttempts?: number
    retryAfter?: number
}> {
    try {
        const response = await fetch('/api/auth/staff-login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ restaurantSlug, pin }),
        })
        
        const data = await response.json()
        
        if (!response.ok) {
            return {
                success: false,
                error: data.error || 'Login failed',
                remainingAttempts: data.remainingAttempts,
                retryAfter: data.retryAfter
            }
        }
        
        return {
            success: true,
            staff: data.staff,
            restaurant: data.restaurant
        }
    } catch (error) {
        console.error('Staff login error:', error)
        return { success: false, error: 'Network error. Please try again.' }
    }
}

/**
 * Fetch user's role based on their auth.users ID and associated staff record.
 */
export async function getUserRole(userId: string, restaurantId: string): Promise<UserRole | null> {
    const supabase = createClient()

    const { data: staff, error } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .single()

    if (error || !staff) return null
    return staff.role as UserRole
}
