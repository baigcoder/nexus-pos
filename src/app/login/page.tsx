'use client'

import { Suspense, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Account, AccountField, AccountLoading, AccountNotice, PasswordField, Submit } from '@/components/account/Account'
import { createClient, signInWithGoogle, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import styles from '@/components/account/account.module.css'

export default function LoginPage() {
    return <Suspense fallback={<AccountLoading />}><OwnerLogin /></Suspense>
}

function OwnerLogin() {
    const router = useRouter()
    const search = useSearchParams()
    const { login, setLoginMode } = useAuthStore()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [busy, setBusy] = useState<'password' | 'google' | null>(null)
    const [error, setError] = useState('')
    const active = useRef(false)
    const notice = search.get('password_reset') === 'true' ? 'Password updated. Sign in with your new password.'
        : search.get('verified') === 'true' ? 'Email verified. Sign in to continue setting up your restaurant.'
        : search.get('registered') === 'true' ? 'Account created. Check your email for verification.'
        : ''
    const callbackError = search.get('error') === 'auth_callback_error' ? 'Google sign-in did not finish. Please try again.' : ''

    async function signIn(event: React.FormEvent) {
        event.preventDefault()
        if (active.current) return
        active.current = true
        setBusy('password')
        setError('')
        try {
            const client = createClient()
            const { data, error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password })
            if (authError || !data.user) throw authError || new Error('Could not sign in.')
            const user = data.user
            const { data: restaurant, error: restaurantError } = await client.from('restaurants').select('*').eq('owner_id', user.id).maybeSingle()
            if (restaurantError) throw new Error('Could not load your restaurant. Try signing in again.')
            login({ id: user.id, email: user.email || email.trim(), full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] }, restaurant || undefined, undefined, 'owner')
            setLoginMode('owner')
            const destination = search.get('redirect') || ''
            router.push(restaurant ? (/^\/dashboard(?:\/[a-z0-9-]+)*$/.test(destination) ? destination : '/dashboard') : '/setup')
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not sign in.')
            active.current = false
            setBusy(null)
        }
    }

    async function google() {
        if (active.current) return
        active.current = true
        setBusy('google')
        setError('')
        try {
            const { error } = await signInWithGoogle()
            if (error) throw error
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not sign in with Google.')
            active.current = false
            setBusy(null)
        }
    }

    return (
        <Account area="Owner access" title="Sign in" description="Open your restaurant workspace.">
            {notice && <AccountNotice>{notice}</AccountNotice>}
            <form className={styles.form} onSubmit={signIn}>
                <AccountField label="Email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
                <PasswordField label="Password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
                <Link className={styles.textLink} href="/forgot-password">Forgot password?</Link>
                {(error || callbackError) && <AccountNotice error>{error || callbackError}</AccountNotice>}
                <Submit busy={busy === 'password'} disabled={!!busy}>{busy === 'password' ? 'Signing in…' : 'Sign in'}</Submit>
                <button type="button" className={styles.secondary} disabled={!!busy || !isSupabaseConfigured()} onClick={() => { void google() }}>
                    {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
                </button>
            </form>
            <div className={styles.links}><Link href="/register">Create an owner account</Link><Link href="/staff-login">Staff sign-in</Link><Link href="/screen-login">Pair a display</Link></div>
        </Account>
    )
}
