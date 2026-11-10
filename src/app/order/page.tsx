'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { AlertCircle, ArrowRight, Check, Loader2, Plus, ReceiptText, ShoppingBag, Utensils } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useOrderSubmission } from '@/hooks/use-order-submission'
import {
    addDraftLine, changeDraftQuantity, DraftReceipt, MenuFilters, money, orderTotals, ReviewDialog, SearchField, type DraftLine,
} from '@/components/service/ServiceOrder'
import styles from '@/components/service/service-order.module.css'

type Restaurant = { id: string; name: string; logo_url?: string | null; currency: string; tax_rate: number }
type Category = { id: string; name: string }
type MenuItem = {
    id: string
    category_id: string
    name: string
    description?: string | null
    price: number
    image_url?: string | null
    dietary_tags?: string[]
    is_available: boolean
    has_special?: boolean
    special_price?: number | null
}
type Confirmation = { number: number; statusUrl?: string | null; total: number }

export default function OrderPage() {
    return <Suspense fallback={<MenuMessage loading />}><OrderContent /></Suspense>
}

function OrderContent() {
    const search = useSearchParams()
    const slug = search.get('restaurant')
    const table = search.get('table') || ''
    if (!slug) return <MenuMessage message="Scan the QR code at your table to open your restaurant’s menu." />
    return <GuestMenu key={JSON.stringify([slug, table])} slug={slug} table={table} />
}

function MenuMessage({ message, loading, onRetry }: { message?: string; loading?: boolean; onRetry?: () => void }) {
    return (
        <main className={`${styles.page} ${styles.guestTheme} ${styles.messagePage}`}>
            <div className={styles.messageCard} role={loading ? 'status' : undefined}>
                <p className={styles.kicker}>Table ordering</p>
                <h1>{loading ? 'Loading the menu' : 'Menu unavailable'}</h1>
                {loading ? <Loader2 size={20} className="motion-safe:animate-spin" aria-hidden="true" /> : <p className={styles.muted}>{message}</p>}
                {onRetry && <div className={styles.messageActions}><button type="button" onClick={onRetry} className={styles.secondary}>Try again</button></div>}
            </div>
        </main>
    )
}

function readQr() {
    return new URLSearchParams(window.location.hash.slice(1)).get('qr')
}

function GuestMenu({ slug, table }: { slug: string; table: string }) {
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [menuItems, setMenuItems] = useState<MenuItem[]>([])
    const [loadError, setLoadError] = useState<string | null>(null)
    const [attempt, setAttempt] = useState(0)
    const [loading, setLoading] = useState(true)
    const [hasQr, setHasQr] = useState(false)
    const [category, setCategory] = useState<string | null>(null)
    const [query, setQuery] = useState('')
    const [cart, setCart] = useState<DraftLine[]>([])
    const [reviewing, setReviewing] = useState(false)
    const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const sending = useRef(false)
    const confirmedTitle = useRef<HTMLHeadingElement>(null)
    const { submitOrderRequest, completeOrderRequest } = useOrderSubmission()

    useEffect(() => {
        const refreshQr = () => setHasQr(Boolean(readQr()))
        refreshQr()
        window.addEventListener('hashchange', refreshQr)
        return () => window.removeEventListener('hashchange', refreshQr)
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        async function loadMenu() {
            setLoading(true)
            setLoadError(null)
            try {
                const response = await fetch(`/api/v1/menu?restaurant=${encodeURIComponent(slug)}`, { signal: controller.signal })
                const data = await response.json()
                if (!response.ok || !data.restaurant) throw new Error(data.error || 'This menu is unavailable right now.')
                if (controller.signal.aborted) return
                setRestaurant(data.restaurant)
                setCategories(data.categories ?? [])
                setMenuItems(data.items ?? [])
            } catch (error) {
                if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Could not load the menu.')
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }
        void loadMenu()
        return () => controller.abort()
    }, [slug, attempt])

    useEffect(() => {
        if (confirmation) confirmedTitle.current?.focus()
    }, [confirmation])

    const currency = restaurant?.currency || 'PKR'
    const taxRate = Number(restaurant?.tax_rate) || 0
    const totals = orderTotals(cart, taxRate)
    const count = cart.reduce((sum, item) => sum + item.quantity, 0)
    const canOrder = !!table && hasQr
    const needle = query.trim().toLowerCase()
    const items = menuItems.filter(item =>
        item.is_available && (!category || item.category_id === category) &&
        (!needle || [item.name, item.description].some(text => text?.toLowerCase().includes(needle)))
    )

    function addItem(item: MenuItem) {
        setCart(previous => addDraftLine(previous, {
            id: item.id, name: item.name, price: Number(item.has_special && item.special_price != null ? item.special_price : item.price),
        }))
    }

    async function submit() {
        if (!restaurant || !cart.length || sending.current) return
        const qr = readQr()
        if (!table || !qr) {
            setSubmitError('Scan the QR code at your table to send the order.')
            return
        }
        sending.current = true
        setSubmitting(true)
        setSubmitError(null)
        try {
            const response = await submitOrderRequest('/api/v1/orders', {
                restaurant_id: restaurant.id,
                order_type: 'dine_in',
                table_number: table,
                table_qr: qr,
                items: cart.map(line => ({
                    menu_item_id: line.id,
                    quantity: line.quantity,
                    special_instructions: line.notes || undefined,
                })),
            })
            const data = await response.json()
            if (!response.ok || !data.order) throw new Error(data.error || 'Could not submit the order. Try again.')
            completeOrderRequest()
            setReviewing(false)
            setConfirmation({
                number: data.order.order_number,
                total: data.order.total != null ? Number(data.order.total) : totals.total,
                statusUrl: data.status_url,
            })
            setCart([])
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Could not connect. Try again.')
        } finally {
            sending.current = false
            setSubmitting(false)
        }
    }

    if (loading) return <MenuMessage loading />
    if (loadError || !restaurant) return <MenuMessage message={loadError || 'Restaurant not found.'} onRetry={() => setAttempt(previous => previous + 1)} />

    if (confirmation) {
        return (
            <main className={`${styles.page} ${styles.guestTheme} ${styles.messagePage}`}>
                <section className={styles.messageCard} aria-labelledby="order-confirmed">
                    <p className={styles.kicker}>{restaurant.name}</p>
                    <h1 ref={confirmedTitle} id="order-confirmed" tabIndex={-1}>Order received</h1>
                    <p className={styles.success}><Check size={18} aria-hidden="true" /> Your order has been sent to the kitchen.</p>
                    <dl className={styles.totals}>
                        <div><dt>Order</dt><dd>#{confirmation.number}</dd></div>
                        <div><dt>Table</dt><dd>{table}</dd></div>
                        <div><dt>Order total</dt><dd>{money(confirmation.total, currency)}</dd></div>
                    </dl>
                    <div className={styles.messageActions}>
                        {confirmation.statusUrl && <Link className={styles.primary} href={confirmation.statusUrl}>Track order <ArrowRight size={17} aria-hidden="true" /></Link>}
                        <button type="button" className={styles.secondary} onClick={() => setConfirmation(null)}>Back to menu</button>
                    </div>
                </section>
            </main>
        )
    }

    const receipt = (
        <DraftReceipt
            lines={cart} currency={currency} taxRate={taxRate} disabled={submitting}
            onQuantity={(id, delta) => setCart(previous => changeDraftQuantity(previous, id, delta))}
            onNote={(id, notes) => setCart(previous => previous.map(line => line.id === id ? { ...line, notes } : line))}
        />
    )

    return (
        <main className={`${styles.page} ${styles.guestTheme}`}>
            <header className={styles.guestHero}>
                <div className={styles.wrap}>
                    <div className={styles.brandBlock}>
                        <span className={styles.restaurantMark}>{restaurant.logo_url ? <img src={restaurant.logo_url} alt="" /> : <Utensils size={26} aria-hidden="true" />}</span>
                        <div><p className={styles.kicker}>Restaurant menu</p><h1>{restaurant.name}</h1></div>
                    </div>
                    {table && <span className={styles.contextTag}><ReceiptText size={16} aria-hidden="true" /> Table {table}</span>}
                </div>
            </header>

            <div className={`${styles.wrap} ${styles.guestContent} ${styles.split}`}>
                <section className={styles.menuArea} aria-labelledby="guest-menu">
                    <h2 className={styles.sectionTitle} id="guest-menu">The menu</h2>
                    {!canOrder && <p className={styles.notice}><AlertCircle size={17} aria-hidden="true" /> Browse the menu here. To place an order, scan the QR code at your table.</p>}
                    <SearchField value={query} onChange={setQuery} />
                    <MenuFilters categories={categories} selected={category} onSelect={setCategory} />
                    {items.length > 0 ? (
                        <div className={styles.guestMenu}>
                            {items.map(item => {
                                const special = item.has_special && item.special_price != null
                                const quantity = cart.find(line => line.id === item.id)?.quantity
                                return (
                                    <article className={styles.dish} key={item.id}>
                                        <div className={styles.dishCopy}>
                                            {special && <span className={styles.tag}>Special</span>}
                                            <h3>{item.name}</h3>
                                            {item.description && <p>{item.description}</p>}
                                            {item.dietary_tags?.length ? <p className={styles.tag}>{item.dietary_tags.join(' · ')}</p> : null}
                                            <p className={styles.itemPrice}>{money(Number(special ? item.special_price : item.price), currency)} {special && <s>{money(Number(item.price), currency)}</s>}</p>
                                        </div>
                                        <div className={styles.dishSide}>
                                            {item.image_url && <img src={item.image_url} alt="" loading="lazy" />}
                                            <button type="button" className={quantity ? styles.primary : styles.secondary} aria-label={`Add ${item.name}`} onClick={() => addItem(item)}>
                                                <Plus size={16} aria-hidden="true" /> {quantity ? <span className={styles.countBadge}>{quantity}</span> : 'Add'}
                                            </button>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    ) : (
                        <p className={styles.empty}>{query || category ? 'No dishes match. Try another search or category.' : 'There are no dishes available right now.'}</p>
                    )}
                </section>

                <aside className={`${styles.panel} ${styles.receipt} ${styles.desktopReceipt}`} aria-label="Order summary">
                    <header className={styles.panelHead}><div><h2>Your order</h2><p>{count} {count === 1 ? 'item' : 'items'}{table && ` · Table ${table}`}</p></div><ShoppingBag size={20} aria-hidden="true" /></header>
                    <div className={styles.panelBody}>
                        {receipt}
                        <div className={styles.receiptFoot}><button type="button" className={styles.primary} disabled={!count} onClick={() => setReviewing(true)}>Review order <ArrowRight size={17} aria-hidden="true" /></button></div>
                    </div>
                </aside>
            </div>

            {count > 0 && <button type="button" className={`${styles.primary} ${styles.guestCart}`} onClick={() => setReviewing(true)}><span>Review order · {count} {count === 1 ? 'item' : 'items'}</span><strong>{money(totals.total, currency)}</strong></button>}

            {reviewing && (
                <ReviewDialog guest title="Review your order" subtitle={table ? `Table ${table} · ${restaurant.name}` : restaurant.name} busy={submitting} onClose={() => setReviewing(false)}>
                    {receipt}
                    <div className={styles.receiptFoot}>
                        {!canOrder && <p className={styles.notice}>Scan the QR code at your table to send this order.</p>}
                        {submitError && <p className={styles.error} role="alert">{submitError}</p>}
                        <button type="button" className={styles.primary} disabled={!canOrder || !count || submitting} onClick={() => { void submit() }}>
                            {submitting ? 'Sending order…' : 'Send order to kitchen'} <ArrowRight size={17} aria-hidden="true" />
                        </button>
                    </div>
                </ReviewDialog>
            )}
        </main>
    )
}
