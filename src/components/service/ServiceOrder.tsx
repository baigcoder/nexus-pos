'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Minus, Plus, ReceiptText, Search, X } from 'lucide-react'
import styles from './service-order.module.css'

export type DraftLine = {
    id: string
    name: string
    price: number
    quantity: number
    notes?: string
}

export function money(value: number, currency = 'PKR') {
    return new Intl.NumberFormat('en-PK', {
        style: 'currency', currency: /^[A-Z]{3}$/.test(currency) ? currency : 'PKR',
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2,
    }).format(value)
}

export function orderTotals(lines: DraftLine[], taxRate: number) {
    const subtotalCents = lines.reduce((sum, line) => sum + Math.round(line.price * 100) * line.quantity, 0)
    const taxRateBasisPoints = Math.round(taxRate * 100)
    const taxCents = Math.round(subtotalCents * taxRateBasisPoints / 10_000)
    return { subtotal: subtotalCents / 100, tax: taxCents / 100, total: (subtotalCents + taxCents) / 100 }
}

export function addDraftLine(lines: DraftLine[], item: Omit<DraftLine, 'quantity'>) {
    const exists = lines.some(line => line.id === item.id)
    return exists ? lines.map(line => line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...lines, { ...item, quantity: 1 }]
}

export function changeDraftQuantity(lines: DraftLine[], id: string, delta: number) {
    return lines.map(line => line.id === id ? { ...line, quantity: line.quantity + delta } : line).filter(line => line.quantity > 0)
}

export function Quantity({ name, value, onChange, min = 0, max, disabled = false }: {
    name: string; value: number; onChange: (delta: number) => void; min?: number; max?: number; disabled?: boolean
}) {
    return (
        <div className={styles.quantity}>
            <button type="button" aria-label={`Decrease ${name}`} disabled={disabled || value <= min} onClick={() => onChange(-1)}><Minus size={15} aria-hidden="true" /></button>
            <span aria-label={`${name} quantity`}>{value}</span>
            <button type="button" aria-label={`Increase ${name}`} disabled={disabled || (max != null && value >= max)} onClick={() => onChange(1)}><Plus size={15} aria-hidden="true" /></button>
        </div>
    )
}

export function SearchField({ value, onChange, placeholder = 'Search the menu' }: {
    value: string; onChange: (value: string) => void; placeholder?: string
}) {
    return (
        <label className={styles.search}>
            <Search size={18} aria-hidden="true" />
            <input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} />
        </label>
    )
}

export function MenuFilters({ categories, selected, onSelect }: {
    categories: { id: string; name: string }[]; selected: string | null; onSelect: (id: string | null) => void
}) {
    if (categories.length === 0) return null
    return (
        <div className={styles.filters} role="group" aria-label="Menu categories">
            <button type="button" aria-pressed={!selected} onClick={() => onSelect(null)}>All items</button>
            {categories.map(category => (
                <button key={category.id} type="button" aria-pressed={selected === category.id} onClick={() => onSelect(category.id)}>{category.name}</button>
            ))}
        </div>
    )
}

export function DraftReceipt({ lines, currency, taxRate, disabled, onQuantity, onNote, deliveryFee = 0, children }: {
    lines: DraftLine[]; currency: string; taxRate: number; disabled: boolean
    onQuantity: (id: string, delta: number) => void; onNote?: (id: string, notes: string) => void; deliveryFee?: number; children?: ReactNode
}) {
    const { subtotal, tax, total } = orderTotals(lines, taxRate)
    return (
        <>
            {lines.length > 0 ? (
                <ul className={styles.lines}>
                    {lines.map(line => (
                        <li key={line.id}>
                            <div className={styles.lineTop}>
                                <div><strong>{line.name}</strong><small>{money(line.price * line.quantity, currency)}</small></div>
                                <Quantity name={line.name} value={line.quantity} disabled={disabled} onChange={delta => onQuantity(line.id, delta)} />
                            </div>
                            {onNote && <label className={styles.lineNote}>
                                <span className="sr-only">{line.name} special instructions</span>
                                <input value={line.notes || ''} disabled={disabled} maxLength={500} placeholder="Add a note" onChange={event => onNote(line.id, event.target.value)} />
                            </label>}
                        </li>
                    ))}
                </ul>
            ) : <p className={styles.empty}><ReceiptText size={24} aria-hidden="true" /> Add a menu item to start the order.</p>}
            {children}
            <dl className={styles.totals}>
                <div><dt>Subtotal</dt><dd>{money(subtotal, currency)}</dd></div>
                {taxRate > 0 && <div><dt>Tax ({taxRate}%)</dt><dd>{money(tax, currency)}</dd></div>}
                {deliveryFee > 0 && <div><dt>Delivery fee</dt><dd>{money(deliveryFee, currency)}</dd></div>}
                <div><dt>Order total</dt><dd>{money(total + deliveryFee, currency)}</dd></div>
            </dl>
        </>
    )
}

export function ReviewDialog({ title, subtitle, busy, guest, dark, onClose, children }: {
    title: string; subtitle?: string; busy?: boolean; guest?: boolean; dark?: boolean; onClose: () => void; children: ReactNode
}) {
    const dialog = useRef<HTMLDialogElement>(null)
    const titleId = useId()

    useEffect(() => {
        const element = dialog.current
        if (!element) return
        element.showModal()
        return () => { element.close() }
    }, [])

    return (
        <dialog
            ref={dialog}
            className={`${styles.dialog} ${guest ? styles.guestTheme : ''} ${dark === undefined ? '' : dark ? styles.guestDark : styles.guestLight}`}
            aria-labelledby={titleId}
            onCancel={event => { event.preventDefault(); if (!busy) onClose() }}
            onClick={event => { if (event.target === event.currentTarget && !busy) onClose() }}
        >
            <div className={styles.dialogPanel}>
                <header className={styles.panelHead}>
                    <div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
                    <button type="button" className={styles.iconButton} aria-label="Close review" disabled={busy} onClick={onClose}><X size={20} aria-hidden="true" /></button>
                </header>
                <div className={styles.dialogBody}>{children}</div>
            </div>
        </dialog>
    )
}
