'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Account, AccountField, AccountNotice, PasswordField, Submit } from '@/components/account/Account'
import styles from '@/components/account/account.module.css'

export default function ScreenLoginPage() {
    const router = useRouter()
    const [slug, setSlug] = useState('')
    const [code, setCode] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const active = useRef(false)

    async function pair(event: React.FormEvent) {
        event.preventDefault()
        if (active.current || !slug.trim() || !code.trim()) return
        active.current = true
        setBusy(true)
        setError('')
        try {
            const response = await fetch('/api/display/device', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'redeem', slug: slug.toLowerCase().trim(), code: code.trim() }),
            })
            const result = await response.json()
            if (!response.ok || !result.slug) throw new Error(result.error || 'Could not pair this display.')
            router.replace('/display/' + encodeURIComponent(result.slug))
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not pair this display.')
            active.current = false
            setBusy(false)
        }
    }

    return (
        <Account area="Device access" title="Pair a display" description="Enter the display slug and one-time code from Display Manager.">
            <form className={styles.form} onSubmit={pair}>
                <AccountField label="Display slug" placeholder="front-counter" autoCapitalize="none" spellCheck={false} required value={slug} onChange={event => setSlug(event.target.value)} />
                <PasswordField label="Pairing code" autoComplete="one-time-code" maxLength={22} required value={code} onChange={event => setCode(event.target.value)} />
                {error && <AccountNotice error>{error}</AccountNotice>}
                <Submit busy={busy}>{busy ? 'Pairing display…' : 'Pair display'}</Submit>
            </form>
            <p className={styles.muted}>Ask a manager to generate a new code if yours has expired.</p>
            <div className={styles.links}><Link href="/login">Owner sign-in</Link><Link href="/staff-login">Staff sign-in</Link></div>
        </Account>
    )
}
