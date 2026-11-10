'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Grid2X2, Pencil, Plus, RefreshCw, Trash2, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { hasPermission, useAuthStore } from '@/stores'
import type { Table, TableStatus } from '@/types'
import { ReviewDialog, SearchField } from '@/components/service/ServiceOrder'
import styles from '@/components/service/service-order.module.css'
import ops from '@/components/service/operations.module.css'

type FloorTable = Table & { waiter?: { name?: string } | null; customer_count?: number | null }
type Filter = TableStatus | 'all'
type Dialog = { kind: 'create' } | { kind: 'edit' | 'delete' | 'clear'; table: FloorTable }
const states: Record<TableStatus, string> = {
    available: 'Available', occupied: 'In service', reserved: 'Reserved', billing: 'At checkout',
}
const collator = new Intl.Collator(undefined, { numeric: true })

export default function TablesPage() {
    const { restaurant, userRole } = useAuthStore()
    return restaurant ? (
        <Floor key={restaurant.id} restaurantId={restaurant.id} canEdit={hasPermission(userRole, 'table:crud')}
            canUpdate={hasPermission(userRole, 'table:change_status')} canOrder={hasPermission(userRole, 'page:take_order')} />
    ) : (
        <section className={`${styles.page} ${ops.page}`}><h1 className={styles.sectionTitle}>Floor tables</h1><p className={styles.empty}>Link a restaurant to view its tables.</p></section>
    )
}

function Floor({ restaurantId, canEdit, canUpdate, canOrder }: {
    restaurantId: string; canEdit: boolean; canUpdate: boolean; canOrder: boolean
}) {
    const [tables, setTables] = useState<FloorTable[]>([])
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState<Filter>('all')
    const [refresh, setRefresh] = useState(0)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [actionError, setActionError] = useState('')
    const [notice, setNotice] = useState('')
    const [dialog, setDialog] = useState<Dialog | null>(null)
    const [saving, setSaving] = useState(false)
    const active = useRef(false)

    useEffect(() => {
        let current: AbortController | undefined
        let stopped = false

        async function load() {
            current?.abort()
            const request = new AbortController()
            current = request
            setLoading(true)
            try {
                const response = await fetch('/api/order-flow?view=tables', { signal: request.signal, cache: 'no-store' })
                const result = await response.json()
                if (!response.ok || !Array.isArray(result.tables)) throw new Error(result.error || 'Could not load the floor.')
                if (request.signal.aborted || stopped || active.current) return
                setTables(result.tables.filter((table: FloorTable) => table.restaurant_id === restaurantId))
                setLoadError('')
            } catch (error) {
                if (!request.signal.aborted && !stopped) setLoadError(error instanceof Error ? error.message : 'Could not load the floor.')
            } finally {
                if (!request.signal.aborted && !stopped) setLoading(false)
            }
        }

        void load()
        const interval = window.setInterval(() => {
            if (!active.current && document.visibilityState === 'visible') void load()
        }, 20000)
        return () => {
            stopped = true
            current?.abort()
            window.clearInterval(interval)
        }
    }, [restaurantId, refresh])

    function open(next: Dialog) {
        setActionError('')
        setNotice('')
        setDialog(next)
    }

    function close() {
        setDialog(null)
        setActionError('')
    }

    async function run(operation: () => Promise<string>) {
        if (active.current || loadError) return
        active.current = true
        setSaving(true)
        setActionError('')
        setNotice('')
        try {
            setNotice(await operation())
            setDialog(null)
        } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Could not update the table.')
        } finally {
            active.current = false
            setSaving(false)
            setRefresh(previous => previous + 1)
        }
    }

    function change(table: FloorTable, status: TableStatus) {
        if (!canUpdate) return
        void run(async () => {
            const timestamp = new Date().toISOString()
            const assignment = status === 'available'
                ? { current_waiter_id: null, customer_count: null, occupied_at: null }
                : status === 'occupied' ? { occupied_at: timestamp } : {}
            let update = createClient().from('tables')
                .update({ ...assignment, status, updated_at: timestamp })
                .eq('id', table.id).eq('restaurant_id', restaurantId).eq('status', table.status)
            if (table.updated_at) update = update.eq('updated_at', table.updated_at)
            const { data, error } = await update.select().maybeSingle()
            if (error || !data) throw new Error(error?.message || 'The table changed. Refresh and try again.')
            setTables(previous => previous.map(row => row.id === table.id ? { ...row, ...data, ...(status === 'available' ? { waiter: null } : {}) } : row))
            return `Table ${table.table_number} is now ${states[status].toLowerCase()}.`
        })
    }

    function save(label: string, capacity: number) {
        if (!canEdit || !dialog || (dialog.kind !== 'create' && dialog.kind !== 'edit')) return
        const table = dialog.kind === 'edit' ? dialog.table : null
        void run(async () => {
            const client = createClient()
            const payload = { table_number: label, capacity }
            const { data, error } = await (table
                ? client.from('tables').update(payload).eq('id', table.id).eq('restaurant_id', restaurantId)
                : client.from('tables').insert({ ...payload, restaurant_id: restaurantId, status: 'available' }))
                .select().single()
            if (error || !data) throw new Error(error?.message || 'Could not save this table.')
            setTables(previous => table ? previous.map(row => row.id === table.id ? { ...row, ...data } : row) : [...previous, data])
            return table ? `Table ${label} updated.` : `Table ${label} added to the floor.`
        })
    }

    function remove(table: FloorTable) {
        if (!canEdit) return
        void run(async () => {
            const { data, error } = await createClient().from('tables').delete().eq('id', table.id)
                .eq('restaurant_id', restaurantId).eq('status', table.status).select('id').maybeSingle()
            if (error || !data) throw new Error(error?.message || 'The table changed. Refresh and try again.')
            setTables(previous => previous.filter(row => row.id !== table.id))
            return `Table ${table.table_number} removed.`
        })
    }

    const counts = [
        { label: 'Tables', value: tables.length },
        { label: 'Available', value: tables.filter(table => table.status === 'available').length },
        { label: 'In service', value: tables.filter(table => table.status === 'occupied').length },
        { label: 'Seats', value: tables.reduce((total, table) => total + Number(table.capacity || 0), 0) },
    ]
    const needle = query.trim().toLowerCase()
    const filtered = tables.filter(table => (filter === 'all' || table.status === filter) &&
        (!needle || String(table.table_number).toLowerCase().includes(needle) || table.waiter?.name?.toLowerCase().includes(needle)))
        .sort((a, b) => collator.compare(String(a.table_number), String(b.table_number)))
    const controlsLocked = saving || !!loadError

    return (
        <section className={`${styles.page} ${ops.page}`} aria-labelledby="floor-title">
            <header className={styles.stationHead}>
                <div><p className={styles.kicker}>Floor service</p><h1 id="floor-title">Floor tables</h1><p>See what’s available, in service, reserved, or at checkout.</p></div>
                <div className={ops.actions}>
                    <button type="button" className={styles.secondary} disabled={loading || saving} onClick={() => setRefresh(previous => previous + 1)}><RefreshCw size={16} aria-hidden="true" /> {loading ? 'Refreshing…' : 'Refresh'}</button>
                    {canOrder && <Link href="/dashboard/take-order" className={styles.secondary}>Take an order <ArrowUpRight size={15} aria-hidden="true" /></Link>}
                    {canEdit && <button type="button" className={styles.primary} disabled={controlsLocked} onClick={() => open({ kind: 'create' })}><Plus size={17} aria-hidden="true" /> Add table</button>}
                </div>
            </header>
            <dl className={styles.shiftStats} aria-label="Floor summary">
                {counts.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{!tables.length && (loading || loadError) ? '—' : value}</dd></div>)}
            </dl>
            {loadError && <p className={`${styles.error} mb-3`} role="alert">Couldn’t refresh the floor. {tables.length ? 'Showing the last available tables.' : 'Try refreshing.'}</p>}
            {actionError && !dialog && <p className={`${styles.error} mb-3`} role="alert">{actionError}</p>}
            {notice && <p className={`${styles.success} mb-3`} role="status">{notice}</p>}
            <div className={ops.toolbar}>
                <SearchField value={query} onChange={setQuery} placeholder="Find a table or waiter" />
                <div className={ops.filters} role="group" aria-label="Table status">
                    <button type="button" className={styles.secondary} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All tables</button>
                    {(Object.entries(states) as [TableStatus, string][]).map(([status, label]) => (
                        <button type="button" key={status} className={styles.secondary} aria-pressed={filter === status} onClick={() => setFilter(status)}>{label}</button>
                    ))}
                </div>
            </div>
            <section className={styles.panel} aria-labelledby="floor-grid-title" aria-busy={loading}>
                <header className={styles.panelHead}><div><h2 id="floor-grid-title">Table grid</h2><p>{filtered.length} {filtered.length === 1 ? 'table' : 'tables'} shown</p></div><Grid2X2 size={20} aria-hidden="true" /></header>
                {filtered.length ? (
                    <div className={`${ops.floorGrid} ${styles.panelBody}`}>
                        {filtered.map(table => (
                            <article className={ops.floorTile} data-state={table.status} key={table.id}>
                                <header className={ops.tileHead}><div><p className={ops.tileLabel}>Table</p><h3>{table.table_number}</h3></div>
                                    <span className={ops.status} data-state={table.status}>{states[table.status] ?? table.status}</span></header>
                                <p className={ops.tileSeats}><Users size={16} aria-hidden="true" /> {table.capacity} seats{table.customer_count ? ` · ${table.customer_count} seated` : ''}</p>
                                {table.waiter?.name && <p className={`${styles.muted} mt-2`}>{table.waiter.name}</p>}
                                <div className={ops.tileActions}>
                                    {canUpdate && table.status === 'available' && <button type="button" className={styles.primary} disabled={controlsLocked} aria-label={`Mark table ${table.table_number} in service`} onClick={() => change(table, 'occupied')}>Mark in service</button>}
                                    {canUpdate && table.status === 'occupied' && <button type="button" className={styles.secondary} disabled={controlsLocked} aria-label={`Mark table ${table.table_number} at checkout`} onClick={() => change(table, 'billing')}>Mark checkout</button>}
                                    {canUpdate && table.status !== 'available' && <button type="button" className={styles.secondary} disabled={controlsLocked} aria-label={`Clear table ${table.table_number}`} onClick={() => open({ kind: 'clear', table })}>Clear</button>}
                                    {canEdit && <>
                                        <button type="button" className={`${styles.secondary} ${ops.iconAction}`} disabled={controlsLocked} aria-label={`Edit table ${table.table_number}`} onClick={() => open({ kind: 'edit', table })}><Pencil size={16} aria-hidden="true" /></button>
                                        <button type="button" className={`${styles.secondary} ${ops.iconAction}`} disabled={controlsLocked} aria-label={`Remove table ${table.table_number}`} onClick={() => open({ kind: 'delete', table })}><Trash2 size={16} aria-hidden="true" /></button>
                                    </>}
                                </div>
                            </article>
                        ))}
                    </div>
                ) : <p className={styles.empty}>{loading ? 'Loading the floor…' : loadError ? 'Try refreshing the floor.' : tables.length ? 'No tables match these filters.' : 'Add a table to start managing the floor.'}</p>}
            </section>

            {dialog && (
                <ReviewDialog title={dialog.kind === 'create' ? 'Add a table' : dialog.kind === 'edit' ? `Edit table ${dialog.table.table_number}` :
                    dialog.kind === 'delete' ? `Remove table ${dialog.table.table_number}?` : `Clear table ${dialog.table.table_number}?`}
                    onClose={close} busy={saving}>
                    {dialog.kind === 'create' || dialog.kind === 'edit' ? (
                        <TableForm table={dialog.kind === 'edit' ? dialog.table : null} onSubmit={save} disabled={controlsLocked} error={actionError || loadError} />
                    ) : (
                        <div className={ops.floorForm}>
                            <p className={styles.muted}>{dialog.kind === 'delete' ? 'This removes the table from the floor grid.' : 'This marks the table available for the next party.'}</p>
                            {(actionError || loadError) && <p className={styles.error} role="alert">{actionError || loadError}</p>}
                            <div className={ops.actions}>
                                <button type="button" className={styles.secondary} disabled={saving} onClick={close}>Cancel</button>
                                <button type="button" className={`${styles.primary} ${dialog.kind === 'delete' ? ops.danger : ''}`} disabled={controlsLocked}
                                    onClick={() => dialog.kind === 'delete' ? remove(dialog.table) : change(dialog.table, 'available')}>
                                    {saving ? 'Saving…' : dialog.kind === 'delete' ? 'Remove table' : 'Confirm clear'}
                                </button>
                            </div>
                        </div>
                    )}
                </ReviewDialog>
            )}
        </section>
    )
}

function TableForm({ table, onSubmit, disabled, error }: {
    table: FloorTable | null; onSubmit: (label: string, capacity: number) => void; disabled: boolean; error: string
}) {
    const [label, setLabel] = useState(String(table?.table_number ?? ''))
    const [seats, setSeats] = useState(String(table?.capacity || 4))
    return (
        <form className={ops.floorForm} onSubmit={event => {
            event.preventDefault()
            if (label.trim() && Number.isInteger(Number(seats)) && Number(seats) > 0) onSubmit(label.trim(), Number(seats))
        }}>
            <label className={styles.field}>Table name or number<input value={label} required disabled={disabled} onChange={event => setLabel(event.target.value)} /></label>
            <div className={ops.capacity} role="group" aria-label="Common seat counts">
                {[2, 4, 6, 8].map(count => <button type="button" key={count} className={styles.secondary} disabled={disabled} aria-pressed={Number(seats) === count}
                    onClick={() => setSeats(String(count))}>{count}</button>)}
            </div>
            <label className={styles.field}>Seats<input type="number" min={1} step={1} value={seats} required disabled={disabled} onChange={event => setSeats(event.target.value)} /></label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={styles.primary} disabled={disabled || !label.trim()}>{table ? 'Save table' : 'Create table'}</button>
        </form>
    )
}
