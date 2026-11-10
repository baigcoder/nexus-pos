'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Account, AccountField, AccountNotice, Submit } from '@/components/account/Account'
import styles from '@/components/account/account.module.css'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [sending, setSending] = useState(false)
    const [notice, setNotice] = useState('')
    const [error, setError] = useState('')
    const active = useRef(false)

    async function requestReset(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (active.current) return
        active.current = true
        setSending(true)
        setNotice('')
        setError('')
        try {
            const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
                redirectTo: new URL('/reset-password', window.location.origin).href,
            })
            if (error && (!error.status || error.status >= 500)) throw error
            setNotice('If an account exists for this email, check your inbox for a reset link.')
        } catch {
            setError('Password recovery is temporarily unavailable. Try again shortly.')
        } finally {
            active.current = false
            setSending(false)
        }
    }

    return (
        <Account area="Owner recovery" title="Reset your password" description="Enter the email you use to sign in to NexusPOS.">
            <form onSubmit={requestReset} className={styles.form}>
                <AccountField label="Owner email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
                {notice && <AccountNotice>{notice}</AccountNotice>}
                {error && <AccountNotice error>{error}</AccountNotice>}
                <Submit busy={sending}>{sending ? 'Sending…' : 'Send reset link'}</Submit>
            </form>
            <div className={styles.links}><Link href="/login">Back to sign in</Link><Link href="/staff-login">Recover a staff PIN</Link></div>
        </Account>
    )
}
