'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Account, AccountField, AccountNotice, AccountSteps, PasswordField, Submit } from '@/components/account/Account'
import { createClient, signInWithGoogle, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import styles from '@/components/account/account.module.css'

export default function RegisterPage() {
    const router = useRouter()
    const setPendingOtpEmail = useAuthStore(state => state.setPendingOtpEmail)
    const [form, setForm] = useState({ name: '', restaurant: '', email: '', password: '', confirmation: '' })
    const [busy, setBusy] = useState<'register' | 'google' | null>(null)
    const [error, setError] = useState('')
    const active = useRef(false)
    const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm(previous => ({ ...previous, [field]: event.target.value }))

    async function register(event: React.FormEvent) {
        event.preventDefault()
        if (active.current) return
        if (!form.name.trim() || !form.restaurant.trim()) return setError('Enter your name and restaurant name.')
        if (form.password !== form.confirmation) return setError('Passwords do not match.')
        active.current = true
        setBusy('register')
        setError('')
        const email = form.email.trim()
        try {
            const { data, error } = await createClient().auth.signUp({
                email, password: form.password,
                options: { data: { full_name: form.name.trim(), restaurant_name: form.restaurant.trim(), role: 'owner' } },
            })
            if (error || !data.user) throw error || new Error('Could not create your account.')
            setPendingOtpEmail(email)
            const response = await fetch('/api/auth/send-otp', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
            }).catch(() => null)
            router.push(`/verify-otp?email=${encodeURIComponent(email)}${response?.ok ? '' : '&resend=1'}`)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not create your account.')
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
            setError(cause instanceof Error ? cause.message : 'Could not continue with Google.')
            active.current = false
            setBusy(null)
        }
    }

    return (
        <Account area="Owner account" title="Start with your restaurant" description="Create an owner account to set up NexusPOS.">
            <AccountSteps labels={['Account', 'Verify email', 'Restaurant setup']} current={0} />
            <form className={styles.form} onSubmit={register}>
                <AccountField label="Full name" autoComplete="name" required maxLength={100} value={form.name} onChange={update('name')} />
                <AccountField label="Restaurant name" autoComplete="organization" required maxLength={100} value={form.restaurant} onChange={update('restaurant')} />
                <AccountField label="Email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={update('email')} />
                <div className={styles.grid}>
                    <PasswordField label="Password" hint="At least 6 characters." autoComplete="new-password" minLength={6} maxLength={72} required value={form.password} onChange={update('password')} />
                    <PasswordField label="Confirm password" autoComplete="new-password" minLength={6} maxLength={72} required value={form.confirmation} onChange={update('confirmation')} />
                </div>
                {error && <AccountNotice error>{error}</AccountNotice>}
                <Submit busy={busy === 'register'} disabled={!!busy}>{busy === 'register' ? 'Creating account…' : 'Create account'}</Submit>
                <button type="button" className={styles.secondary} disabled={!!busy || !isSupabaseConfigured()} onClick={() => { void google() }}>
                    {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
                </button>
            </form>
            <div className={styles.links}>Already have an account? <Link href="/login">Sign in</Link></div>
        </Account>
    )
}
