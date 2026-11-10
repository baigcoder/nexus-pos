'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AdSlideshow, type DisplaySlide } from '@/components/display/AdSlideshow'
import type { Display } from '@/types/display'

type DisplayOrder = {
    id?: string
    order_number: number
    status?: 'pending' | 'preparing'
    created_at?: string
    is_priority?: boolean
    items?: {
        quantity: number
        item_name_snapshot: string | null
        special_instructions: string | null
        modifiers?: { modifier_name_snapshot: string }[]
    }[]
}

interface Manifest {
    display: Display
    restaurant: { id: string; name: string; slug: string; logo_url: string | null; currency: string }
    orders: DisplayOrder[]
    ads: DisplaySlide[]
    canChangeOrders: boolean
}

export default function DisplayPage() {
    const { slug } = useParams<{ slug: string }>()
    const [manifest, setManifest] = useState<Manifest | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [working, setWorking] = useState<string | null>(null)
    const busy = useRef(false)

    const refresh = useCallback(async () => {
        if (busy.current) return
        busy.current = true
        try {
            const preview = new URLSearchParams(window.location.search).get('preview') === '1'
            const query = new URLSearchParams({ slug, ...(preview ? { preview: '1' } : {}) })
            const response = await fetch(`/api/display/device?${query}`, { cache: 'no-store' })
            if ([401, 403, 404].includes(response.status)) setManifest(null)
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Display unavailable')
            setManifest(previous => JSON.stringify(previous) === JSON.stringify(data) ? previous : data)
            setError(null)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Display connection failed')
        } finally {
            busy.current = false
            setIsLoading(false)
        }
    }, [slug])

    const refreshInterval = Math.min(60, Math.max(5, Number(manifest?.display.settings?.refresh_interval) || 10))
    useEffect(() => {
        void refresh()
        const interval = setInterval(refresh, refreshInterval * 1000)
        return () => clearInterval(interval)
    }, [refresh, refreshInterval])

    async function updateOrder(order: DisplayOrder) {
        if (!order.id || !manifest?.canChangeOrders || working) return
        setWorking(order.id)
        try {
            const response = await fetch('/api/display/device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'transition', slug, orderId: order.id,
                    status: order.status === 'pending' ? 'preparing' : 'ready',
                }),
            })
            const data = await response.json()
            if ([401, 403].includes(response.status)) setManifest(null)
            if (!response.ok) throw new Error(data.error || 'Order could not be updated')
            await refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Order could not be updated')
        } finally {
            setWorking(null)
        }
    }

    if (!manifest) {
        return (
            <main className="grid min-h-screen place-items-center bg-neutral-950 p-6 text-white">
                <div className="space-y-4 text-center">
                    <h1 className="text-2xl font-bold">{isLoading ? 'Loading display…' : error || 'Display unavailable'}</h1>
                    {!isLoading && <Link className="text-orange-400" href="/screen-login">Pair this device</Link>}
                </div>
            </main>
        )
    }

    const { display, restaurant, orders, ads, canChangeOrders } = manifest
    if (display.type === 'advertisement' || display.type === 'waiting') {
        return <AdSlideshow contents={ads} restaurant={restaurant} onRefresh={refresh} />
    }

    const layout = display.template === 'grid' || display.template === 'kanban'
        ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-4'
    const light = display.settings?.theme === 'light'

    return (
        <main className={`min-h-screen p-6 ${light ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-950 text-white'}`}>
            <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm opacity-70">{restaurant.name}</p>
                    <h1 className="text-3xl font-bold">{display.name}</h1>
                </div>
                <button className="rounded border px-4 py-2" onClick={() => {
                    if (document.fullscreenElement) void document.exitFullscreen()
                    else void document.documentElement.requestFullscreen()
                }}>Fullscreen</button>
            </header>
            {error && <p role="alert" className="mb-4 text-orange-500">{error}</p>}
            {display.type === 'qr' ? (
                <Link className="text-lg font-bold text-orange-500" href={`/order?restaurant=${encodeURIComponent(restaurant.slug)}`}>
                    Open restaurant menu
                </Link>
            ) : (
                <div className={layout}>
                    {orders.length === 0 && <p className="opacity-70">No orders to display.</p>}
                    {orders.map((order, index) => (
                        <article key={order.id ?? `${order.order_number}-${index}`} className="space-y-3 rounded-xl border border-neutral-500/40 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-3xl font-bold">#{order.order_number}</h2>
                                <span className="text-sm capitalize">{order.status || 'Ready for pickup'}</span>
                            </div>
                            {display.type === 'kitchen' && (
                                <>
                                    {order.is_priority && display.settings?.priority_enabled && <p className="font-bold text-orange-500">Priority</p>}
                                    {order.created_at && display.settings?.show_timer && (
                                        <p className="text-sm opacity-70">Received at {new Date(order.created_at).toLocaleTimeString()}</p>
                                    )}
                                    <ul className="space-y-2">
                                        {order.items?.map((item, itemIndex) => (
                                            <li key={itemIndex}>
                                                {item.quantity} × {item.item_name_snapshot || 'Item'}
                                                {item.modifiers?.length ? (
                                                    <p className="text-sm opacity-70">{item.modifiers.map(option => option.modifier_name_snapshot).join(', ')}</p>
                                                ) : null}
                                                {item.special_instructions && <p className="text-sm opacity-70">{item.special_instructions}</p>}
                                            </li>
                                        ))}
                                    </ul>
                                    {canChangeOrders && (
                                        <button disabled={working !== null} onClick={() => updateOrder(order)}
                                            className="rounded bg-orange-600 px-4 py-2 font-bold text-white disabled:opacity-50">
                                            {order.status === 'pending' ? 'Start preparing' : 'Mark ready'}
                                        </button>
                                    )}
                                </>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </main>
    )
}
