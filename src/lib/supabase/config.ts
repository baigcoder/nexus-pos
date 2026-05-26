export function getSupabaseUrl() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
}

export function getSupabasePublicKey() {
    return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export function isSupabaseConfigured() {
    return Boolean(getSupabaseUrl() && getSupabasePublicKey())
}

export function getSupabaseConfigError() {
    return 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to `.env.local`, then restart the dev server.'
}
