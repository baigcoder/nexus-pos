import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // Check if user has a restaurant (for Google OAuth signups)
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                const { data: restaurant } = await supabase
                    .from('restaurants')
                    .select('id')
                    .eq('owner_id', user.id)
                    .single()

                // Redirect to setup if no restaurant exists (new user)
                if (!restaurant) {
                    return NextResponse.redirect(`${origin}/setup`)
                }
            }

            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
