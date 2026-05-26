import { createClient } from '@supabase/supabase-js'

export function getSupabaseServerKey() {
    return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
}

export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServerKey = getSupabaseServerKey()

    if (!supabaseUrl || !supabaseServerKey) {
        throw new Error('Supabase server configuration missing')
    }

    return createClient(supabaseUrl, supabaseServerKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}
