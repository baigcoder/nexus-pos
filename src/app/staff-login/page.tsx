'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Account, AccountField, AccountNotice, AccountSteps, PasswordField, Submit } from '@/components/account/Account'
import { useAuthStore } from '@/stores'
import type { Restaurant, Staff } from '@/types'
import styles from '@/components/account/account.module.css'

type Step = 'email' | 'invite' | 'pin' | 'new-pin' | 'profile' | 'recover'
type Preview = { id: string; name: string; role: string; needs_setup: boolean; has_pin?: boolean }
type SavedAccount = { email: string; name: string; role: string; restaurantName: string; timestamp: number }
type Reply = { success?: boolean; error?: string; retryAfter?: number; message?: string; needsSetup?: boolean; verified?: boolean; staff?: Staff & Preview; restaurant?: Restaurant }
const accountKey = 'orderflow-staff-accounts'
const destinations: Record<string, string> = {
    kitchen: '/dashboard/kitchen-view', waiter: '/waiter', cashier: '/dashboard/cashier',
    delivery: '/dashboard/delivery-boy', rider: '/dashboard/delivery-boy', manager: '/dashboard', owner: '/dashboard',
}
const headings: Record<Step, string> = {
    email: 'Staff sign-in', invite: 'Enter your temporary PIN', pin: 'Enter your staff PIN',
    'new-pin': 'Create your staff PIN', profile: 'Complete your staff profile', recover: 'Reset your staff PIN',
}

function savedAccounts(): SavedAccount[] {
    try {
        const data: unknown = JSON.parse(localStorage.getItem(accountKey) || '[]')
        return Array.isArray(data) ? data.filter(account => typeof account?.email === 'string').slice(0, 5) : []
    } catch {
        return []
    }
}

export default function StaffLoginPage() {
    const router = useRouter()
    const { loginAsStaff, setLoginMode } = useAuthStore()
    const [step, setStep] = useState<Step>('email')
    const [email, setEmail] = useState('')
    const [pin, setPin] = useState('')
    const [confirmed, setConfirmed] = useState('')
    const [temporary, setTemporary] = useState('')
    const [preview, setPreview] = useState<Preview | null>(null)
    const [profile, setProfile] = useState({ name: '', phone: '', avatar: '' })
    const [saved, setSaved] = useState<SavedAccount[]>([])
    const [remember, setRemember] = useState(false)
    const [busy, setBusy] = useState(false)
    const [online, setOnline] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [wait, setWait] = useState(0)
    const active = useRef(false)

    useEffect(() => {
        setSaved(savedAccounts())
        const update = () => setOnline(navigator.onLine)
        update()
        window.addEventListener('online', update)
        window.addEventListener('offline', update)
        return () => {
            window.removeEventListener('online', update)
            window.removeEventListener('offline', update)
        }
    }, [])

    useEffect(() => {
        if (!wait) return
        const timer = window.setTimeout(() => setWait(current => Math.max(0, current - 1)), 1000)
        return () => window.clearTimeout(timer)
    }, [wait])

    function goTo(next: Step) {
        setError('')
        setNotice('')
        setPin('')
        setConfirmed('')
        if (next === 'email' || next === 'recover') {
            setTemporary('')
            setPreview(null)
        }
        setStep(next)
    }

    async function request(path: string, body: Record<string, unknown>): Promise<Reply> {
        const response = await fetch(path, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
        })
        const data: Reply = await response.json()
        if (!response.ok || data.success === false) {
            if (response.status === 429 && Number(data.retryAfter) > 0) setWait(Math.ceil(Number(data.retryAfter)))
            throw new Error(data.error || 'Could not complete staff access.')
        }
        return data
    }

    function complete(staff?: Staff, restaurant?: Restaurant) {
        if (!staff || !restaurant) throw new Error('Could not open your staff workspace.')
        setLoginMode('staff')
        loginAsStaff(staff, restaurant)
        if (remember && staff.email) {
            try {
                const next = [{ email: staff.email, name: staff.name, role: staff.role, restaurantName: restaurant.name, timestamp: Date.now() },
                    ...savedAccounts().filter(account => account.email !== staff.email)].slice(0, 5)
                localStorage.setItem(accountKey, JSON.stringify(next))
            } catch {
                // Storage can be unavailable on shared devices.
            }
        }
        router.replace(destinations[staff.role] || '/staff-portal')
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        if (active.current || !online || wait > 0) return
        const address = email.trim().toLowerCase()
        if (!address) return
        if (step === 'new-pin') {
            if (pin.length !== 4 || pin !== confirmed) return setError('Enter matching four-digit PINs.')
            setError('')
            setStep('profile')
            return
        }
        active.current = true
        setBusy(true)
        setError('')
        setNotice('')
        let openingWorkspace = false
        try {
            if (step === 'email') {
                const result = await request('/api/auth/staff-check', { email: address })
                if (!result.staff) throw new Error('Could not find this staff account.')
                setPreview(result.staff)
                setProfile({ name: result.staff.name || '', phone: '', avatar: '' })
                setPin('')
                setStep(result.staff.needs_setup ? 'invite' : 'pin')
            } else if (step === 'recover') {
                const result = await request('/api/auth/forgot-pin', { email: address })
                goTo('email')
                setNotice(result.message || 'If a staff account exists for this email, check your inbox.')
            } else if (step === 'invite') {
                if (pin.length !== 6) throw new Error('Enter the six-digit temporary PIN from your invitation.')
                const result = await request('/api/auth/staff-email-login', { email: address, pin })
                if (!result.needsSetup || !result.verified) throw new Error('Could not verify this invitation.')
                setTemporary(pin)
                goTo('new-pin')
            } else if (step === 'pin') {
                if (pin.length !== 4) throw new Error('Enter your four-digit staff PIN.')
                const result = await request('/api/auth/staff-email-login', { email: address, pin })
                complete(result.staff, result.restaurant)
                openingWorkspace = true
            } else {
                if (!temporary || pin.length !== 4) throw new Error('Return to PIN setup and try again.')
                const result = await request('/api/auth/staff-email-login', {
                    email: address, pin: temporary, setupPin: pin,
                    profileData: { name: profile.name.trim() || preview?.name, phone: profile.phone.trim(), avatar_url: profile.avatar || null },
                })
                complete(result.staff, result.restaurant)
                openingWorkspace = true
            }
        } catch (cause) {
            setError(cause instanceof Error && cause.name !== 'TimeoutError' ? cause.message : 'Could not connect. Try again.')
            if (step === 'pin' || step === 'invite') setPin('')
        } finally {
            if (!openingWorkspace) {
                active.current = false
                setBusy(false)
            }
        }
    }

    function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
            setError('Choose an image smaller than 2 MB.')
            return
        }
        setError('')
        const reader = new FileReader()
        reader.onload = () => setProfile(current => ({ ...current, avatar: String(reader.result) }))
        reader.onerror = () => setError('Could not read this image.')
        reader.readAsDataURL(file)
    }

    const limit = step === 'invite' ? 6 : 4
    const description = step === 'email' ? 'Use the email address your manager invited.'
        : step === 'recover' ? 'Enter your staff email to request a reset.'
        : step === 'invite' ? 'Use the six-digit temporary PIN from your invitation.'
        : step === 'new-pin' ? 'Choose a four-digit PIN for future shifts.'
        : step === 'profile' ? 'Check your name and add optional contact details.'
        : `Sign in as ${preview?.name || email}.`
    const buttonText = step === 'recover' ? 'Send reset email' : step === 'pin' ? 'Sign in'
        : step === 'invite' ? 'Verify temporary PIN' : step === 'profile' ? 'Finish staff setup' : 'Continue'
    const showRemember = step === 'pin' || step === 'profile'
    const fieldsDisabled = busy || !online || wait > 0

    return (
        <Account area="Team access" title={headings[step]} description={description}>
            {['invite', 'new-pin', 'profile'].includes(step) && <AccountSteps labels={['Email', 'Temporary PIN', 'New PIN', 'Profile']} current={step === 'invite' ? 1 : step === 'new-pin' ? 2 : 3} />}
            {!online && <AccountNotice error>You’re offline. Reconnect to continue.</AccountNotice>}
            <form className={styles.form} onSubmit={submit}>
                {(step === 'email' || step === 'recover') && <AccountField label="Staff email" type="email" autoComplete="username" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} />}
                {step === 'email' && saved.length > 0 && <details className={styles.divider}>
                    <summary className={styles.textLink}>Use a saved account</summary>
                    <div className={`${styles.stack} mt-2`}>
                        {saved.map(account => <button key={account.email} type="button" disabled={busy} className={styles.secondary} onClick={() => { setEmail(account.email); setRemember(true) }}>{account.name || account.email}{account.restaurantName && ` · ${account.restaurantName}`}</button>)}
                    </div>
                </details>}
                {(step === 'pin' || step === 'invite') && (
                    <div className={`${styles.stack} ${styles.pin}`}>
                        <PasswordField label={step === 'invite' ? 'Temporary PIN' : 'Staff PIN'} inputMode="numeric" autoComplete={step === 'invite' ? 'one-time-code' : 'current-password'}
                            value={pin} maxLength={limit} required disabled={fieldsDisabled} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, limit))} />
                        <details>
                            <summary className={styles.textLink}>Use on-screen keypad</summary>
                            <div className="mt-2 grid grid-cols-3 gap-1.5">
                                {'1234567890'.split('').map(digit => <button key={digit} type="button" className={styles.secondary} disabled={fieldsDisabled || pin.length >= limit} onClick={() => setPin(current => (current + digit).slice(0, limit))}>{digit}</button>)}
                                <button type="button" className={styles.secondary} disabled={fieldsDisabled || !pin} onClick={() => setPin(current => current.slice(0, -1))}>Delete digit</button>
                            </div>
                        </details>
                    </div>
                )}
                {step === 'new-pin' && <div className={`${styles.grid} ${styles.pin}`}>
                    <PasswordField label="New PIN" inputMode="numeric" autoComplete="new-password" maxLength={4} required value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} />
                    <PasswordField label="Confirm PIN" inputMode="numeric" autoComplete="new-password" maxLength={4} required value={confirmed} onChange={event => setConfirmed(event.target.value.replace(/\D/g, '').slice(0, 4))} />
                </div>}
                {step === 'profile' && <>
                    <AccountField label="Full name" autoComplete="name" maxLength={100} value={profile.name} onChange={event => setProfile(current => ({ ...current, name: event.target.value }))} />
                    <AccountField label="Phone (optional)" type="tel" autoComplete="tel" value={profile.phone} onChange={event => setProfile(current => ({ ...current, phone: event.target.value }))} />
                    <AccountField label="Profile photo (optional)" type="file" accept="image/*" onChange={uploadAvatar} />
                    {profile.avatar && <img src={profile.avatar} alt="Selected profile photo" className="size-14 rounded-md object-cover" />}
                </>}
                {showRemember && <label className={styles.check}><input type="checkbox" checked={remember} disabled={busy} onChange={event => setRemember(event.target.checked)} /> Remember this email on this device</label>}
                {notice && <AccountNotice>{notice}</AccountNotice>}
                {error && <AccountNotice error>{error}</AccountNotice>}
                {wait > 0 && <p className={styles.muted}>Try again in {wait}s.</p>}
                <Submit busy={busy} disabled={fieldsDisabled}>{busy ? 'Please wait…' : buttonText}</Submit>
            </form>
            <div className={styles.links}>
                {step === 'invite' && preview?.has_pin && <button type="button" className={styles.textLink} disabled={busy} onClick={() => goTo('pin')}>I remember my PIN</button>}
                {step !== 'email' && <button type="button" className={styles.textLink} disabled={busy} onClick={() => goTo('email')}>Back to staff email</button>}
                {['email', 'pin', 'invite'].includes(step) && <button type="button" className={styles.textLink} disabled={busy} onClick={() => goTo('recover')}>Forgot staff PIN?</button>}
                <Link href="/login">Owner sign-in</Link><Link href="/screen-login">Pair a display</Link>
            </div>
        </Account>
    )
}
