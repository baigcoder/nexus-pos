'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Account, AccountField, AccountLoading, AccountNotice, AccountSteps, Submit } from '@/components/account/Account'
import { useAuthStore } from '@/stores'
import styles from '@/components/account/account.module.css'

export default function VerifyOtpPage() {
    return <Suspense fallback={<AccountLoading />}><Verification /></Suspense>
}

function Verification() {
    const router = useRouter()
    const search = useSearchParams()
    const pendingEmail = useAuthStore(state => state.pendingOtpEmail)
    const setPendingOtpEmail = useAuthStore(state => state.setPendingOtpEmail)
    const email = search.get('email') || pendingEmail || ''
    const [code, setCode] = useState('')
    const [busy, setBusy] = useState<'verify' | 'resend' | null>(null)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [wait, setWait] = useState(0)
    const active = useRef(false)
    const input = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!wait) return
        const timer = window.setTimeout(() => setWait(current => Math.max(0, current - 1)), 1000)
        return () => window.clearTimeout(timer)
    }, [wait])

    async function request(action: 'verify' | 'resend') {
        if (!email || active.current || (action === 'verify' ? code.length !== 6 : wait > 0)) return
        active.current = true
        setBusy(action)
        setError('')
        setNotice('')
        try {
            const response = await fetch(action === 'verify' ? '/api/auth/verify-otp' : '/api/auth/send-otp', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(action === 'verify' ? { email, code } : { email }),
            })
            const data = await response.json()
            if (!response.ok || (action === 'verify' && !data.verified)) {
                if (action === 'resend' && Number(data.retryAfter) > 0) setWait(Math.ceil(Number(data.retryAfter)))
                throw new Error(data.error || 'Could not complete verification.')
            }
            if (action === 'verify') {
                setPendingOtpEmail(null)
                router.replace('/login?verified=true')
                return
            }
            setCode('')
            setWait(30)
            setNotice('A new code is on its way. Use the most recent email.')
            input.current?.focus()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not complete verification.')
        } finally {
            setBusy(null)
            active.current = false
        }
    }

    return (
        <Account area="Owner account" title="Verify your email" description={email ? <>Enter the six-digit code for <strong>{email}</strong>.</> : 'Return to registration to request a code.'}>
            <AccountSteps labels={['Account', 'Verify email', 'Restaurant setup']} current={1} />
            {email && (
                <form className={styles.form} onSubmit={event => { event.preventDefault(); void request('verify') }}>
                    {search.get('resend') === '1' && !notice && <AccountNotice>The first code could not be sent. Request another code below.</AccountNotice>}
                    <div className={styles.pin}><AccountField ref={input} label="Verification code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6}
                        value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
                    {notice && <AccountNotice>{notice}</AccountNotice>}
                    {error && <AccountNotice error>{error}</AccountNotice>}
                    <Submit busy={busy === 'verify'} disabled={!!busy || code.length !== 6}>{busy === 'verify' ? 'Verifying…' : 'Verify email'}</Submit>
                    <button type="button" className={styles.secondary} disabled={!!busy || wait > 0} onClick={() => { void request('resend') }}>
                        {busy === 'resend' ? 'Sending…' : wait ? `Resend code in ${wait}s` : 'Resend code'}
                    </button>
                </form>
            )}
            <div className={styles.links}><Link href="/login">Back to sign in</Link><Link href="/register">Use a different email</Link></div>
        </Account>
    )
}
