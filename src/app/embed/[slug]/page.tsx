'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ShoppingCart,
    Plus,
    Minus,
    X,
    Send,
    ChefHat,
    Utensils,
    Loader2,
    ChevronRight,
    Phone,
    MapPin,
    User,
    CheckCircle
} from 'lucide-react'
import { useParams, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

type CartItem = {
    id: string
    name: string
    price: number
    quantity: number
}

type MenuItem = {
    id: string
    category_id: string
    name: string
    description: string | null
    price: number
    image_url: string | null
    is_available: boolean
}

type Category = {
    id: string
    name: string
    description: string | null
}

type Restaurant = {
    id: string
    name: string
    slug: string
    logo_url: string | null
    currency: string
    tax_rate: number
}

export default function EmbedOrderPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const slug = params.slug as string
    const theme = searchParams.get('theme') || 'dark'

    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [items, setItems] = useState<MenuItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [cart, setCart] = useState<CartItem[]>([])
    const [showCheckout, setShowCheckout] = useState(false)
    const [orderSubmitted, setOrderSubmitted] = useState(false)
    const [orderNumber, setOrderNumber] = useState<number | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Customer form
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [deliveryAddress, setDeliveryAddress] = useState('')

    // Fetch menu
    useEffect(() => {
        async function fetchMenu() {
            try {
                const res = await fetch(`/api/v1/menu?restaurant=${slug}`)
                const data = await res.json()

                if (!data.success) {
                    setError(data.error || 'Failed to load menu')
                    return
                }

                setRestaurant(data.restaurant)
                setCategories(data.categories)
                setItems(data.items)
            } catch (err) {
                setError('Failed to connect to restaurant')
            } finally {
                setIsLoading(false)
            }
        }
        fetchMenu()
    }, [slug])

    const addToCart = (item: MenuItem) => {
        const existing = cart.find(c => c.id === item.id)
        if (existing) {
            setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c))
        } else {
            setCart([...cart, { id: item.id, name: item.name, price: item.price, quantity: 1 }])
        }
    }

    const updateQuantity = (id: string, delta: number) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                const newQty = item.quantity + delta
                return newQty > 0 ? { ...item, quantity: newQty } : item
            }
            return item
        }).filter(item => item.quantity > 0))
    }

    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
    const taxAmount = restaurant ? Math.round(cartTotal * (restaurant.tax_rate / 100)) : 0
    const grandTotal = cartTotal + taxAmount

    const filteredItems = useMemo(() => {
        return items.filter(item => !selectedCategory || item.category_id === selectedCategory)
    }, [items, selectedCategory])

    const submitOrder = async () => {
        if (!restaurant || !customerName || !customerPhone) return

        setIsSubmitting(true)
        try {
            const res = await fetch('/api/v1/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurant_id: restaurant.id,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    delivery_address: deliveryAddress,
                    items: cart.map(item => ({
                        menu_item_id: item.id,
                        quantity: item.quantity,
                    })),
                    is_delivery: !!deliveryAddress,
                })
            })

            const data = await res.json()
            if (data.success) {
                setOrderNumber(data.order.order_number)
                setOrderSubmitted(true)
                setCart([])

                // Notify parent window
                window.parent.postMessage({
                    type: 'nexus:order_complete',
                    orderNumber: data.order.order_number,
                    trackingUrl: data.tracking_url
                }, '*')
            }
        } catch (err) {
            console.error('Order failed:', err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const isDark = theme === 'dark'
    const bgClass = isDark ? 'bg-neutral-950' : 'bg-white'
    const textClass = isDark ? 'text-white' : 'text-neutral-900'
    const mutedClass = isDark ? 'text-neutral-500' : 'text-neutral-500'
    const cardClass = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-50 border-neutral-200'

    if (isLoading) {
        return (
            <div className={cn("min-h-screen flex items-center justify-center", bgClass)}>
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        )
    }

    if (error || !restaurant) {
        return (
            <div className={cn("min-h-screen flex items-center justify-center p-6", bgClass)}>
                <div className="text-center">
                    <ChefHat className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                    <p className={cn("text-lg font-bold", textClass)}>{error || 'Restaurant not found'}</p>
                </div>
            </div>
        )
    }

    if (orderSubmitted) {
        return (
            <div className={cn("min-h-screen flex items-center justify-center p-6", bgClass)}>
                <div className="text-center space-y-6 max-w-sm">
                    <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-10 h-10 text-white" />
                    </div>
                    <h1 className={cn("text-3xl font-black", textClass)}>Order Confirmed!</h1>
                    <p className={mutedClass}>Your order number is</p>
                    <p className="text-5xl font-black text-purple-500">#{orderNumber}</p>
                    <p className={mutedClass}>We'll notify you when your order is ready.</p>
                    <button
                        onClick={() => window.parent.postMessage({ type: 'nexus:close' }, '*')}
                        className="mt-6 px-8 py-4 bg-purple-600 text-white rounded-2xl font-bold"
                    >
                        Close
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className={cn("min-h-screen", bgClass)}>
            {/* Header */}
            <div className={cn("sticky top-0 z-40 p-4 border-b", cardClass)}>
                <h1 className={cn("text-xl font-black", textClass)}>{restaurant.name}</h1>
                <p className={cn("text-sm", mutedClass)}>Order for delivery or pickup</p>
            </div>

            {/* Categories */}
            <div className="p-4 flex gap-2 overflow-x-auto">
                <button
                    onClick={() => setSelectedCategory(null)}
                    className={cn(
                        "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                        !selectedCategory
                            ? "bg-purple-600 text-white"
                            : isDark ? "bg-neutral-800 text-neutral-400" : "bg-neutral-100 text-neutral-600"
                    )}
                >
                    All
                </button>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                            selectedCategory === cat.id
                                ? "bg-purple-600 text-white"
                                : isDark ? "bg-neutral-800 text-neutral-400" : "bg-neutral-100 text-neutral-600"
                        )}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Menu Items */}
            <div className="p-4 space-y-3 pb-32">
                {filteredItems.map(item => {
                    const cartItem = cart.find(c => c.id === item.id)
                    return (
                        <div key={item.id} className={cn("p-4 rounded-2xl border", cardClass)}>
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <h3 className={cn("font-bold", textClass)}>{item.name}</h3>
                                    {item.description && (
                                        <p className={cn("text-sm mt-1 line-clamp-2", mutedClass)}>{item.description}</p>
                                    )}
                                    <p className="text-lg font-black text-purple-500 mt-2">
                                        {restaurant.currency}{item.price}
                                    </p>
                                </div>
                                <div>
                                    {cartItem ? (
                                        <div className="flex items-center gap-3 bg-purple-600 rounded-xl p-1">
                                            <button
                                                onClick={() => updateQuantity(item.id, -1)}
                                                className="w-8 h-8 flex items-center justify-center text-white"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className="text-white font-bold w-4 text-center">{cartItem.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.id, 1)}
                                                className="w-8 h-8 flex items-center justify-center text-white"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => addToCart(item)}
                                            className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Cart Footer */}
            <AnimatePresence>
                {cart.length > 0 && !showCheckout && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="fixed bottom-0 left-0 right-0 p-4"
                    >
                        <button
                            onClick={() => setShowCheckout(true)}
                            className="w-full h-16 bg-purple-600 text-white rounded-2xl font-bold flex items-center justify-between px-6 shadow-lg shadow-purple-600/30"
                        >
                            <div className="flex items-center gap-3">
                                <ShoppingCart className="w-5 h-5" />
                                <span>{cartItemCount} items</span>
                            </div>
                            <span className="text-xl font-black">{restaurant.currency}{cartTotal}</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Checkout Modal */}
            <AnimatePresence>
                {showCheckout && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 flex items-end"
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            className={cn("w-full max-h-[90vh] rounded-t-3xl overflow-hidden", bgClass)}
                        >
                            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                                <h2 className={cn("text-xl font-black", textClass)}>Checkout</h2>
                                <button onClick={() => setShowCheckout(false)} className="p-2">
                                    <X className={cn("w-6 h-6", mutedClass)} />
                                </button>
                            </div>

                            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                                {/* Customer Info */}
                                <div className="space-y-3">
                                    <div className={cn("flex items-center gap-3 p-4 rounded-2xl border", cardClass)}>
                                        <User className="w-5 h-5 text-purple-500" />
                                        <input
                                            type="text"
                                            placeholder="Your Name"
                                            value={customerName}
                                            onChange={e => setCustomerName(e.target.value)}
                                            className={cn("flex-1 bg-transparent outline-none font-medium", textClass)}
                                        />
                                    </div>
                                    <div className={cn("flex items-center gap-3 p-4 rounded-2xl border", cardClass)}>
                                        <Phone className="w-5 h-5 text-purple-500" />
                                        <input
                                            type="tel"
                                            placeholder="Phone Number"
                                            value={customerPhone}
                                            onChange={e => setCustomerPhone(e.target.value)}
                                            className={cn("flex-1 bg-transparent outline-none font-medium", textClass)}
                                        />
                                    </div>
                                    <div className={cn("flex items-center gap-3 p-4 rounded-2xl border", cardClass)}>
                                        <MapPin className="w-5 h-5 text-purple-500" />
                                        <input
                                            type="text"
                                            placeholder="Delivery Address (optional)"
                                            value={deliveryAddress}
                                            onChange={e => setDeliveryAddress(e.target.value)}
                                            className={cn("flex-1 bg-transparent outline-none font-medium", textClass)}
                                        />
                                    </div>
                                </div>

                                {/* Cart Items */}
                                <div className="space-y-2">
                                    {cart.map(item => (
                                        <div key={item.id} className="flex justify-between items-center py-2">
                                            <span className={textClass}>{item.quantity}x {item.name}</span>
                                            <span className={textClass}>{restaurant.currency}{item.price * item.quantity}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Totals */}
                                <div className={cn("p-4 rounded-2xl space-y-2", cardClass)}>
                                    <div className="flex justify-between">
                                        <span className={mutedClass}>Subtotal</span>
                                        <span className={textClass}>{restaurant.currency}{cartTotal}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className={mutedClass}>Tax ({restaurant.tax_rate}%)</span>
                                        <span className={textClass}>{restaurant.currency}{taxAmount}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-neutral-700">
                                        <span className={cn("font-bold", textClass)}>Total</span>
                                        <span className="font-black text-xl text-purple-500">{restaurant.currency}{grandTotal}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-neutral-800">
                                <button
                                    onClick={submitOrder}
                                    disabled={!customerName || !customerPhone || isSubmitting}
                                    className="w-full h-14 bg-purple-600 text-white rounded-2xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            Place Order
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
