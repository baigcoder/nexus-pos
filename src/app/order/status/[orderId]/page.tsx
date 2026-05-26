'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, ChefHat, Clock, Package, RefreshCw, Phone, MapPin } from 'lucide-react'

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled'

interface OrderItem {
    id: string
    quantity: number
    menu_item: {
        name: string
        price: number
    }
}

interface OrderData {
    id: string
    order_number: number
    status: OrderStatus
    total: number
    created_at: string
    table?: {
        table_number: string
    }
    staff?: {
        name: string
    }
    order_items: OrderItem[]
    restaurant: {
        name: string
        logo_url: string | null
        phone: string | null
        address: string | null
    }
}

const statusConfig: Record<OrderStatus, {
    label: string
    icon: React.ElementType
    color: string
    bg: string
    message: string
    estimatedTime: string
}> = {
    pending: {
        label: 'Order Received',
        icon: Clock,
        color: 'text-yellow-500',
        bg: 'bg-yellow-500/20',
        message: 'Your order has been received!',
        estimatedTime: '~15 min'
    },
    confirmed: {
        label: 'Confirmed',
        icon: CheckCircle2,
        color: 'text-blue-500',
        bg: 'bg-blue-500/20',
        message: 'Your order is confirmed!',
        estimatedTime: '~12 min'
    },
    preparing: {
        label: 'Preparing',
        icon: ChefHat,
        color: 'text-orange-500',
        bg: 'bg-orange-500/20',
        message: 'Our chefs are preparing your order',
        estimatedTime: '~8 min'
    },
    ready: {
        label: 'Ready for Pickup',
        icon: Package,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/20',
        message: 'Your order is ready! Please collect from counter',
        estimatedTime: 'Now!'
    },
    served: {
        label: 'Served',
        icon: CheckCircle2,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/20',
        message: 'Enjoy your meal!',
        estimatedTime: ''
    },
    paid: {
        label: 'Paid',
        icon: CheckCircle2,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/20',
        message: 'Thank you!',
        estimatedTime: ''
    },
    cancelled: {
        label: 'Cancelled',
        icon: Clock,
        color: 'text-red-500',
        bg: 'bg-red-500/20',
        message: 'Order has been cancelled',
        estimatedTime: ''
    }
}

export default function OrderStatusPage() {
    const params = useParams()
    const orderId = params.orderId as string

    const [order, setOrder] = useState<OrderData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [currentTime, setCurrentTime] = useState(new Date())

    // Update time every second
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    // Load order data
    useEffect(() => {
        loadOrder()
    }, [orderId])

    // Subscribe to realtime order updates
    useEffect(() => {
        if (!order?.id) return

        const supabase = createClient()
        const channel = supabase
            .channel(`order_${order.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `id=eq.${order.id}`
            }, (payload: any) => {
                console.log('Order updated:', payload)
                setOrder(prev => prev ? { ...prev, status: payload.new.status } : null)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [order?.id])

    const loadOrder = async () => {
        if (!orderId) return
        setIsLoading(true)
        setError(null)

        const supabase = createClient()
        const { data, error: fetchError } = await supabase
            .from('orders')
            .select(`
                *,
                table:tables(table_number),
                staff:staff(name),
                restaurant:restaurants(name, logo_url, phone, address),
                order_items (
                    *,
                    menu_item:menu_items(name, price)
                )
            `)
            .eq('id', orderId)
            .single()

        if (fetchError || !data) {
            setError('Order not found')
            setIsLoading(false)
            return
        }

        setOrder(data)
        setIsLoading(false)
    }

    const getElapsedTime = useMemo(() => {
        return (createdAt: string) => {
            const diff = currentTime.getTime() - new Date(createdAt).getTime()
            const mins = Math.floor(diff / 60000)
            if (mins < 1) return 'Just now'
            if (mins === 1) return '1 minute ago'
            return `${mins} minutes ago`
        }
    }, [currentTime])

    const status = order?.status as OrderStatus
    const config = statusConfig[status] || statusConfig.pending
    const StatusIcon = config.icon

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto mb-6" />
                    <p className="text-neutral-400 text-xl">Loading order...</p>
                </div>
            </div>
        )
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-5xl">❌</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-4">Order Not Found</h1>
                    <p className="text-neutral-400">Please check your order number and try again</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 overflow-hidden relative">
            {/* Animated background */}
            <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative z-10 flex flex-col min-h-screen p-6">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-white mb-2">{order.restaurant?.name || 'Restaurant'}</h1>
                    <p className="text-neutral-500 text-sm">{getElapsedTime(order.created_at)}</p>
                </div>

                {/* Main Status Card */}
                <motion.div
                    key={status}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full"
                >
                    {/* Status Icon */}
                    <motion.div
                        className={`w-40 h-40 rounded-full ${config.bg} flex items-center justify-center mb-8`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                    >
                        <motion.div
                            animate={status === 'preparing' ? { rotate: [0, 10, -10, 0] } : {}}
                            transition={{ repeat: Infinity, duration: 2 }}
                        >
                            <StatusIcon className={`w-20 h-20 ${config.color}`} />
                        </motion.div>
                    </motion.div>

                    {/* Order Number */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="mb-6"
                    >
                        <p className="text-neutral-500 text-sm uppercase tracking-widest mb-2">Your Order</p>
                        <div className="text-8xl font-black text-white">#{order.order_number}</div>
                    </motion.div>

                    {/* Status */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-center mb-8"
                    >
                        <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full ${config.bg} mb-4`}>
                            <StatusIcon className={`w-6 h-6 ${config.color}`} />
                            <span className={`text-2xl font-bold ${config.color}`}>{config.label}</span>
                        </div>
                        <p className="text-2xl text-white font-medium">{config.message}</p>
                        {config.estimatedTime && (
                            <p className="text-neutral-400 mt-2">
                                Estimated: <span className="text-orange-500 font-bold">{config.estimatedTime}</span>
                            </p>
                        )}
                    </motion.div>

                    {/* Progress Bar */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="w-full max-w-md mb-8"
                    >
                        <div className="flex justify-between mb-2">
                            {['pending', 'confirmed', 'preparing', 'ready'].map((s, i) => (
                                <div key={s} className="text-center">
                                    <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                                        ['pending', 'confirmed', 'preparing', 'ready'].indexOf(status) >= i
                                            ? 'bg-orange-500'
                                            : 'bg-neutral-700'
                                    }`} />
                                    <span className="text-[10px] text-neutral-500 uppercase">{s}</span>
                                </div>
                            ))}
                        </div>
                        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-orange-500 to-emerald-500 rounded-full"
                                initial={{ width: '0%' }}
                                animate={{
                                    width: status === 'pending' ? '12.5%'
                                        : status === 'confirmed' ? '37.5%'
                                            : status === 'preparing' ? '62.5%'
                                                : status === 'ready' || status === 'served' || status === 'paid' ? '100%'
                                                    : '0%'
                                }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    </motion.div>

                    {/* Order Items Preview */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="bg-neutral-800/50 backdrop-blur rounded-2xl p-6 w-full max-w-md"
                    >
                        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4">Your Order</h3>
                        <div className="space-y-2">
                            {order.order_items?.slice(0, 4).map((item) => (
                                <div key={item.id} className="flex justify-between text-white">
                                    <span>{item.quantity}x {item.menu_item?.name}</span>
                                    <span className="text-neutral-400">Rs.{item.quantity * (item.menu_item?.price || 0)}</span>
                                </div>
                            ))}
                            {order.order_items?.length > 4 && (
                                <p className="text-neutral-500 text-sm">+{order.order_items.length - 4} more items</p>
                            )}
                        </div>
                        <div className="border-t border-neutral-700 mt-4 pt-4 flex justify-between">
                            <span className="text-lg font-bold text-white">Total</span>
                            <span className="text-2xl font-black text-orange-500">Rs.{order.total}</span>
                        </div>
                    </motion.div>

                    {/* Contact Info */}
                    {order.restaurant?.phone && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="mt-6 text-center"
                        >
                            <p className="text-neutral-500 text-sm mb-2">Need help? Contact us</p>
                            <a
                                href={`tel:${order.restaurant.phone}`}
                                className="inline-flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors"
                            >
                                <Phone className="w-5 h-5" />
                                <span className="font-bold">{order.restaurant.phone}</span>
                            </a>
                        </motion.div>
                    )}
                </motion.div>

                {/* Footer */}
                <div className="text-center mt-8">
                    <button
                        onClick={loadOrder}
                        className="inline-flex items-center gap-2 text-neutral-500 hover:text-white transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span className="text-sm">Refresh</span>
                    </button>
                </div>
            </div>
        </div>
    )
}