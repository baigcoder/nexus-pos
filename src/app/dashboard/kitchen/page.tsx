'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
    BarChart3, Bell, Check, ChefHat, ChevronDown, Clock3, Loader2, Maximize, Minimize,
    Pause, Play, RefreshCw, Ticket, Volume2, VolumeX,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { getDisplayRoleLabels } from '@/lib/display-access'
import { playNewOrderSound } from '@/lib/sounds'
import { useRestaurantId } from '@/stores/auth-store'
import type { DisplayType } from '@/types/display'
import styles from './kitchen.module.css'

type QueueStatus = 'pending' | 'preparing' | 'ready'
type QueueFilter = QueueStatus | 'all'

interface OrderItem {
    id: string
    quantity: number
    menu_item?: { name: string }
    special_instructions?: string
    customizations?: Array<{ selected_options?: Array<{ option_name: string }> }>
}

interface Order {
    id: string
    order_number: number
    table_id: string | null
    status: QueueStatus
    created_at: string
    notes?: string
    is_priority?: boolean
    items?: OrderItem[]
    table?: { table_number: number }
}

interface LinkedDisplay {
    id: string
    type: DisplayType
    is_active: boolean
}

const lanes = [
    { status: 'pending', label: 'Received', empty: 'No new tickets', action: 'Start prep', operation: 'kitchen_start', next: 'preparing', icon: ChefHat },
    { status: 'preparing', label: 'In prep', empty: 'Nothing in prep', action: 'Mark ready', operation: 'kitchen_ready', next: 'ready', icon: Check },
    { status: 'ready', label: 'Ready', empty: 'Nothing waiting for handoff', action: 'Complete handoff', operation: 'serve_order', next: null, icon: Bell },
] as const

const activeStatuses = lanes.map(lane => lane.status)

const displayGroups = [
    { type: 'kitchen', label: 'Kitchen displays' },
    { type: 'counter', label: 'Counter handoff' },
    { type: 'cashier', label: 'Cashier display' },
] as const

const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

function elapsedSeconds(createdAt: string, now: number) {
    return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000))
}

function ticketAge(seconds: number) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function KitchenPage() {
    const restaurantId = useRestaurantId()
    return <KitchenQueue key={restaurantId} restaurantId={restaurantId} />
}

function KitchenQueue({ restaurantId }: { restaurantId?: string }) {
    const { success, error: showError } = useToast()
    const supabase = createClient()
    const [orders, setOrders] = useState<Order[]>([])
    const [filter, setFilter] = useState<QueueFilter>('all')
    const [loading, setLoading] = useState(true)
    const [now, setNow] = useState(() => Date.now())
    const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set())
    const [fullscreen, setFullscreen] = useState(false)
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
    const [syncing, setSyncing] = useState(false)
    const [connected, setConnected] = useState(false)
    const [queueError, setQueueError] = useState(false)
    const [showSummary, setShowSummary] = useState(false)
    const [paused, setPaused] = useState(false)
    const [linkedDisplays, setLinkedDisplays] = useState<LinkedDisplay[]>([])
    const board = useRef<HTMLElement>(null)
    const title = useRef<HTMLHeadingElement>(null)
    const knownOrderIds = useRef<Set<string> | null>(null)
    const requestVersion = useRef(0)
    const inFlightActions = useRef(new Set<string>())
    const sound = useRef(true)

    const loadOrders = useCallback(async () => {
        if (!restaurantId) return
        const version = ++requestVersion.current
        setSyncing(true)
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id, order_number, table_id, status, created_at, notes, is_priority,
                    items:order_items(id, quantity, menu_item:menu_items(name), special_instructions, customizations),
                    table:tables(table_number)
                `)
                .eq('restaurant_id', restaurantId)
                .in('status', activeStatuses)
                .gte('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: true })

            if (version !== requestVersion.current) return
            if (error) throw error

            const nextOrders = (data ?? []) as unknown as Order[]
            const seen = knownOrderIds.current
            if (sound.current && seen && nextOrders.some(order => order.status === 'pending' && !seen.has(order.id))) {
                playNewOrderSound()
            }
            knownOrderIds.current = new Set(nextOrders.map(order => order.id))
            setOrders(nextOrders)
            setLastUpdate(new Date())
            setQueueError(false)
        } catch {
            if (version === requestVersion.current) setQueueError(true)
        } finally {
            if (version === requestVersion.current) {
                setLoading(false)
                setSyncing(false)
            }
        }
    }, [restaurantId, supabase])

    const loadDisplays = useCallback(async () => {
        if (!restaurantId) return
        const { data } = await supabase
            .from('displays')
            .select('id, type, is_active')
            .eq('restaurant_id', restaurantId)
            .in('type', displayGroups.map(group => group.type))
        if (data) setLinkedDisplays(data as LinkedDisplay[])
    }, [restaurantId, supabase])

    useEffect(() => {
        if (!restaurantId) return
        void loadOrders()
        void loadDisplays()
        return () => {
            requestVersion.current++
            knownOrderIds.current = null
        }
    }, [restaurantId, loadOrders, loadDisplays])

    useEffect(() => {
        if (!restaurantId || paused) return
        let active = true
        const channel = supabase
            .channel('kitchen-orders')
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}`,
            }, () => { void loadOrders() })
            .subscribe((status: string) => {
                if (!active) return
                setConnected(status === 'SUBSCRIBED')
                if (status === 'SUBSCRIBED') void loadOrders()
            })

        return () => {
            active = false
            void supabase.removeChannel(channel)
        }
    }, [restaurantId, supabase, paused, loadOrders])

    useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), 1000)
        const syncFullscreen = () => setFullscreen(document.fullscreenElement === board.current)
        document.addEventListener('fullscreenchange', syncFullscreen)
        return () => {
            window.clearInterval(interval)
            document.removeEventListener('fullscreenchange', syncFullscreen)
        }
    }, [])

    const groupedOrders = useMemo(() => {
        const grouped: Record<QueueStatus, Order[]> = { pending: [], preparing: [], ready: [] }
        for (const order of orders) grouped[order.status]?.push(order)
        for (const lane of lanes) {
            grouped[lane.status].sort((a, b) =>
                Number(Boolean(b.is_priority)) - Number(Boolean(a.is_priority)) ||
                a.created_at.localeCompare(b.created_at)
            )
        }
        return grouped
    }, [orders])

    const refresh = () => {
        void loadOrders()
        void loadDisplays()
    }

    const toggleFullscreen = async () => {
        try {
            if (document.fullscreenElement === board.current) await document.exitFullscreen()
            else await board.current?.requestFullscreen()
        } catch {
            showError('Fullscreen unavailable', 'This browser could not switch the kitchen to fullscreen.')
        }
    }

    const advanceOrder = async (order: Order, lane: (typeof lanes)[number], button: HTMLButtonElement) => {
        if (inFlightActions.current.has(order.id)) return
        const hadFocus = document.activeElement === button
        inFlightActions.current.add(order.id)
        setUpdatingOrders(new Set(inFlightActions.current))

        try {
            const response = await fetch('/api/order-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: lane.operation, data: { order_id: order.id } }),
            })
            const result = await response.json()
            if (!response.ok || !result.success) throw new Error(result.error || 'Could not update this ticket.')

            if (hadFocus && (document.activeElement === button || document.activeElement === document.body)) {
                title.current?.focus()
            }
            setOrders(previous => previous.flatMap(ticket => {
                if (ticket.id !== order.id) return [ticket]
                return lane.next ? [{ ...ticket, status: lane.next }] : []
            }))
            success(`Order #${order.order_number}`, lane.next ? `Moved to ${lanes.find(step => step.status === lane.next)?.label.toLowerCase()}` : 'Handoff complete')
        } catch (error) {
            showError('Ticket update failed', error instanceof Error ? error.message : 'Could not update this ticket.')
        } finally {
            inFlightActions.current.delete(order.id)
            setUpdatingOrders(new Set(inFlightActions.current))
            void loadOrders()
        }
    }

    const connectionLabel = !restaurantId ? 'No restaurant linked'
        : paused ? 'Updates paused'
        : queueError ? 'Sync failed'
        : connected && lastUpdate ? 'Live updates'
        : lastUpdate ? 'Reconnecting'
        : 'Connecting'

    return (
        <section ref={board} className={styles.board} aria-labelledby="kitchen-title">
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}><span /> NEXUSPOS / KITCHEN</p>
                    <h1 id="kitchen-title" ref={title} tabIndex={-1}>Kitchen queue</h1>
                </div>
                <div className={styles.tools}>
                    <div className={styles.sync}>
                        <span role="status" data-live={connected && !!lastUpdate && !paused && !queueError}>{connectionLabel}</span>
                        {lastUpdate && <time dateTime={lastUpdate.toISOString()}>Last sync {clock.format(lastUpdate)}</time>}
                    </div>
                    <div className={styles.controls}>
                        <HeaderButton icon={RefreshCw} label="Refresh tickets" onClick={refresh} disabled={syncing || !restaurantId} />
                        <HeaderButton icon={paused ? Play : Pause} label={paused ? 'Resume live updates' : 'Pause live updates'} onClick={() => {
                            if (!paused) setConnected(false)
                            setPaused(!paused)
                        }} pressed={paused} />
                        <HeaderButton icon={soundEnabled ? Volume2 : VolumeX} label={soundEnabled ? 'Mute ticket sounds' : 'Enable ticket sounds'} onClick={() => {
                            sound.current = !soundEnabled
                            setSoundEnabled(!soundEnabled)
                        }} pressed={!soundEnabled} />
                        <HeaderButton icon={fullscreen ? Minimize : Maximize} label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={() => { void toggleFullscreen() }} pressed={fullscreen} />
                    </div>
                </div>
            </header>

            <div className={styles.toolbar}>
                <div className={styles.filters} role="group" aria-label="Filter kitchen tickets">
                    <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All <span>{orders.length}</span></button>
                    {lanes.map(lane => (
                        <button key={lane.status} type="button" aria-pressed={filter === lane.status} onClick={() => setFilter(lane.status)}>
                            {lane.label} <span>{groupedOrders[lane.status].length}</span>
                        </button>
                    ))}
                </div>
                <button type="button" className={styles.summaryToggle} onClick={() => setShowSummary(!showSummary)} aria-expanded={showSummary} aria-controls="kitchen-summary">
                    <BarChart3 size={17} aria-hidden="true" /> Station overview <ChevronDown size={15} aria-hidden="true" />
                </button>
            </div>

            {showSummary && (
                <div id="kitchen-summary" className={styles.summary}>
                    <div><p>Open tickets</p><strong>{orders.length}</strong><small>{groupedOrders.pending.length} received · {groupedOrders.preparing.length} in prep · {groupedOrders.ready.length} ready</small></div>
                    {displayGroups.map(group => {
                        const displays = linkedDisplays.filter(display => display.type === group.type)
                        return <div key={group.type}><p>{group.label}</p><strong>{displays.filter(display => display.is_active).length} / {displays.length}</strong><small>Enabled · {getDisplayRoleLabels(group.type).join(', ')}</small></div>
                    })}
                </div>
            )}

            {queueError && <div role="alert" className={styles.error}>Couldn’t load tickets. {lastUpdate && 'Showing tickets from the last successful sync.'} <button type="button" onClick={refresh}>Try again</button></div>}

            {!restaurantId ? (
                <p className={styles.queueMessage}>Kitchen tickets will be available when your account is linked to a restaurant.</p>
            ) : loading ? (
                <p role="status" className={styles.queueMessage}><Loader2 size={19} className="motion-safe:animate-spin" aria-hidden="true" /> Loading kitchen tickets…</p>
            ) : (lastUpdate || !queueError) && (
                <div className={styles.lanes} data-single={filter !== 'all'}>
                    {lanes.filter(lane => filter === 'all' || filter === lane.status).map(lane => (
                        <section key={lane.status} className={styles.lane} data-status={lane.status} aria-label={lane.label}>
                            <div className={styles.laneHeader}><h2><span /> {lane.label}</h2><span>{groupedOrders[lane.status].length}</span></div>
                            <div className={styles.tickets}>
                                {groupedOrders[lane.status].map(order => (
                                    <OrderCard key={order.id} order={order} lane={lane} age={elapsedSeconds(order.created_at, now)} updating={updatingOrders.has(order.id)} onAction={button => { void advanceOrder(order, lane, button) }} />
                                ))}
                                {groupedOrders[lane.status].length === 0 && <p className={styles.empty}><Ticket size={19} aria-hidden="true" /> {lane.empty}</p>}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </section>
    )
}

function OrderCard({ order, lane, age, updating, onAction }: {
    order: Order
    lane: (typeof lanes)[number]
    age: number
    updating: boolean
    onAction: (button: HTMLButtonElement) => void
}) {
    const Icon = lane.icon
    const timing = age >= 720 && lane.status !== 'ready' ? 'Over 12 min' : age >= 480 && lane.status !== 'ready' ? 'Over 8 min' : null

    return (
        <article className={styles.ticket} aria-label={`Order ${order.order_number}`}>
            <header className={styles.ticketHead}>
                <div><p>{order.table?.table_number != null ? `Table ${order.table.table_number}` : order.table_id ? 'Dine-in' : 'Off-table order'}</p><h3>#{order.order_number}</h3></div>
                <div className={styles.timer} data-late={!!timing}>
                    <span><Clock3 size={15} aria-hidden="true" /> {ticketAge(age)}</span>
                    <small>{timing || 'Ticket age'}</small>
                </div>
            </header>
            {order.is_priority && <p className={styles.priority}>Priority ticket</p>}
            <ul className={styles.items}>
                {order.items?.map(item => {
                    const options = item.customizations?.flatMap(group => group.selected_options?.map(option => option.option_name) ?? []) ?? []
                    return (
                        <li key={item.id}>
                            <b>{item.quantity}×</b>
                            <div>
                                <p>{item.menu_item?.name || 'Item'}</p>
                                {options.length > 0 && <small>{options.join(', ')}</small>}
                                {item.special_instructions && <small className={styles.note}>{item.special_instructions}</small>}
                            </div>
                        </li>
                    )
                })}
                {!order.items?.length && <li>Item details unavailable</li>}
            </ul>
            {order.notes && <p className={styles.orderNote}><strong>Order note</strong> {order.notes}</p>}
            <footer className={styles.ticketFoot}>
                <button type="button" disabled={updating} onClick={event => onAction(event.currentTarget)}>
                    {updating ? <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}
                    {updating ? 'Updating…' : lane.status === 'ready' && order.table_id ? 'Mark served' : lane.action}
                </button>
            </footer>
        </article>
    )
}

function HeaderButton({ icon: Icon, label, pressed, disabled, onClick }: {
    icon: React.ElementType
    label: string
    pressed?: boolean
    disabled?: boolean
    onClick: () => void
}) {
    return (
        <button type="button" title={label} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick} className={styles.control}>
            <Icon size={18} aria-hidden="true" />
        </button>
    )
}
