'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Account, AccountField, AccountLoading, AccountNotice, AccountSteps, PasswordField, Submit } from '@/components/account/Account'
import { useAuthStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import styles from '@/components/account/account.module.css'

type Invitee = { name?: string; email?: string; needs_setup?: boolean }

export default function StaffSetupPage() {
    return <Suspense fallback={<AccountLoading />}><StaffInvitation /></Suspense>
}

function StaffInvitation() {
    const search = useSearchParams()
    const router = useRouter()
    const { loginAsStaff, staff } = useAuthStore()
    const email = search.get('email') || ''
    const token = search.get('token') || ''
    const staffId = search.get('id') || staff?.id
    const [invitee, setInvitee] = useState<Invitee | null>(null)
    const [loading, setLoading] = useState(true)
    const [step, setStep] = useState(0)
    const [pin, setPin] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [phone, setPhone] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const active = useRef(false)

    useEffect(() => {
        const controller = new AbortController()
        async function load() {
            if (!token || (!email && !staffId)) {
                setLoading(false)
                return
            }
            try {
                let data: Invitee | null
                if (email) {
                    const response = await fetch('/api/auth/staff-check', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.toLowerCase() }),
                        signal: controller.signal,
                    })
                    const result = await response.json()
                    if (!response.ok || !result.success) throw new Error(result.error || 'Could not find the staff invitation.')
                    data = result.staff
                } else {
                    const result = await createClient().from('staff').select('name,email,needs_setup').eq('id', staffId).abortSignal(controller.signal).single()
                    if (result.error) throw new Error('Could not find the staff invitation.')
                    data = result.data
                }
                if (controller.signal.aborted) return
                if (!data?.needs_setup) throw new Error('This account is already set up. Sign in with your staff PIN.')
                setInvitee(data)
            } catch (cause) {
                if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load the invitation.')
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }
        void load()
        return () => controller.abort()
    }, [email, staffId, token])

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        if (active.current || !invitee || !token) return
        if (pin.length !== 4 || pin !== confirmation) return setError('Enter matching four-digit PINs.')
        setError('')
        if (step === 0) return setStep(1)
        active.current = true
        setBusy(true)
        try {
            const response = await fetch('/api/auth/staff-setup', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email || invitee.email, tempPin: token, newPin: pin, phone: phone.trim() || null }),
            })
            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data.error || 'Could not complete staff setup.')
            loginAsStaff(data.staff, data.restaurant)
            router.replace('/staff-portal')
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not complete staff setup.')
            setBusy(false)
            active.current = false
        }
    }

    if (loading) return <AccountLoading />
    return (
        <Account area="Staff invitation" stepKey={step} title="Set up staff access" description={invitee?.name ? `Create the PIN you’ll use to sign in, ${invitee.name}.` : 'Use the invitation provided by your manager.'}>
            {invitee ? <>
                <AccountSteps labels={['Create PIN', 'Contact details']} current={step} />
                <form className={styles.form} onSubmit={submit}>
                    {step === 0 ? <div className={`${styles.grid} ${styles.pin}`}>
                        <PasswordField label="New PIN" inputMode="numeric" autoComplete="new-password" required maxLength={4} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} />
                        <PasswordField label="Confirm PIN" inputMode="numeric" autoComplete="new-password" required maxLength={4} value={confirmation} onChange={event => setConfirmation(event.target.value.replace(/\D/g, '').slice(0, 4))} />
                    </div> : <AccountField label="Phone (optional)" type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} />}
                    {error && <AccountNotice error>{error}</AccountNotice>}
                    <Submit busy={busy}>{busy ? 'Saving…' : step === 0 ? 'Continue' : 'Complete staff setup'}</Submit>
                    {step === 1 && <button type="button" className={styles.textLink} disabled={busy} onClick={() => { setError(''); setStep(0) }}>Back to PIN setup</button>}
                </form>
            </> : <AccountNotice error={!!error}>{error || 'This invitation link is missing its setup code. Use the link in your invitation email.'}</AccountNotice>}
            <div className={styles.links}><Link href="/staff-login">Staff sign-in</Link></div>
        </Account>
    )
}
