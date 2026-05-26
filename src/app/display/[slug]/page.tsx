'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Maximize, Volume2, VolumeX, Clock, ChefHat, Monitor, Tablet, ClipboardList, Megaphone, Layout, Wine, Users, QrCode, RefreshCw, CreditCard } from 'lucide-react'
import { OrderTicket, TimerBadge } from '@/components/display/OrderTicket'
import { AdSlideshow } from '@/components/display/AdSlideshow'
import { cn } from '@/lib/utils'
import type { Display, DisplayType, DisplayTemplate } from '@/types/display'
import type { Order, OrderItem } from '@/types/database'
import Image from 'next/image'
import Link from 'next/link'

type LegacyScreenType = 'customer' | 'kitchen' | 'order_status' | 'advertisement' | 'menu_board' | 'counter'

interface DisplayScreen {
    id: string
    name: string
    screen_type: LegacyScreenType
    access_code: string
    is_active: boolean
}

// Screen-specific content from screen_content table
interface ScreenContentItem {
    id: string
    screen_id: string
    title: string
    media_url: string | null
    media_type: 'image' | 'video' | 'youtube' | 'url'
    display_order: number
    duration_seconds: number
    background_color: string
    text_color: string
    transition_effect: 'fade' | 'slide' | 'zoom'
    is_active: boolean
}

interface DisplayContent {
    id: string
    content_type: 'banner' | 'video' | 'promo' | 'advertisement' | 'menu_item'
    title: string
    description: string | null
    media_url: string | null
    media_type: 'image' | 'video' | 'url'
    duration_seconds: number
    display_order: number
    is_active: boolean
    background_color: string
    text_color: string
    cta_text: string
    cta_url: string
}

interface DisplaySettings {
    theme: 'dark' | 'light'
    primary_color: string
    show_prices: boolean
    show_order_ticker: boolean
    auto_rotate: boolean
    rotate_interval: number
    transition_effect: 'fade' | 'slide' | 'zoom'
    show_logo: boolean
}

interface MenuItem {
    id: string
    name: string
    price: number
    image_url: string | null
    description: string | null
    category: string
    is_special: boolean
}

// New display type mapping
const NEW_TYPE_CONFIG: Record<DisplayType, { icon: any; color: string; bgGradient: string; label: string }> = {
    kitchen: { icon: ChefHat, color: 'orange', bgGradient: 'from-orange-600 to-red-600', label: 'Kitchen Display' },
    bar: { icon: Wine, color: 'purple', bgGradient: 'from-purple-600 to-pink-600', label: 'Bar Display' },
    counter: { icon: Monitor, color: 'cyan', bgGradient: 'from-cyan-600 to-blue-600', label: 'Counter Display' },
    cashier: { icon: CreditCard, color: 'sky', bgGradient: 'from-sky-600 to-indigo-600', label: 'Cashier Display' },
    waiting: { icon: Users, color: 'emerald', bgGradient: 'from-emerald-600 to-green-600', label: 'Waiting Area' },
    qr: { icon: QrCode, color: 'amber', bgGradient: 'from-amber-600 to-orange-600', label: 'QR Ordering' },
    advertisement: { icon: Megaphone, color: 'pink', bgGradient: 'from-pink-600 to-purple-600', label: 'Advertisement' },
}

// Legacy screen type configurations
const SCREEN_CONFIG: Record<LegacyScreenType, { icon: any; color: string; bgGradient: string; label: string }> = {
    customer: { icon: Monitor, color: 'cyan', bgGradient: 'from-cyan-600 to-blue-600', label: 'Customer Display' },
    kitchen: { icon: ChefHat, color: 'orange', bgGradient: 'from-orange-600 to-red-600', label: 'Kitchen Display' },
    order_status: { icon: ClipboardList, color: 'emerald', bgGradient: 'from-emerald-600 to-green-600', label: 'Order Status' },
    advertisement: { icon: Megaphone, color: 'pink', bgGradient: 'from-pink-600 to-purple-600', label: 'Advertisement' },
    menu_board: { icon: Layout, color: 'purple', bgGradient: 'from-purple-600 to-indigo-600', label: 'Menu Board' },
    counter: { icon: Tablet, color: 'amber', bgGradient: 'from-amber-600 to-orange-600', label: 'Counter Display' },
}

export default function CustomerDisplayPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const slug = params.slug as string
    const screenId = searchParams.get('screenId')

    const [restaurant, setRestaurant] = useState<any>(null)
    const [screen, setScreen] = useState<DisplayScreen | null>(null)
    const [displayContent, setDisplayContent] = useState<DisplayContent[]>([])
    const [screenContent, setScreenContent] = useState<ScreenContentItem[]>([])
    const [settings, setSettings] = useState<DisplaySettings | null>(null)
    const [menuItems, setMenuItems] = useState<MenuItem[]>([])
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0)
    const [currentScreenContentIndex, setCurrentScreenContentIndex] = useState(0)
    const [recentOrders, setRecentOrders] = useState<Order[]>([])
    const [kitchenOrders, setKitchenOrders] = useState<Order[]>([])
    const [readyOrders, setReadyOrders] = useState<Order[]>([])
    const [isMuted, setIsMuted] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [isLoading, setIsLoading] = useState(true)
    const [newDisplay, setNewDisplay] = useState<Display | null>(null)
    const [displayNotFound, setDisplayNotFound] = useState(false)

    // Get screen type from screen object or URL param
    // If screenId looks like a UUID, treat the 'screen' param as screenId (backward compatibility)
    const potentialScreenId = searchParams.get('screen')
    const isUUID = potentialScreenId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(potentialScreenId)
    const resolvedScreenId = isUUID ? potentialScreenId : screenId
    const screenTypeParam = isUUID ? null : searchParams.get('screen')
    const screenType = screen?.screen_type || (screenTypeParam as LegacyScreenType) || 'customer'
    const screenConfig = SCREEN_CONFIG[screenType] || SCREEN_CONFIG.customer

    // Load restaurant and screen data
    useEffect(() => {
        loadData()
    }, [slug, resolvedScreenId])

    // Send heartbeat to Supabase every 30s so dashboard knows screen is online.
    // Also keep the legacy localStorage heartbeat for same-browser compatibility.
    useEffect(() => {
        if (!restaurant?.id || !resolvedScreenId) return

        const supabase = createClient()
        const windowId = `display_${restaurant.id}_${resolvedScreenId}_${Date.now()}`

        const heartbeat = () => {
            // Supabase heartbeat — works across devices (TV, tablet, etc.)
            supabase
                .from('display_screens')
                .update({ last_seen: new Date().toISOString() })
                .eq('id', resolvedScreenId)
                .then(({ error }: { error: { message: string } | null }) => { if (error) console.warn('Heartbeat error:', error.message) })

            // Legacy localStorage heartbeat
            localStorage.setItem(`display_window_${windowId}`, JSON.stringify({
                screenId: resolvedScreenId,
                screenType: screen?.screen_type || screenTypeParam,
                screenName: screen?.name || screenConfig.label,
                lastSeen: Date.now(),
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
            }))
        }

        heartbeat() // immediate on mount
        const interval = setInterval(heartbeat, 30000)
        return () => clearInterval(interval)
    }, [restaurant?.id, resolvedScreenId, screen?.name, screen?.screen_type, screenTypeParam])

    // Real-time clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Auto-rotate banners
    useEffect(() => {
        if (!settings?.auto_rotate || displayContent.length === 0) return

        const interval = setInterval(() => {
            setCurrentBannerIndex((prev) => (prev + 1) % displayContent.length)
        }, (settings.rotate_interval || 8) * 1000)

        return () => clearInterval(interval)
    }, [displayContent, settings])

    // Auto-rotate screen content (slideshow)
    useEffect(() => {
        if (screenContent.length === 0) return

        const currentItem = screenContent[currentScreenContentIndex]
        const interval = setInterval(() => {
            setCurrentScreenContentIndex((prev) => (prev + 1) % screenContent.length)
        }, (currentItem?.duration_seconds || 10) * 1000)

        return () => clearInterval(interval)
    }, [screenContent, currentScreenContentIndex])

    // Subscribe to real-time updates
    useEffect(() => {
        if (!restaurant?.id) return

        const supabase = createClient()

        const channel = supabase
            .channel(`display_${restaurant.id}_${resolvedScreenId || 'all'}`)
            // Orders: refresh kitchen/status displays
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'orders',
                filter: `restaurant_id=eq.${restaurant.id}`
            }, () => {
                loadRecentOrdersData(supabase, restaurant.id)
                loadKitchenOrdersData(supabase, restaurant.id)
                loadReadyOrdersData(supabase, restaurant.id)
            })
            // Screen content: reload slideshow when owner adds/edits content
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'screen_content',
                filter: resolvedScreenId ? `screen_id=eq.${resolvedScreenId}` : undefined
            }, async () => {
                if (!resolvedScreenId) return
                const { data } = await supabase
                    .from('screen_content')
                    .select('*')
                    .eq('screen_id', resolvedScreenId)
                    .eq('is_active', true)
                    .order('display_order')
                if (data) {
                    setScreenContent(data)
                    setCurrentScreenContentIndex(0)
                }
            })
            // Display screens: react to push-content from dashboard
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'display_screens',
                filter: resolvedScreenId ? `id=eq.${resolvedScreenId}` : undefined
            }, async () => {
                // Re-fetch display content in case current_content changed
                const { data } = await supabase
                    .from('display_content')
                    .select('*')
                    .eq('restaurant_id', restaurant.id)
                    .eq('is_active', true)
                    .order('display_order')
                if (data) setDisplayContent(data)
            })
            .subscribe()

        return () => supabase.removeChannel(channel)
    }, [restaurant?.id, resolvedScreenId])

    const loadData = async () => {
        setIsLoading(true)
        const supabase = createClient()

        // First, try to find the display directly by slug (independent of restaurant)
        try {
            const { data: displayData } = await supabase
                .from('displays')
                .select('*')
                .eq('slug', slug)
                .eq('is_active', true)
                .single()

            if (displayData) {
                // Found display - now get the restaurant
                const parsedSettings = typeof displayData.settings === 'string'
                    ? JSON.parse(displayData.settings)
                    : displayData.settings
                setNewDisplay({
                    ...displayData,
                    settings: parsedSettings
                })

                // Load restaurant for this display
                const { data: rest } = await supabase
                    .from('restaurants')
                    .select('*')
                    .eq('id', displayData.restaurant_id)
                    .single()

                if (rest) {
                    setRestaurant(rest)
                }

                setDisplayNotFound(false)
                setIsLoading(false)
                return
            }
        } catch (e) {
            console.warn('Display lookup failed:', e)
        }

        // Fallback: Load restaurant info first, then find display within restaurant
        const { data: rest } = await supabase
            .from('restaurants')
            .select('*')
            .eq('slug', slug)
            .single()

        if (!rest) {
            setIsLoading(false)
            setDisplayNotFound(true)
            return
        }

        setRestaurant(rest)

        // Load display within this restaurant
        try {
            const { data: displayData } = await supabase
                .from('displays')
                .select('*')
                .eq('restaurant_id', rest.id)
                .eq('slug', slug)
                .eq('is_active', true)
                .single()

            if (displayData) {
                const parsedSettings = typeof displayData.settings === 'string'
                    ? JSON.parse(displayData.settings)
                    : displayData.settings
                setNewDisplay({
                    ...displayData,
                    settings: parsedSettings
                })
                setDisplayNotFound(false)
            } else {
                setDisplayNotFound(true)
            }
        } catch (e) {
            console.warn('Display lookup in restaurant failed:', e)
            setDisplayNotFound(true)
        }

        // Load screen info if screenId provided
        if (resolvedScreenId) {
            const { data: screenData } = await supabase
                .from('display_screens')
                .select('*')
                .eq('id', resolvedScreenId)
                .single()
            if (screenData) setScreen(screenData)
        }

        // Load settings
        const { data: settingsData } = await supabase
            .from('display_settings')
            .select('*')
            .eq('restaurant_id', rest.id)
            .single()
        if (settingsData) setSettings({
            theme: settingsData.theme || 'dark',
            primary_color: settingsData.primary_color || '#06b6d4',
            show_prices: settingsData.show_prices !== false,
            show_order_ticker: settingsData.show_order_ticker !== false,
            auto_rotate: settingsData.auto_rotate !== false,
            rotate_interval: settingsData.rotate_interval || 8,
            transition_effect: settingsData.transition_effect || 'fade',
            show_logo: settingsData.show_logo !== false,
        })

        // Load content specific to this screen type
        const { data: contentData } = await supabase
            .from('display_content')
            .select('*')
            .eq('restaurant_id', rest.id)
            .eq('is_active', true)
            .order('display_order')
        if (contentData) setDisplayContent(contentData)

        // Load screen-specific content (slideshow for this screen)
        if (resolvedScreenId) {
            const { data: screenContentData, error: scErr } = await supabase
                .from('screen_content')
                .select('*')
                .eq('screen_id', resolvedScreenId)   // ← was using wrong var: screenId
                .eq('is_active', true)
                .order('display_order')
            if (screenContentData) setScreenContent(screenContentData)
            if (scErr) console.warn('screen_content load error:', scErr.message)
        }

        // Load menu items
        const { data: menuData } = await supabase
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', rest.id)
            .eq('is_available', true)
            .order('category')
        if (menuData) setMenuItems(menuData)

        // Load orders
        await Promise.all([
            loadRecentOrdersData(supabase, rest.id),
            loadKitchenOrdersData(supabase, rest.id),
            loadReadyOrdersData(supabase, rest.id),
            reportScreenConnection(supabase, resolvedScreenId)
        ])

        setIsLoading(false)
    }

    const reportScreenConnection = async (supabase: any, id: string | null) => {
        if (!id) return
        // Update last_seen so the dashboard knows this screen is online
        await supabase
            .from('display_screens')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', id)
    }

    const loadRecentOrdersData = async (supabase: any, id: string) => {
        const { data } = await supabase
            .from('orders')
            .select('id, order_number, status, created_at, total')
            .eq('restaurant_id', id)
            .order('created_at', { ascending: false })
            .limit(10)
        if (data) setRecentOrders(data)
    }

    const loadKitchenOrdersData = async (supabase: any, id: string) => {
        const { data } = await supabase
            .from('orders')
            .select('id, order_number, status, created_at, total, items')
            .eq('restaurant_id', id)
            .in('status', ['pending', 'preparing'])
            .order('created_at', { ascending: true })
        if (data) setKitchenOrders(data)
    }

    const loadReadyOrdersData = async (supabase: any, id: string) => {
        const { data } = await supabase
            .from('orders')
            .select('id, order_number, status, created_at, total')
            .eq('restaurant_id', id)
            .eq('status', 'ready')
            .order('created_at', { ascending: false })
            .limit(10)
        if (data) setReadyOrders(data)
    }

    const refreshOrders = useCallback(async () => {
        if (!restaurant?.id) return
        const supabase = createClient()
        await Promise.all([
            loadRecentOrdersData(supabase, restaurant.id),
            loadKitchenOrdersData(supabase, restaurant.id),
            loadReadyOrdersData(supabase, restaurant.id),
        ])
    }, [restaurant?.id])

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
        } else {
            document.exitFullscreen()
        }
    }

    // Filter content by screen type
    const filterContentByType = (types: string[]) => {
        return displayContent.filter(c => types.includes(c.content_type))
    }

    // Group menu items by category
    const menuByCategory = menuItems.reduce((acc, item) => {
        const cat = item.category || 'Other'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(item)
        return acc
    }, {} as Record<string, MenuItem[]>)

    // Render based on screen type or new display config
    const renderContent = () => {
        // If we have a new-style display, use enhanced views
        if (newDisplay) {
            // Handle advertisement display specially
            if (newDisplay.type === 'advertisement') {
                return <AdSlideshowDisplay
                    display={newDisplay}
                    restaurant={restaurant}
                />
            }
            return <EnhancedDisplay
                display={newDisplay}
                restaurant={restaurant}
                orders={kitchenOrders}
                onStatusChange={refreshOrders}
            />
        }

        // Legacy screen type handling
        switch (screenType) {
            case 'kitchen':
                return <KitchenDisplay orders={kitchenOrders} restaurant={restaurant} />
            case 'order_status':
                return <OrderStatusDisplay orders={readyOrders} restaurant={restaurant} />
            case 'advertisement':
                return screenContent.length > 0 ? (
                    <SlideshowDisplay items={screenContent} currentIndex={currentScreenContentIndex} />
                ) : (
                    <AdvertisementDisplay content={filterContentByType(['banner', 'video', 'promo', 'advertisement'])} />
                )
            case 'menu_board':
                return <MenuBoardDisplay categories={menuByCategory} settings={settings} restaurant={restaurant} />
            case 'counter':
                return <CounterDisplay restaurant={restaurant} orders={recentOrders} settings={settings} />
            default:
                if (screenContent.length > 0) {
                    return <SlideshowDisplay items={screenContent} currentIndex={currentScreenContentIndex} restaurant={restaurant} />
                }
                return <CustomerDisplay
                    restaurant={restaurant}
                    content={filterContentByType(['banner', 'video'])}
                    promos={filterContentByType(['promo', 'advertisement'])}
                    settings={settings}
                    items={menuItems.filter(m => m.is_special).slice(0, 6)}
                    currentIndex={currentBannerIndex}
                    orders={recentOrders}
                />
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white text-xl font-bold">Loading display...</p>
                </div>
            </div>
        )
    }

    if (!restaurant) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-black text-white mb-2">Display Not Found</h1>
                    <p className="text-gray-500">Restaurant: {slug}</p>
                </div>
            </div>
        )
    }

    if (displayNotFound) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
                <div className="text-center">
                    <Monitor className="w-24 h-24 text-neutral-700 mx-auto mb-6" />
                    <h1 className="text-4xl font-black text-white mb-2">Display Not Found</h1>
                    <p className="text-gray-500">No display configured for this URL</p>
                    <p className="text-gray-600 mt-2 text-sm">Go to Display Manager to create a display with slug: {slug}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden relative">
            {/* Control Bar */}
            <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
                <div className="px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full text-sm font-bold">
                    {currentTime.toLocaleTimeString()}
                </div>
                {screenType === 'advertisement' && (
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all"
                    >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                )}
                <button
                    onClick={toggleFullscreen}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all"
                >
                    <Maximize className="w-5 h-5" />
                </button>
            </div>

            {/* Screen Info Badge */}
            <div className="absolute top-4 left-4 z-50 flex items-center gap-3">
                <div className={`px-4 py-2 bg-gradient-to-r ${screenConfig.bgGradient} rounded-full text-sm font-bold flex items-center gap-2`}>
                    <screenConfig.icon className="w-4 h-4" />
                    {screen?.name || screenConfig.label}
                </div>
                {screen && (
                    <div className="px-3 py-2 bg-white/10 backdrop-blur-xl rounded-full">
                        <span className="text-xs font-bold text-gray-400">Code:</span>
                        <span className="text-sm font-bold text-white ml-1">{screen.access_code}</span>
                    </div>
                )}
            </div>

            {renderContent()}
        </div>
    )
}

// Customer Display
function CustomerDisplay({ restaurant, content, promos, settings, items, currentIndex, orders }: {
    restaurant: any
    content: DisplayContent[]
    promos: DisplayContent[]
    settings: DisplaySettings | null
    items: MenuItem[]
    currentIndex: number
    orders: Order[]
}) {
    const currentBanner = content[currentIndex % Math.max(content.length, 1)]

    return (
        <div className="h-screen flex flex-col">
            {/* Header */}
            <div className="px-8 pt-16 pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-5xl font-black tracking-tight mb-2">{restaurant.name}</h1>
                        <p className="text-xl text-gray-400">Welcome! Order at the counter</p>
                    </div>
                    {restaurant.logo_url && settings?.show_logo && (
                        <Image src={restaurant.logo_url} alt={restaurant.name} width={100} height={100} className="object-contain" />
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 grid grid-cols-12 gap-6 px-8 pb-6">
                {/* Banner */}
                <div className="col-span-8 h-full rounded-3xl overflow-hidden relative">
                    {content.length > 0 ? (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentIndex}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5 }}
                                className="w-full h-full"
                            >
                                {currentBanner?.content_type === 'video' ? (
                                    <video src={currentBanner.media_url || ''} autoPlay loop muted className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full relative" style={{ backgroundColor: currentBanner?.background_color || '#1a1a1a' }}>
                                        {currentBanner?.media_url && (
                                            <Image src={currentBanner.media_url} alt={currentBanner.title} fill className="object-cover" />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-12">
                                            <h2 className="text-6xl font-black mb-4" style={{ color: currentBanner?.text_color || '#ffffff' }}>
                                                {currentBanner?.title}
                                            </h2>
                                            {currentBanner?.description && (
                                                <p className="text-2xl text-white/90">{currentBanner.description}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-cyan-900 to-blue-900 flex items-center justify-center">
                            <div className="text-center">
                                <Monitor className="w-20 h-20 text-cyan-500 mx-auto mb-4" />
                                <h2 className="text-4xl font-black text-white">Your Restaurant Name</h2>
                                <p className="text-xl text-cyan-400 mt-2">Add banners in Display Manager</p>
                            </div>
                        </div>
                    )}
                    {content.length > 1 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                            {content.map((_, i) => (
                                <div key={i} className={`h-2 rounded-full transition-all ${i === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/40'}`} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="col-span-4 flex flex-col gap-4">
                    {/* Featured Items */}
                    <div className="flex-1 bg-neutral-900/50 rounded-3xl p-6 overflow-hidden">
                        <h3 className="text-2xl font-black mb-4">Featured Items</h3>
                        <div className="space-y-3">
                            {items.length > 0 ? items.map((item) => (
                                <div key={item.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                                    {item.image_url && (
                                        <Image src={item.image_url} alt={item.name} width={50} height={50} className="rounded-lg object-cover" />
                                    )}
                                    <div className="flex-1">
                                        <p className="font-bold">{item.name}</p>
                                        {settings?.show_prices && (
                                            <p className="text-cyan-400 font-bold">{restaurant.currency} {item.price}</p>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <p className="text-gray-500 text-sm">No featured items</p>
                            )}
                        </div>
                    </div>

                    {/* Promos */}
                    {promos.length > 0 ? (
                        <div className="h-48 bg-gradient-to-br from-orange-600 to-pink-600 rounded-3xl p-6 overflow-hidden">
                            <h3 className="text-lg font-bold mb-2">Special Offer</h3>
                            <p className="text-2xl font-black">{promos[0].title}</p>
                            {promos[0].description && <p className="text-sm text-white/80">{promos[0].description}</p>}
                        </div>
                    ) : (
                        <div className="h-48 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-3xl p-6 flex items-center justify-center">
                            <p className="text-gray-500">Add promotions in Content tab</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Order Ticker */}
            {settings?.show_order_ticker && orders.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white py-4 overflow-hidden">
                    <motion.div
                        animate={{ x: ['100%', '-100%'] }}
                        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                        className="flex items-center gap-12 text-xl font-bold whitespace-nowrap"
                    >
                        {[...orders, ...orders].map((order, i) => (
                            <span key={`${order.order_number}-${i}`}>
                                #{order.order_number} {order.status === 'ready' ? '✓ Ready' : '⏳ Preparing'}
                            </span>
                        ))}
                    </motion.div>
                </div>
            )}
        </div>
    )
}

// Kitchen Display
function KitchenDisplay({ orders, restaurant }: { orders: Order[], restaurant: any }) {
    return (
        <div className="h-screen p-6 flex flex-col bg-gradient-to-b from-neutral-950 to-black">
            <div className="flex items-center gap-4 mb-6">
                <ChefHat className="w-10 h-10 text-orange-500" />
                <h1 className="text-4xl font-black">Kitchen Orders</h1>
                <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-full">
                    <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
                    <span className="font-bold text-orange-500">{orders.length} Active</span>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
                {orders.map((order) => (
                    <motion.div
                        key={order.id}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-neutral-900 rounded-2xl p-5 border-2 border-orange-500/50"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-4xl font-black text-cyan-400">#{order.order_number}</span>
                            <div className={`px-3 py-1 ${order.status === 'preparing' ? 'bg-yellow-500' : 'bg-orange-500'} text-white font-bold rounded-lg text-sm`}>
                                {order.status}
                            </div>
                        </div>
                        <div className="text-xs text-gray-500 mb-4">
                            {new Date(order.created_at).toLocaleTimeString()}
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {order.items?.length ? order.items.map((item: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
                                    <span className="text-lg font-bold text-orange-400">{item.quantity}x</span>
                                    <span className="font-bold">{item.name}</span>
                                </div>
                            )) : <p className="text-gray-500">Items loading...</p>}
                        </div>
                    </motion.div>
                ))}

                {orders.length === 0 && (
                    <div className="col-span-full flex items-center justify-center">
                        <div className="text-center">
                            <ChefHat className="w-24 h-24 text-gray-700 mx-auto mb-4" />
                            <p className="text-3xl text-gray-600 font-bold">No Pending Orders</p>
                            <p className="text-gray-500 mt-2">All caught up!</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="mt-4 text-center text-gray-600 text-sm">
                {restaurant.name} - Kitchen Display
            </div>
        </div>
    )
}

// Order Status Display
function OrderStatusDisplay({ orders, restaurant }: { orders: Order[], restaurant: any }) {
    return (
        <div className="h-screen flex flex-col bg-gradient-to-b from-emerald-950 to-black">
            <div className="flex-1 flex items-center justify-center p-12">
                <div className="text-center">
                    <ClipboardList className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
                    <h1 className="text-5xl font-black mb-8">Ready for Pickup</h1>

                    <div className="flex flex-wrap justify-center gap-6">
                        {orders.map((order, i) => (
                            <motion.div
                                key={order.id}
                                initial={{ scale: 0, rotate: -10 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-500/30"
                            >
                                <div>
                                    <p className="text-5xl font-black text-white">#{order.order_number}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {orders.length === 0 && (
                        <div className="mt-8">
                            <p className="text-3xl text-gray-600 font-bold">No orders ready yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="p-6 text-center">
                <p className="text-2xl font-bold text-emerald-500/50">{restaurant.name}</p>
            </div>
        </div>
    )
}

// Slideshow Display - Full slideshow player for screen-specific content
function SlideshowDisplay({ items, currentIndex, restaurant }: {
    items: ScreenContentItem[]
    currentIndex: number
    restaurant?: any
}) {
    const current = items[currentIndex % items.length]

    return (
        <div className="h-screen flex items-center justify-center p-8" style={{ backgroundColor: current?.background_color || '#000000' }}>
            {current && (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, scale: current?.transition_effect === 'zoom' ? 0.9 : 1, x: current?.transition_effect === 'slide' ? 100 : 0 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: current?.transition_effect === 'zoom' ? 1.1 : 1, x: current?.transition_effect === 'slide' ? -100 : 0 }}
                        transition={{ duration: 0.5 }}
                        className="w-full h-full relative"
                    >
                        {current.media_type === 'youtube' && current.media_url ? (
                            <iframe
                                src={`https://www.youtube.com/embed/${extractYouTubeId(current.media_url)}?autoplay=1&mute=1&loop=1&playlist=${extractYouTubeId(current.media_url)}`}
                                className="w-full h-full rounded-3xl"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : current.media_type === 'video' && current.media_url ? (
                            <video
                                src={current.media_url}
                                autoPlay
                                loop
                                muted
                                className="w-full h-full object-cover rounded-3xl"
                            />
                        ) : current.media_url ? (
                            <Image src={current.media_url} alt={current.title || ''} fill className="object-cover rounded-3xl" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <h1 className="text-6xl font-black text-white">{current.title || ''}</h1>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-3xl flex flex-col justify-end p-12">
                            <h2 className="text-7xl font-black mb-4" style={{ color: current.text_color || '#ffffff' }}>
                                {current.title}
                            </h2>
                        </div>
                    </motion.div>
                </AnimatePresence>
            )}

            {/* Progress indicator */}
            {items.length > 1 && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                    {items.map((_, i) => (
                        <div key={i} className={`h-3 rounded-full transition-all ${i === currentIndex ? 'w-12 bg-white' : 'w-3 bg-white/40'}`} />
                    ))}
                </div>
            )}

            {/* Branding */}
            {restaurant && (
                <div className="absolute bottom-8 right-8">
                    <p className="text-lg font-bold text-white/50">{restaurant.name}</p>
                </div>
            )}
        </div>
    )
}

// Helper to extract YouTube ID
function extractYouTubeId(url: string): string {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)
    return match ? match[1] : ''
}

// Advertisement Display
function AdvertisementDisplay({ content }: { content: DisplayContent[] }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const current = content[currentIndex % Math.max(content.length, 1)]

    useEffect(() => {
        if (content.length <= 1) return
        const interval = setInterval(() => setCurrentIndex(i => (i + 1) % content.length), 8000)
        return () => clearInterval(interval)
    }, [content.length])

    return (
        <div className="h-screen flex items-center justify-center p-8" style={{ backgroundColor: current?.background_color || '#000000' }}>
            {content.length > 0 ? (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="w-full h-full relative"
                    >
                        {current?.media_url && (
                            current.media_type === 'video' ? (
                                <video src={current.media_url} autoPlay loop muted className="w-full h-full object-cover rounded-3xl" />
                            ) : (
                                <Image src={current.media_url} alt={current.title || ''} fill className="object-cover rounded-3xl" />
                            )
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-3xl flex flex-col justify-end p-12">
                            <h2 className="text-7xl font-black mb-4" style={{ color: current?.text_color || '#ffffff' }}>
                                {current?.title}
                            </h2>
                            {current?.description && (
                                <p className="text-3xl text-white/90 mb-6 max-w-3xl">{current.description}</p>
                            )}
                            {current?.cta_text && (
                                <a href={current.cta_url} target="_blank" rel="noopener noreferrer"
                                    className="inline-block px-10 py-4 bg-cyan-500 text-white font-bold rounded-2xl text-2xl w-fit">
                                    {current.cta_text}
                                </a>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            ) : (
                <div className="text-center">
                    <Megaphone className="w-24 h-24 text-gray-700 mx-auto mb-6" />
                    <h2 className="text-5xl font-black text-white mb-4">Advertisement Space</h2>
                    <p className="text-2xl text-gray-500">Add content in Display Manager</p>
                </div>
            )}

            {content.length > 1 && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                    {content.map((_, i) => (
                        <div key={i} className={`h-3 rounded-full transition-all ${i === currentIndex ? 'w-12 bg-white' : 'w-3 bg-white/40'}`} />
                    ))}
                </div>
            )}
        </div>
    )
}

// Menu Board Display
function MenuBoardDisplay({ categories, settings, restaurant }: {
    categories: Record<string, MenuItem[]>
    settings: DisplaySettings | null
    restaurant: any
}) {
    const categoryColors: Record<string, string> = {
        'Appetizers': 'from-amber-500 to-orange-500',
        'Main Course': 'from-red-500 to-pink-500',
        'Drinks': 'from-blue-500 to-cyan-500',
        'Desserts': 'from-purple-500 to-pink-500',
        'Sides': 'from-green-500 to-emerald-500',
        'Other': 'from-gray-500 to-gray-600',
    }

    const categoryEntries = Object.entries(categories)

    return (
        <div className="h-screen overflow-hidden bg-neutral-950">
            <div className="p-6 flex items-center justify-between border-b border-neutral-800">
                <div>
                    <h1 className="text-4xl font-black">Menu Board</h1>
                    <p className="text-gray-500">{restaurant.name}</p>
                </div>
                {restaurant.logo_url && settings?.show_logo && (
                    <Image src={restaurant.logo_url} alt={restaurant.name} width={80} height={80} className="object-contain" />
                )}
            </div>

            {categoryEntries.length > 0 ? (
                <div className="px-6 pb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
                    {categoryEntries.map(([category, items]) => (
                        <div key={category} className="bg-neutral-900/50 rounded-2xl p-4">
                            <h2 className={`text-xl font-black mb-3 bg-gradient-to-r ${categoryColors[category] || categoryColors['Other']} bg-clip-text text-transparent`}>
                                {category}
                            </h2>
                            <div className="space-y-2">
                                {items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="font-bold">{item.name}</p>
                                        </div>
                                        {settings?.show_prices && (
                                            <p className="text-lg font-black text-cyan-400">{restaurant.currency} {item.price}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Layout className="w-24 h-24 text-gray-700 mx-auto mb-6" />
                        <h2 className="text-3xl font-black text-white mb-2">No Menu Items</h2>
                        <p className="text-gray-500">Add items in Menu Management</p>
                    </div>
                </div>
            )}
        </div>
    )
}

// Counter Display
function CounterDisplay({ restaurant, orders, settings }: {
    restaurant: any
    orders: Order[]
    settings: DisplaySettings | null
}) {
    const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString())
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0)

    return (
        <div className="h-screen p-8 flex flex-col bg-neutral-950">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-5xl font-black">Counter Dashboard</h1>
                {restaurant.logo_url && settings?.show_logo && (
                    <Image src={restaurant.logo_url} alt={restaurant.name} width={80} height={80} className="object-contain" />
                )}
            </div>

            <div className="grid grid-cols-4 gap-6 flex-1">
                {/* Stats */}
                <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-3xl p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-cyan-100 mb-4">Today's Revenue</h3>
                    <p className="text-5xl font-black text-white">{restaurant.currency} {todayRevenue.toLocaleString()}</p>
                    <p className="text-cyan-200 mt-auto">{todayOrders.length} orders</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-emerald-100 mb-4">Ready Orders</h3>
                    <p className="text-5xl font-black text-white">{orders.filter(o => o.status === 'ready').length}</p>
                    <p className="text-emerald-200 mt-auto">Waiting for pickup</p>
                </div>

                <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-3xl p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-orange-100 mb-4">Preparing</h3>
                    <p className="text-5xl font-black text-white">{orders.filter(o => o.status === 'preparing').length}</p>
                    <p className="text-orange-200 mt-auto">In kitchen</p>
                </div>

                <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-3xl p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-yellow-100 mb-4">Pending</h3>
                    <p className="text-5xl font-black text-white">{orders.filter(o => o.status === 'pending').length}</p>
                    <p className="text-yellow-200 mt-auto">Queue</p>
                </div>
            </div>

            {/* Recent Orders */}
            <div className="mt-6 bg-neutral-900/50 rounded-3xl p-6 max-h-[300px] overflow-y-auto">
                <h3 className="text-lg font-bold mb-4">Recent Orders</h3>
                <div className="space-y-2">
                    {orders.slice(0, 10).map((order) => (
                        <div key={order.id} className="flex items-center justify-between bg-black/30 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-4">
                                <span className="text-2xl font-black text-cyan-400">#{order.order_number}</span>
                                <span className="text-sm text-gray-500">{new Date(order.created_at).toLocaleTimeString()}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-lg">{restaurant.currency} {order.total?.toLocaleString() || 0}</span>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    order.status === 'ready' ? 'bg-emerald-500/20 text-emerald-400' :
                                    order.status === 'preparing' ? 'bg-orange-500/20 text-orange-400' :
                                    'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                    {order.status}
                                </div>
                            </div>
                        </div>
                    ))}
                    {orders.length === 0 && <p className="text-center text-gray-500 py-4">No orders today</p>}
                </div>
            </div>
        </div>
    )
}

// Enhanced Display for new-style displays from displays table
function EnhancedDisplay({
    display,
    restaurant,
    orders,
    onStatusChange
}: {
    display: Display
    restaurant: any
    orders: Order[]
    onStatusChange: () => void
}) {
    const [currentTime, setCurrentTime] = useState(new Date())
    const [isMuted, setIsMuted] = useState(!display.settings.sound_enabled)
    const supabase = createClient()

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Auto-refresh
    useEffect(() => {
        const interval = setInterval(onStatusChange, (display.settings.refresh_interval || 5) * 1000)
        return () => clearInterval(interval)
    }, [onStatusChange, display.settings.refresh_interval])

    const updateOrderStatus = async (orderId: string, status: 'preparing' | 'ready' | 'served') => {
        await supabase
            .from('orders')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', orderId)
        onStatusChange()
    }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
        } else {
            document.exitFullscreen()
        }
    }

    const TypeIcon = NEW_TYPE_CONFIG[display.type]?.icon || Monitor
    const colors = {
        kitchen: { bg: 'from-orange-600 to-red-600', text: 'text-orange-500' },
        bar: { bg: 'from-purple-600 to-pink-600', text: 'text-purple-500' },
        counter: { bg: 'from-cyan-600 to-blue-600', text: 'text-cyan-500' },
        cashier: { bg: 'from-sky-600 to-indigo-600', text: 'text-sky-500' },
        waiting: { bg: 'from-emerald-600 to-green-600', text: 'text-emerald-500' },
        qr: { bg: 'from-amber-600 to-orange-600', text: 'text-amber-500' },
        advertisement: { bg: 'from-pink-600 to-purple-600', text: 'text-pink-500' },
    }[display.type]

    const pendingOrders = orders.filter(o => o.status === 'pending')
    const preparingOrders = orders.filter(o => o.status === 'preparing')

    const renderTemplate = () => {
        switch (display.template) {
            case 'kanban':
                return (
                    <div className="grid grid-cols-3 gap-6 h-full">
                        <KanbanColumn
                            title="Pending"
                            orders={pendingOrders}
                            color="yellow"
                            onAction={(id) => updateOrderStatus(id, 'preparing')}
                            actionLabel="Start"
                        />
                        <KanbanColumn
                            title="Preparing"
                            orders={preparingOrders}
                            color="orange"
                            onAction={(id) => updateOrderStatus(id, 'ready')}
                            actionLabel="Ready"
                        />
                        <KanbanColumn
                            title="Ready"
                            orders={[]}
                            color="green"
                            onAction={() => {}}
                            actionLabel=""
                            isEmpty
                        />
                    </div>
                )

            case 'grid':
                return (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 h-full">
                        {orders.map((order) => (
                            <OrderTicket
                                key={order.id}
                                order={order}
                                currency={restaurant.currency}
                                variant="grid"
                                showTimer={display.settings.show_timer}
                                priorityEnabled={display.settings.priority_enabled}
                                onStatusChange={(status) => updateOrderStatus(order.id, status)}
                            />
                        ))}
                    </div>
                )

            case 'compact':
                return (
                    <div className="space-y-2 h-full overflow-y-auto pr-2">
                        {orders.map((order) => (
                            <OrderTicket
                                key={order.id}
                                order={order}
                                currency={restaurant.currency}
                                variant="compact"
                                showTimer={display.settings.show_timer}
                                priorityEnabled={display.settings.priority_enabled}
                                onStatusChange={(status) => updateOrderStatus(order.id, status)}
                            />
                        ))}
                    </div>
                )

            default: // list
                return (
                    <div className="space-y-4 h-full overflow-y-auto pr-2">
                        {orders.map((order) => (
                            <OrderTicket
                                key={order.id}
                                order={order}
                                currency={restaurant.currency}
                                variant="list"
                                showTimer={display.settings.show_timer}
                                priorityEnabled={display.settings.priority_enabled}
                                onStatusChange={(status) => updateOrderStatus(order.id, status)}
                            />
                        ))}
                    </div>
                )
        }
    }

    return (
        <div className={cn(
            "h-screen flex flex-col",
            display.settings.theme === 'dark' ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-900'
        )}>
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center",
                        colors.bg
                    )}>
                        <TypeIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black">{display.name}</h1>
                        <p className="text-sm text-neutral-500">{restaurant.name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900/50 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm font-bold text-neutral-400">
                            {orders.length} Active
                        </span>
                    </div>
                    <div className="px-4 py-2 bg-neutral-900/50 rounded-full text-sm font-mono">
                        {currentTime.toLocaleTimeString()}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={cn(
                            "p-3 rounded-xl transition-all",
                            "bg-neutral-900/50 hover:bg-neutral-800"
                        )}
                    >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={onStatusChange}
                        className={cn(
                            "p-3 rounded-xl transition-all",
                            "bg-neutral-900/50 hover:bg-neutral-800"
                        )}
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className={cn(
                            "p-3 rounded-xl transition-all",
                            "bg-neutral-900/50 hover:bg-neutral-800"
                        )}
                    >
                        <Maximize className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 p-6 overflow-hidden">
                {orders.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <TypeIcon className="w-24 h-24 text-neutral-700 mx-auto mb-6" />
                            <h2 className="text-3xl font-black text-neutral-600 mb-2">No Pending Orders</h2>
                            <p className="text-neutral-500">All orders have been processed</p>
                        </div>
                    </div>
                ) : (
                    renderTemplate()
                )}
            </main>
        </div>
    )
}

// Kanban Column for enhanced displays
function KanbanColumn({
    title,
    orders,
    color,
    onAction,
    actionLabel,
    isEmpty
}: {
    title: string
    orders: Order[]
    color: string
    onAction: (id: string) => void
    actionLabel: string
    isEmpty?: boolean
}) {
    const colorMap: Record<string, { border: string; badge: string }> = {
        yellow: { border: 'border-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400' },
        orange: { border: 'border-orange-500', badge: 'bg-orange-500/20 text-orange-400' },
        green: { border: 'border-emerald-500', badge: 'bg-emerald-500/20 text-emerald-400' },
    }

    return (
        <div className={cn(
            "flex flex-col rounded-2xl border-2 p-4",
            colorMap[color].border,
            isEmpty && "border-dashed opacity-50"
        )}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black">{title}</h3>
                <span className={cn(
                    "px-2 py-1 rounded-lg text-xs font-bold",
                    colorMap[color].badge
                )}>
                    {orders.length}
                </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto">
                {orders.map((order) => (
                    <motion.div
                        key={order.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-neutral-900 rounded-xl p-3"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl font-black text-orange-400">#{order.order_number}</span>
                            <span className="text-xs text-neutral-500">
                                {(order as any).table?.table_number ? `T${(order as any).table.table_number}` : ''}
                            </span>
                        </div>
                        <div className="space-y-1 text-sm">
                            {(order as any).items?.slice(0, 3).map((item: any, i: number) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="font-bold text-orange-400">{item.quantity}x</span>
                                    <span className="truncate">{item.menu_item?.name || 'Item'}</span>
                                </div>
                            ))}
                            {((order as any).items?.length || 0) > 3 && (
                                <p className="text-neutral-500 text-xs">+{((order as any).items?.length || 0) - 3} more</p>
                            )}
                        </div>
                        {actionLabel && (
                            <button
                                onClick={() => onAction(order.id)}
                                className={cn(
                                    "w-full mt-3 px-4 py-2 rounded-lg font-bold text-sm transition-all",
                                    "bg-orange-600 hover:bg-orange-700 text-white"
                                )}
                            >
                                {actionLabel}
                            </button>
                        )}
                    </motion.div>
                ))}
                {isEmpty && (
                    <div className="h-full flex items-center justify-center text-neutral-600">
                        <p className="text-sm">Drop orders here</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// Advertisement Slideshow Display
function AdSlideshowDisplay({
    display,
    restaurant
}: {
    display: Display
    restaurant: any
}) {
    if (!restaurant?.id) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white text-xl font-bold">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <AdSlideshow
            displayId={display.id}
            restaurantId={restaurant.id}
            restaurant={restaurant}
            settings={{
                transition_effect: 'fade',
                show_clock: true,
                show_progress: true,
                show_branding: true,
            }}
        />
    )
}
