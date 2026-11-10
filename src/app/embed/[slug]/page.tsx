'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Plus, ShoppingBag, Utensils } from 'lucide-react'
import { useParams, useSearchParams } from 'next/navigation'
import { useOrderSubmission } from '@/hooks/use-order-submission'
import { GuestMessage } from '@/components/service/GuestJourney'
import { addDraftLine, changeDraftQuantity, DraftReceipt, MenuFilters, money, orderTotals, ReviewDialog, SearchField, type DraftLine } from '@/components/service/ServiceOrder'
import styles from '@/components/service/service-order.module.css'
import journey from '@/components/service/guest-journey.module.css'

type Restaurant = { id: string; name: string; logo_url?: string | null; currency: string; tax_rate: number; delivery_fee?: number }
type Item = {
    id: string; name: string; category_id: string; description?: string | null; image_url?: string | null
    price: number; is_available: boolean; has_special?: boolean; special_price?: number | null
}
type Confirmation = { number: number; total: number; url?: string | null }

export default function EmbedOrderPage() {
    const { slug } = useParams<{ slug: string }>()
    const theme = useSearchParams().get('theme') || 'dark'
    return <EmbeddedMenu key={slug} slug={slug} dark={theme === 'dark'} />
}

function EmbeddedMenu({ slug, dark }: { slug: string; dark: boolean }) {
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
    const [items, setItems] = useState<Item[]>([])
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
    const [category, setCategory] = useState<string | null>(null)
    const [query, setQuery] = useState('')
    const [cart, setCart] = useState<DraftLine[]>([])
    const [retry, setRetry] = useState(0)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [checkout, setCheckout] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')
    const [delivery, setDelivery] = useState(false)
    const sending = useRef(false)
    const successTitle = useRef<HTMLHeadingElement>(null)
    const { submitOrderRequest, completeOrderRequest } = useOrderSubmission()

    useEffect(() => {
        const controller = new AbortController()
        async function load() {
            setLoading(true)
            setLoadError('')
            try {
                const response = await fetch(`/api/v1/menu?restaurant=${encodeURIComponent(slug)}`, { signal: controller.signal })
                const data = await response.json()
                if (!response.ok || !data.restaurant) throw new Error(data.error || 'The menu is unavailable right now.')
                if (controller.signal.aborted) return
                setRestaurant(data.restaurant)
                setItems(data.items ?? [])
                setCategories(data.categories ?? [])
            } catch (error) {
                if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'The menu could not be loaded.')
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }
        void load()
        return () => controller.abort()
    }, [slug, retry])

    useEffect(() => {
        if (confirmation) successTitle.current?.focus()
    }, [confirmation])

    const currency = restaurant?.currency || 'PKR'
    const taxRate = Number(restaurant?.tax_rate) || 0
    const deliveryFee = delivery ? Number(restaurant?.delivery_fee) || 0 : 0
    const total = orderTotals(cart, taxRate).total + deliveryFee
    const count = cart.reduce((sum, line) => sum + line.quantity, 0)
    const needle = query.trim().toLowerCase()
    const shown = items.filter(item => item.is_available && (!category || item.category_id === category) &&
        (!needle || [item.name, item.description].some(value => value?.toLowerCase().includes(needle))))
    const theme = `${styles.page} ${styles.guestTheme} ${dark ? styles.guestDark : styles.guestLight}`

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        if (!restaurant || !count || sending.current) return
        if (!name.trim() || !/^[\d\s+()-]{10,20}$/.test(phone.trim()) || (delivery && !address.trim())) {
            setSubmitError('Enter your name, a valid phone number, and a delivery address if applicable.')
            return
        }
        sending.current = true
        setSubmitting(true)
        setSubmitError('')
        try {
            const response = await submitOrderRequest('/api/v1/orders', {
                restaurant_id: restaurant.id, customer_name: name.trim(), customer_phone: phone.trim(),
                delivery_address: delivery ? address.trim() : '', is_delivery: delivery,
                items: cart.map(line => ({ menu_item_id: line.id, quantity: line.quantity })),
            })
            const data = await response.json()
            if (!response.ok || !data.success || !data.order) throw new Error(data.error || 'Could not place the order.')
            completeOrderRequest()
            setConfirmation({
                number: data.order.order_number,
                total: data.order.total != null ? Number(data.order.total) : total,
                url: delivery ? data.tracking_url : data.status_url || data.tracking_url,
            })
            setCheckout(false)
            setCart([])
            if (window.parent !== window) window.parent.postMessage({ type: 'nexus:order_complete', orderNumber: data.order.order_number }, '*')
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Could not place the order. Try again.')
        } finally {
            sending.current = false
            setSubmitting(false)
        }
    }

    if (loading) return <GuestMessage label="Online ordering" title="Loading the menu" loading dark={dark} />
    if (loadError || !restaurant) return <GuestMessage label="Online ordering" title="Menu unavailable" message={loadError || 'Restaurant not found.'} dark={dark} retry={() => setRetry(value => value + 1)} />

    if (confirmation) {
        return (
            <main className={`${theme} ${styles.messagePage}`}>
                <section className={styles.messageCard} aria-labelledby="embedded-confirmation">
                    <p className={styles.kicker}>{restaurant.name}</p>
                    <h1 id="embedded-confirmation" ref={successTitle} tabIndex={-1}>Order received</h1>
                    <p className={styles.success}><Check size={18} aria-hidden="true" /> Your {delivery ? 'delivery' : 'pickup'} order is with the restaurant.</p>
                    <dl className={styles.totals}><div><dt>Order</dt><dd>#{confirmation.number}</dd></div><div><dt>Total</dt><dd>{money(confirmation.total, currency)}</dd></div></dl>
                    <div className={styles.messageActions}>
                        {confirmation.url && <a className={styles.primary} href={confirmation.url} target="_blank" rel="noopener noreferrer">Track order <ArrowRight size={16} aria-hidden="true" /></a>}
                        <button type="button" className={styles.secondary} onClick={() => setConfirmation(null)}>Back to menu</button>
                        {typeof window !== 'undefined' && window.parent !== window && <button type="button" className={styles.secondary} onClick={() => window.parent.postMessage({ type: 'nexus:close' }, '*')}>Close</button>}
                    </div>
                </section>
            </main>
        )
    }

    return (
        <main className={theme}>
            <header className={journey.embedHead}>
                <div className={styles.brandBlock}>
                    <span className={styles.restaurantMark}>{restaurant.logo_url ? <img src={restaurant.logo_url} alt="" /> : <Utensils size={24} aria-hidden="true" />}</span>
                    <div><p className={styles.kicker}>Pickup &amp; delivery</p><h1>{restaurant.name}</h1></div>
                </div>
            </header>
            <div className={`${journey.embedContent} ${styles.menuArea}`}>
                <SearchField value={query} onChange={setQuery} />
                <MenuFilters categories={categories} selected={category} onSelect={setCategory} />
                {shown.length > 0 ? (
                    <div className={styles.guestMenu}>
                        {shown.map(item => {
                            const special = item.has_special && item.special_price != null
                            const price = Number(special ? item.special_price : item.price)
                            const quantity = cart.find(line => line.id === item.id)?.quantity
                            return (
                                <article className={styles.dish} key={item.id}>
                                    <div className={styles.dishCopy}>
                                        {special && <span className={styles.tag}>Special</span>}
                                        <h3>{item.name}</h3>{item.description && <p>{item.description}</p>}
                                        <p className={styles.itemPrice}>{money(price, currency)} {special && <s>{money(Number(item.price), currency)}</s>}</p>
                                    </div>
                                    <div className={styles.dishSide}>
                                        {item.image_url && <img src={item.image_url} alt="" loading="lazy" />}
                                        <button type="button" className={quantity ? styles.primary : styles.secondary} aria-label={`Add ${item.name}`}
                                            onClick={() => setCart(previous => addDraftLine(previous, { id: item.id, name: item.name, price }))}>
                                            <Plus size={16} aria-hidden="true" /> {quantity || 'Add'}
                                        </button>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                ) : <p className={styles.empty}>{query || category ? 'No items match these filters.' : 'There are no items available right now.'}</p>}
            </div>
            {count > 0 && <button type="button" className={`${styles.primary} ${journey.checkoutBar}`} onClick={() => setCheckout(true)}>
                <span className="inline-flex items-center gap-2"><ShoppingBag size={17} aria-hidden="true" /> Checkout · {count} {count === 1 ? 'item' : 'items'}</span>
                <strong>{money(total, currency)}</strong>
            </button>}
            {checkout && (
                <ReviewDialog title="Checkout" subtitle={restaurant.name} guest dark={dark} busy={submitting} onClose={() => setCheckout(false)}>
                    <form onSubmit={submit} className={journey.stack}>
                        <fieldset className={journey.fields} disabled={submitting}>
                            <legend className={journey.sectionLabel}>How will you get your order?</legend>
                            <div className={journey.choices}>
                                <button type="button" className={styles.secondary} aria-pressed={!delivery} onClick={() => setDelivery(false)}>Pickup</button>
                                <button type="button" className={styles.secondary} aria-pressed={delivery} onClick={() => setDelivery(true)}>Delivery</button>
                            </div>
                            <div className={journey.fieldGrid}>
                                <label className={styles.field}>Name<input autoComplete="name" value={name} maxLength={100} required onChange={event => setName(event.target.value)} /></label>
                                <label className={styles.field}>Phone<input type="tel" autoComplete="tel" value={phone} maxLength={20} required onChange={event => setPhone(event.target.value)} /></label>
                            </div>
                            {delivery && <label className={styles.field}>Delivery address<textarea autoComplete="street-address" value={address} rows={2} maxLength={500} required onChange={event => setAddress(event.target.value)} /></label>}
                        </fieldset>
                        <div>
                            <DraftReceipt lines={cart} currency={currency} taxRate={taxRate} deliveryFee={deliveryFee} disabled={submitting}
                                onQuantity={(id, delta) => setCart(previous => changeDraftQuantity(previous, id, delta))} />
                            {delivery && <p className={journey.intro}>Pay on delivery.</p>}
                        </div>
                        {submitError && <p className={styles.error} role="alert">{submitError}</p>}
                        <button type="submit" className={styles.primary} disabled={!count || submitting}>{submitting ? 'Placing order…' : 'Place order'} <ArrowRight size={16} aria-hidden="true" /></button>
                    </form>
                </ReviewDialog>
            )}
        </main>
    )
}
