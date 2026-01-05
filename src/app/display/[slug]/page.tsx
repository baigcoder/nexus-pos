'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Maximize, Volume2, VolumeX } from 'lucide-react'
import Image from 'next/image'

interface DisplayContent {
    id: string
    content_type: 'banner' | 'video' | 'menu_highlight' | 'promo'
    title: string
    description: string | null
    media_url: string | null
    duration_seconds: number
    display_order: number
}

interface DisplaySettings {
    theme: 'dark' | 'light'
    primary_color: string
    show_prices: boolean
    show_order_ticker: boolean
    auto_rotate: boolean
    rotate_interval: number
}

interface MenuItem {
    id: string
    name: string
    price: number
    image_url: string | null
    description: string | null
}

export default function CustomerDisplayPage() {
    const params = useParams()
    const slug = params.slug as string

    const [restaurant, setRestaurant] = useState<any>(null)
    const [displayContent, setDisplayContent] = useState<DisplayContent[]>([])
    const [settings, setSettings] = useState<DisplaySettings | null>(null)
    const [featuredItems, setFeaturedItems] = useState<MenuItem[]>([])
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0)
    const [recentOrders, setRecentOrders] = useState<any[]>([])
    const [isMuted, setIsMuted] = useState(true)
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Load restaurant and initial data
    useEffect(() => {
        loadRestaurantData()
    }, [slug])

    // Auto-rotate banners
    useEffect(() => {
        if (!settings?.auto_rotate || displayContent.length === 0) return

        const interval = setInterval(() => {
            setCurrentBannerIndex((prev) => (prev + 1) % displayContent.length)
        }, (settings.rotate_interval || 8) * 1000)

        return () => clearInterval(interval)
    }, [displayContent, settings])

    // Subscribe to real-time updates
    useEffect(() => {
        if (!restaurant?.id) return

        const supabase = createClient()

        // Subscribe to display content changes
        const contentChannel = supabase
            .channel(`display_content_${restaurant.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'display_content',
                filter: `restaurant_id=eq.${restaurant.id}`
            }, () => {
                loadDisplayContent()
            })
            .subscribe()

        // Subscribe to order updates (new orders and status changes)
        const ordersChannel = supabase
            .channel(`orders_${restaurant.id}`)
            .on('postgres_changes', {
                event: '*', // Listen to INSERT and UPDATE
                schema: 'public',
                table: 'orders',
                filter: `restaurant_id=eq.${restaurant.id}`
            }, (payload) => {
                console.log('Order update:', payload)
                loadRecentOrders()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(contentChannel)
            supabase.removeChannel(ordersChannel)
        }
    }, [restaurant?.id])

    const loadRestaurantData = async () => {
        const supabase = createClient()

        const { data: rest } = await supabase
            .from('restaurants')
            .select('*')
            .eq('slug', slug)
            .single()

        if (!rest) return

        setRestaurant(rest)
        await Promise.all([
            loadDisplayContent(rest.id),
            loadDisplaySettings(rest.id),
            loadFeaturedItems(rest.id),
            loadRecentOrders(rest.id)
        ])
    }

    const loadDisplayContent = async (restaurantId?: string) => {
        const supabase = createClient()
        const id = restaurantId || restaurant?.id
        if (!id) return

        const { data } = await supabase
            .from('display_content')
            .select('*')
            .eq('restaurant_id', id)
            .eq('is_active', true)
            .order('display_order')

        if (data) setDisplayContent(data)
    }

    const loadDisplaySettings = async (restaurantId?: string) => {
        const supabase = createClient()
        const id = restaurantId || restaurant?.id
        if (!id) return

        const { data } = await supabase
            .from('display_settings')
            .select('*')
            .eq('restaurant_id', id)
            .single()

        if (data) setSettings(data)
    }

    const loadFeaturedItems = async (restaurantId?: string) => {
        const supabase = createClient()
        const id = restaurantId || restaurant?.id
        if (!id) return

        const { data } = await supabase
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', id)
            .eq('is_special', true)
            .eq('is_available', true)
            .limit(6)

        if (data) setFeaturedItems(data)
    }

    const loadRecentOrders = async (restaurantId?: string) => {
        const supabase = createClient()
        const id = restaurantId || restaurant?.id
        if (!id) return

        const { data } = await supabase
            .from('orders')
            .select('order_number, status, created_at')
            .eq('restaurant_id', id)
            .order('created_at', { ascending: false })
            .limit(5)

        if (data) setRecentOrders(data)
    }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    if (!restaurant) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-white text-2xl">Loading display...</div>
            </div>
        )
    }

    const currentBanner = displayContent[currentBannerIndex]
    const banners = displayContent.filter(c => c.content_type === 'banner' || c.content_type === 'video')

    return (
        <div className={`min-h-screen ${settings?.theme === 'light' ? 'bg-white text-black' : 'bg-black text-white'} overflow-hidden relative`}>
            {/* Control Bar */}
            <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
                <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all"
                >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <button
                    onClick={toggleFullscreen}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all"
                >
                    <Maximize className="w-5 h-5" />
                </button>
            </div>

            {/* Header */}
            <div className="px-8 pt-8 pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-5xl font-black tracking-tight mb-2">{restaurant.name}</h1>
                        <p className="text-xl text-gray-400">Welcome! Order at the counter</p>
                    </div>
                    {restaurant.logo_url && (
                        <Image
                            src={restaurant.logo_url}
                            alt={restaurant.name}
                            width={120}
                            height={120}
                            className="object-contain"
                        />
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-12 gap-6 px-8 pb-8">
                {/* Banner Carousel */}
                {banners.length > 0 && (
                    <div className="col-span-12 h-96 rounded-3xl overflow-hidden relative">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentBannerIndex}
                                initial={{ opacity: 0, x: 100 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                transition={{ duration: 0.5 }}
                                className="w-full h-full"
                            >
                                {currentBanner?.content_type === 'video' ? (
                                    <video
                                        src={currentBanner.media_url || ''}
                                        autoPlay
                                        loop
                                        muted={isMuted}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="relative w-full h-full bg-gradient-to-br from-orange-600 to-red-600">
                                        {currentBanner?.media_url ? (
                                            <Image
                                                src={currentBanner.media_url}
                                                alt={currentBanner.title}
                                                fill
                                                className="object-cover"
                                            />
                                        ) : null}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-12">
                                            <h2 className="text-6xl font-black text-white mb-4">{currentBanner?.title}</h2>
                                            {currentBanner?.description && (
                                                <p className="text-2xl text-white/90">{currentBanner.description}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* Banner indicators */}
                        {banners.length > 1 && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                                {banners.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`h-2 rounded-full transition-all ${i === currentBannerIndex ? 'w-8 bg-white' : 'w-2 bg-white/40'
                                            }`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Featured Menu Items */}
                <div className="col-span-12">
                    <h2 className="text-4xl font-black mb-6">Featured Menu</h2>
                    <div className="grid grid-cols-3 gap-6">
                        {featuredItems.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white/5 rounded-2xl overflow-hidden hover:bg-white/10 transition-all group"
                            >
                                {item.image_url && (
                                    <div className="relative h-48 bg-gray-800">
                                        <Image
                                            src={item.image_url}
                                            alt={item.name}
                                            fill
                                            className="object-cover group-hover:scale-110 transition-transform"
                                        />
                                    </div>
                                )}
                                <div className="p-6">
                                    <h3 className="text-2xl font-bold mb-2">{item.name}</h3>
                                    {item.description && (
                                        <p className="text-gray-400 mb-4 line-clamp-2">{item.description}</p>
                                    )}
                                    {settings?.show_prices && (
                                        <p className="text-3xl font-black" style={{ color: settings.primary_color }}>
                                            {restaurant.currency} {item.price}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Order Ticker */}
            {settings?.show_order_ticker && recentOrders.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-orange-600 to-red-600 text-white py-4 overflow-hidden">
                    <motion.div
                        animate={{ x: ['100%', '-100%'] }}
                        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                        className="flex items-center gap-8 text-2xl font-bold whitespace-nowrap"
                    >
                        {recentOrders.map((order) => (
                            <span key={order.order_number}>
                                Order #{order.order_number} - {order.status === 'ready' ? '✓ Ready' : '⏳ Preparing'}
                            </span>
                        ))}
                    </motion.div>
                </div>
            )}
        </div>
    )
}
