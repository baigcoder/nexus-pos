'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Account, AccountField, AccountNotice, AccountSteps, Submit } from '@/components/account/Account'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import styles from '@/components/account/account.module.css'

const steps = ['Restaurant', 'Contact & billing', 'Service hours']
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
type Hours = { open: string; close: string; closed: boolean }

export default function SetupPage() {
    const router = useRouter()
    const setRestaurant = useAuthStore(state => state.setRestaurant)
    const [step, setStep] = useState(0)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', currency: 'PKR', taxRate: '16' })
    const [hours, setHours] = useState<Record<string, Hours>>(() =>
        Object.fromEntries(days.map((day, index) => [day, { open: '10:00', close: index >= 5 ? '23:00' : '22:00', closed: false }]))
    )
    const active = useRef(false)
    const heading = useRef<HTMLHeadingElement>(null)
    const touchedStep = useRef(false)

    useEffect(() => {
        let cancelled = false
        async function prefill() {
            try {
                const { data: { user } } = await createClient().auth.getUser()
                if (!cancelled && user) {
                    const restaurantName = user.user_metadata?.restaurant_name
                    setForm(current => ({ ...current, name: current.name || (typeof restaurantName === 'string' ? restaurantName : ''), email: current.email || user.email || '' }))
                }
            } catch {
                // The fields are still available when prefill fails.
            }
        }
        void prefill()
        return () => { cancelled = true }
    }, [])

    useEffect(() => {
        if (touchedStep.current) {
            heading.current?.focus({ preventScroll: true })
            heading.current?.scrollIntoView({ block: 'start' })
        }
    }, [step])

    const edit = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm(current => ({ ...current, [key]: event.target.value }))
    }
    const editHours = (day: string, changes: Partial<Hours>) => {
        setHours(current => ({ ...current, [day]: { ...current[day], ...changes } }))
    }

    function goTo(value: number) {
        touchedStep.current = true
        setError('')
        setStep(value)
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        if (active.current) return
        if (step === 0 && (!form.name.trim() || !form.address.trim())) return setError('Enter a restaurant name and address.')
        if (step === 1 && !form.phone.trim()) return setError('Enter a business phone number.')
        if (step < 2) return goTo(step + 1)
        active.current = true
        setBusy(true)
        setError('')
        try {
            const response = await fetch('/api/setup/create-restaurant', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim(), slug: form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                    address: form.address.trim(), phone: form.phone.trim(), email: form.email.trim(),
                    currency: form.currency, tax_rate: Number(form.taxRate), operating_hours: hours,
                }),
            })
            const data = await response.json()
            if (!response.ok || !data.restaurant) throw new Error(data.error || 'Could not create the restaurant.')
            setRestaurant(data.restaurant)
            router.replace('/dashboard')
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not create the restaurant.')
            active.current = false
            setBusy(false)
        }
    }

    return (
        <Account area="Restaurant setup" title="Set up your first location" description="Add the details your team will use for daily service." wide>
            <AccountSteps labels={steps} current={step} />
            <form className={styles.form} onSubmit={submit}>
                <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-bold">{steps[step]}</h2>
                {step === 0 && <div className={styles.grid}>
                    <AccountField label="Restaurant name" autoComplete="organization" value={form.name} required maxLength={100} onChange={edit('name')} />
                    <AccountField label="Street address" autoComplete="street-address" value={form.address} required onChange={edit('address')} />
                </div>}
                {step === 1 && <div className={styles.grid}>
                    <AccountField label="Business phone" type="tel" autoComplete="tel" value={form.phone} required onChange={edit('phone')} />
                    <AccountField label="Business email" type="email" autoComplete="email" value={form.email} required onChange={edit('email')} />
                    <label className={styles.field}>Currency<select value={form.currency} onChange={edit('currency')}><option value="PKR">PKR · Pakistani rupee</option><option value="USD">USD · US dollar</option><option value="EUR">EUR · Euro</option><option value="GBP">GBP · British pound</option></select></label>
                    <AccountField label="Tax rate (%)" type="number" min={0} max={100} step="0.01" required value={form.taxRate} onChange={edit('taxRate')} />
                </div>}
                {step === 2 && (
                    <div className={styles.hours}>
                        <p className={styles.muted}>Set hours for each day, or mark it closed.</p>
                        {days.map(day => (
                            <div className={styles.day} key={day}>
                                <strong>{day}</strong>
                                <label className={styles.check}><input type="checkbox" checked={hours[day].closed} disabled={busy} aria-label={`${day} closed`} onChange={event => editHours(day, { closed: event.target.checked })} /> Closed</label>
                                {!hours[day].closed && <>
                                    <AccountField label="Opens" aria-label={`${day} opens`} type="time" value={hours[day].open} required disabled={busy} onChange={event => editHours(day, { open: event.target.value })} />
                                    <AccountField label="Closes" aria-label={`${day} closes`} type="time" value={hours[day].close} required disabled={busy} onChange={event => editHours(day, { close: event.target.value })} />
                                </>}
                            </div>
                        ))}
                    </div>
                )}
                {error && <AccountNotice error>{error}</AccountNotice>}
                <div className="flex flex-wrap gap-2">
                    {step > 0 && <button type="button" className={styles.secondary} disabled={busy} onClick={() => goTo(step - 1)}>Back</button>}
                    <Submit busy={busy}>{busy ? 'Creating location…' : step === 2 ? 'Create restaurant' : 'Continue'}</Submit>
                </div>
            </form>
        </Account>
    )
}
