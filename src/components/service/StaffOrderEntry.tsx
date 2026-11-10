'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bell, Check, ChefHat, Loader2, Plus, RefreshCw, ShoppingBag } from 'lucide-react'
import { useOrderSubmission } from '@/hooks/use-order-submission'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import type { Restaurant } from '@/types'
import {
    addDraftLine, changeDraftQuantity, DraftReceipt, MenuFilters, money, orderTotals, Quantity, ReviewDialog, SearchField, type DraftLine,
} from './ServiceOrder'
import styles from './service-order.module.css'

type MenuItem = {
    id: string; name: string; price: number; category?: string | null; category_id?: string | null
    description?: string | null; image_url?: string | null; is_available: boolean; preparation_time?: number
}
type Table = { id: string; table_number: number; capacity?: number; status: string; current_waiter_id?: string | null; customer_count?: number }
type Category = { id: string; name: string }
type Alert = { id: string; is_read: boolean; title?: string; message?: string }

const tableStatus: Record<string, string> = {
    available: 'Available', occupied: 'Occupied', reserved: 'Reserved', billing: 'At checkout', cleaning: 'Cleaning',
}

export default function StaffOrderEntry({ device = false }: { device?: boolean }) {
    const { restaurant, staff } = useAuthStore()
    return restaurant ? (
        <OrderEntry key={restaurant.id} restaurant={restaurant} staffId={staff?.id} staffName={staff?.name} device={device} />
    ) : (
        <main className={`${styles.page}  ${styles.standalone}`}>
            <h1 className={styles.sectionTitle}>Take an order</h1>
            <p className={styles.empty}>Your account needs a linked restaurant to take orders.</p>
        </main>
    )
}

function OrderEntry({ restaurant, staffId, staffName, device }: {
    restaurant: Restaurant; staffId?: string; staffName?: string; device: boolean
}) {
    const [menu, setMenu] = useState<MenuItem[]>([])
    const [tables, setTables] = useState<Table[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [tableId, setTableId] = useState('')
    const [covers, setCovers] = useState(1)
    const [query, setQuery] = useState('')
    const [category, setCategory] = useState<string | null>(null)
    const [cart, setCart] = useState<DraftLine[]>([])
    const [notes, setNotes] = useState('')
    const [loadError, setLoadError] = useState('')
    const [actionError, setActionError] = useState('')
    const [loading, setLoading] = useState(true)
    const [refresh, setRefresh] = useState(0)
    const [reviewing, setReviewing] = useState(false)
    const [sending, setSending] = useState(false)
    const [assigning, setAssigning] = useState(false)
    const [confirmation, setConfirmation] = useState<{ number: number; table: number } | null>(null)
    const confirmationNotice = useRef<HTMLParagraphElement>(null)
    const sendingRef = useRef(false)
    const assigningRef = useRef(false)
    const { submitOrderRequest, completeOrderRequest } = useOrderSubmission()

    useEffect(() => {
        const controller = new AbortController()
        let currentRequest = 0
        async function load() {
            const request = ++currentRequest
            try {
                if (device) {
                    const [tableResponse, menuResponse] = await Promise.all([
                        fetch('/api/order-flow?view=tables', { signal: controller.signal }),
                        fetch(`/api/v1/menu?restaurant=${encodeURIComponent(restaurant.slug)}`, { signal: controller.signal }),
                    ])
                    const [tableData, menuData] = await Promise.all([tableResponse.json(), menuResponse.json()])
                    if (!tableResponse.ok || !menuResponse.ok) throw new Error(tableData.error || menuData.error || 'Could not load tables and menu.')
                    if (controller.signal.aborted || request !== currentRequest) return
                    setTables(tableData.tables ?? [])
                    setCategories(menuData.categories ?? [])
                    setMenu((menuData.items ?? []).filter((item: MenuItem) => item.is_available))
                } else {
                    const client = createClient()
                    const [menuResult, tableResult] = await Promise.all([
                        client.from('menu_items').select('id, name, price, category, description, image_url, is_available').eq('restaurant_id', restaurant.id).eq('is_available', true).order('category').abortSignal(controller.signal),
                        client.from('tables').select('id, table_number, capacity, status, customer_count').eq('restaurant_id', restaurant.id).order('table_number').abortSignal(controller.signal),
                    ])
                    if (menuResult.error || tableResult.error) throw new Error(menuResult.error?.message || tableResult.error?.message || 'Could not load tables and menu.')
                    if (controller.signal.aborted || request !== currentRequest) return
                    const items = (menuResult.data ?? []) as MenuItem[]
                    setMenu(items)
                    setTables((tableResult.data ?? []) as Table[])
                    setCategories([...new Set(items.flatMap(item => item.category ? [item.category] : []))].map(name => ({ id: name, name })))
                }
                setLoadError('')
            } catch (error) {
                if (!controller.signal.aborted && request === currentRequest) setLoadError(error instanceof Error ? error.message : 'Could not load tables and menu.')
            } finally {
                if (!controller.signal.aborted && request === currentRequest) setLoading(false)
            }
        }

        async function loadAlerts() {
            if (!device || !staffId) return
            try {
                const response = await fetch('/api/staff/alerts', { signal: controller.signal })
                if (!response.ok) return
                const data = await response.json()
                if (!controller.signal.aborted) setAlerts((data.alerts ?? []).filter((alert: Alert) => !alert.is_read))
            } catch {
                // Keep ordering available if alerts fail to load.
            }
        }

        function loadStation() {
            void load()
            void loadAlerts()
        }

        loadStation()
        const interval = device ? window.setInterval(loadStation, 15000) : undefined
        return () => {
            controller.abort()
            window.clearInterval(interval)
        }
    }, [restaurant.id, restaurant.slug, staffId, device, refresh])

    useEffect(() => {
        if (confirmation) confirmationNotice.current?.focus()
    }, [confirmation])

    const currency = restaurant.currency || 'PKR'
    const taxRate = Number(restaurant.tax_rate) || 0
    const { total } = orderTotals(cart, taxRate)
    const count = cart.reduce((sum, item) => sum + item.quantity, 0)
    const table = tables.find(entry => entry.id === tableId)
    const mustAssign = device && table && !table.current_waiter_id && ['available', 'reserved'].includes(table.status)
    const canSend = !!table && table.status !== 'billing' && (!device || (
        !mustAssign && (!table.current_waiter_id || table.current_waiter_id === staffId)
    ))
    const tableHelp = !table ? 'Select a table before sending.'
        : table.status === 'billing' ? 'This table is at checkout. Choose another table.'
        : mustAssign ? 'Assign this table to yourself before sending.'
        : 'This table is assigned to another waiter.'
    const locked = sending || assigning
    const needle = query.trim().toLowerCase()
    const items = menu.filter(item =>
        (!category || (device ? item.category_id : item.category) === category) &&
        (!needle || [item.name, item.description].some(text => text?.toLowerCase().includes(needle)))
    )

    async function assign() {
        if (!mustAssign || !table || !staffId || assigningRef.current) return
        assigningRef.current = true
        setAssigning(true)
        setActionError('')
        try {
            const response = await fetch('/api/order-flow', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'assign_table', data: { table_id: table.id, waiter_id: staffId, customer_count: covers } }),
            })
            const data = await response.json()
            if (!response.ok || data.success === false) throw new Error(data.error || 'Could not assign this table.')
            setTables(previous => previous.map(entry => entry.id === table.id ? { ...entry, current_waiter_id: staffId, status: 'occupied' } : entry))
            setRefresh(previous => previous + 1)
        } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Could not assign this table.')
        } finally {
            assigningRef.current = false
            setAssigning(false)
        }
    }

    async function send() {
        if (!canSend || !table || count === 0 || sendingRef.current) return
        sendingRef.current = true
        setSending(true)
        setActionError('')
        try {
            const response = await submitOrderRequest('/api/order-flow', {
                action: 'create_order',
                data: {
                    table_id: table.id, customer_count: covers, notes: notes || undefined,
                    items: cart.map(line => ({ menu_item_id: line.id, quantity: line.quantity, notes: line.notes || null })),
                },
            })
            const data = await response.json()
            if (!response.ok || !data.success || !data.order) throw new Error(data.error || 'Could not send this order.')
            completeOrderRequest()
            setConfirmation({ number: data.order.order_number, table: table.table_number })
            setCart([])
            setTableId('')
            setCovers(1)
            setNotes('')
            setReviewing(false)
            setRefresh(previous => previous + 1)
        } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Could not send this order.')
        } finally {
            sendingRef.current = false
            setSending(false)
        }
    }

    const receipt = (
        <>
            <DraftReceipt lines={cart} currency={currency} taxRate={taxRate} disabled={locked}
                onQuantity={(id, delta) => setCart(previous => changeDraftQuantity(previous, id, delta))}
                onNote={(id, value) => setCart(previous => previous.map(line => line.id === id ? { ...line, notes: value } : line))}
            >
                {count > 0 && <label className={`${styles.field} mt-2`}>Order note<textarea rows={2} maxLength={500} value={notes} disabled={locked} onChange={event => setNotes(event.target.value)} /></label>}
            </DraftReceipt>
            <div className={styles.receiptFoot}>
                {!canSend && <p className={styles.muted}>{tableHelp}</p>}
                {actionError && <p className={styles.error} role="alert">{actionError}</p>}
                <button type="button" className={styles.primary} disabled={locked || !canSend || !count} onClick={() => { void send() }}>
                    <ChefHat size={18} aria-hidden="true" /> {sending ? 'Sending order…' : 'Send to kitchen'}
                </button>
            </div>
        </>
    )

    return (
        <section className={`${styles.page}  ${device ? styles.standalone : ''}`} aria-labelledby="take-order-title">
            <header className={styles.stationHead}>
                <div>
                    <p className={styles.kicker}>Floor service</p>
                    <h1 id="take-order-title">Take an order</h1>
                    <p>{restaurant.name}{staffName && ` · ${staffName}`}</p>
                </div>
                <button type="button" className={styles.secondary} onClick={() => setRefresh(previous => previous + 1)} disabled={locked || loading}>
                    <RefreshCw size={16} aria-hidden="true" /> Refresh menu &amp; tables
                </button>
            </header>
            {confirmation && <p className={`${styles.success} mb-3`} role="status" ref={confirmationNotice} tabIndex={-1}><Check size={19} aria-hidden="true" /> Order #{confirmation.number} for table {confirmation.table} was sent to the kitchen.</p>}
            {alerts.length > 0 && (
                <details className={`${styles.panel} mb-3`}>
                    <summary className={`${styles.panelHead} cursor-pointer`}><span className="inline-flex items-center gap-2"><Bell size={17} aria-hidden="true" /> {alerts.length} unread {alerts.length === 1 ? 'alert' : 'alerts'}</span></summary>
                    <ul className={styles.panelBody}>{alerts.map(alert => <li key={alert.id} className="py-1">{alert.title}{alert.message && ` · ${alert.message}`}</li>)}</ul>
                </details>
            )}
            {loadError && <p className={`${styles.error} mb-3`} role="alert">{loadError}</p>}

            <div className={styles.split}>
                <div className={styles.menuArea}>
                    <div className={styles.tableContext}>
                        <label className={styles.field}>Table
                            <select value={tableId} disabled={locked || loading} onChange={event => {
                                const selected = tables.find(entry => entry.id === event.target.value)
                                setTableId(event.target.value)
                                setCovers(Math.max(1, selected?.customer_count || 1))
                                setActionError('')
                            }}>
                                <option value="">Choose a table</option>
                                {tables.map(entry => {
                                    const assignedElsewhere = device && !!entry.current_waiter_id && entry.current_waiter_id !== staffId
                                    return (
                                        <option key={entry.id} value={entry.id} disabled={entry.status === 'billing' || (device && assignedElsewhere)}>
                                            Table {entry.table_number} · {assignedElsewhere ? 'Assigned' : tableStatus[entry.status] || entry.status}
                                        </option>
                                    )
                                })}
                            </select>
                        </label>
                        <div className={styles.field}>Guests<Quantity name="guest count" value={covers} min={1} disabled={locked} onChange={delta => setCovers(previous => Math.max(1, previous + delta))} /></div>
                    </div>
                    {mustAssign && <div><button type="button" className={styles.secondary} disabled={!staffId || locked} onClick={() => { void assign() }}>{assigning ? 'Assigning…' : 'Assign table to me'}</button></div>}
                    {mustAssign && actionError && <p className={styles.error} role="alert">{actionError}</p>}

                    <h2 className={styles.sectionTitle}>Menu</h2>
                    <SearchField value={query} onChange={setQuery} />
                    <MenuFilters categories={categories} selected={category} onSelect={setCategory} />
                    {loading ? (
                        <p className={styles.empty} role="status"><Loader2 size={20} className="motion-safe:animate-spin" aria-hidden="true" /> Loading menu and tables…</p>
                    ) : items.length > 0 ? (
                        <div className={styles.staffMenu}>
                            {items.map(item => {
                                const quantity = cart.find(line => line.id === item.id)?.quantity
                                return (
                                    <article className={styles.dish} key={item.id}>
                                        <div className={styles.dishCopy}>
                                            <h3>{item.name}</h3>
                                            {item.description && <p>{item.description}</p>}
                                            {!!item.preparation_time && <p>{item.preparation_time} min prep</p>}
                                            <p className={styles.itemPrice}>{money(Number(item.price), currency)}</p>
                                        </div>
                                        <div className={styles.dishSide}>
                                            {item.image_url && <img src={item.image_url} alt="" loading="lazy" />}
                                            <button type="button" className={quantity ? styles.primary : styles.secondary} aria-label={`Add ${item.name}`} disabled={locked}
                                                onClick={() => { setConfirmation(null); setCart(previous => addDraftLine(previous, { id: item.id, name: item.name, price: Number(item.price) })) }}>
                                                <Plus size={16} aria-hidden="true" /> {quantity ? <span className={styles.countBadge}>{quantity}</span> : 'Add'}
                                            </button>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    ) : <p className={styles.empty}>{loadError ? 'Refresh to try loading the menu again.' : query || category ? 'No items match these filters.' : 'No menu items are available.'}</p>}
                </div>

                <aside className={`${styles.panel} ${styles.receipt} ${styles.desktopReceipt}`} aria-label="Kitchen ticket">
                    <header className={styles.panelHead}><div><h2>Kitchen ticket</h2><p>{table ? `Table ${table.table_number}` : 'Choose a table'} · {covers} {covers === 1 ? 'guest' : 'guests'}</p></div><ShoppingBag size={19} aria-hidden="true" /></header>
                    <div className={styles.panelBody}>{receipt}</div>
                </aside>
            </div>

            {count > 0 && (
                <div className={styles.mobileBar}>
                    <span>{table ? `Table ${table.table_number}` : 'Choose a table'}<strong>{money(total, currency)} · {count} {count === 1 ? 'item' : 'items'}</strong></span>
                    <button type="button" className={styles.primary} onClick={() => setReviewing(true)}>Review ticket <ArrowRight size={16} aria-hidden="true" /></button>
                </div>
            )}
            {reviewing && (
                <ReviewDialog title="Review kitchen ticket" subtitle={table ? `Table ${table.table_number} · ${covers} ${covers === 1 ? 'guest' : 'guests'}` : 'Choose a table'} busy={sending} onClose={() => setReviewing(false)}>
                    {receipt}
                </ReviewDialog>
            )}
        </section>
    )
}
