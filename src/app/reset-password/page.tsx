'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores'
import { Account, AccountNotice, PasswordField, Submit } from '@/components/account/Account'
import styles from '@/components/account/account.module.css'

export default function ResetPasswordPage() {
    const router = useRouter()
    const logout = useAuthStore(state => state.logout)
    const token = useRef('')
    const active = useRef(false)
    const [ready, setReady] = useState(false)
    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        const value = new URLSearchParams(window.location.hash.slice(1)).get('token_hash')
        if (value) {
            token.current = value
            window.history.replaceState(window.history.state, '', window.location.pathname)
        }
        setReady(true)
    }, [])

    async function reset(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (active.current || !token.current) return
        if (password !== confirmation) return setError('Passwords do not match.')
        if (new TextEncoder().encode(password).length > 72) return setError('Choose a shorter password. The limit is 72 bytes.')
        active.current = true
        setError('')
        setSaving(true)
        try {
            const response = await fetch('/api/auth/recover-password', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokenHash: token.current, password }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Password reset failed.')
            token.current = ''
            logout()
            router.replace('/login?password_reset=true')
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Password reset failed.')
            active.current = false
            setSaving(false)
        }
    }

    return (
        <Account area="Owner recovery" title="Choose a new password" description="You’ll use it the next time you sign in.">
            {ready && token.current ? (
                <form onSubmit={reset} className={styles.form}>
                    <PasswordField label="New password" hint="Use at least 12 characters." autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} />
                    <PasswordField label="Confirm password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
                    {error && <AccountNotice error>{error}</AccountNotice>}
                    <Submit busy={saving}>{saving ? 'Saving…' : 'Save new password'}</Submit>
                </form>
            ) : <AccountNotice>{ready ? 'Open the reset link from your email to continue.' : 'Checking your reset link…'}</AccountNotice>}
            <div className={styles.links}><Link href="/forgot-password">Request another link</Link><Link href="/login">Back to sign in</Link></div>
        </Account>
    )
}
