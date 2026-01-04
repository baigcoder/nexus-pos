'use client'

import { useState, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search,
    ShoppingCart,
    Plus,
    Minus,
    X,
    Send,
    ChefHat,
    Clock,
    Utensils,
    Filter,
    Star,
    Flame,
    Leaf,
    Loader2,
    ChevronRight,
    ArrowLeft,
    HandPlatter,
    Shield,
    Zap,
    Satellite,
    Cpu,
    Activity,
    Lock,
    Target,
    Radar
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button, Badge, Card, Input, PremiumLayout } from '@/components/ui/common'
import { cn } from '@/lib/utils'

// Sample data for premium feel
const restaurant = {
    name: 'OrderFlow_Signature',
    tagline: 'Precision_Culinary_Interface',
    logo: null,
}

const categories = [
    { id: '1', name: 'Appetizers', subtitle: 'SEC_01', emoji: '🥗' },
    { id: '2', name: 'Entrées', subtitle: 'SEC_02', emoji: '🍛' },
    { id: '3', name: 'Elixirs', subtitle: 'SEC_03', emoji: '🥤' },
    { id: '4', name: 'Confections', subtitle: 'SEC_04', emoji: '🍰' },
]

const menuItems = [
    { id: '1', category_id: '1', name: 'Saffron Samosa Royale', description: 'Hand-crafted pastry filled with heritage potatoes and aromatic spices', price: 150, image: null, dietary_tags: ['vegetarian'], is_popular: true },
    { id: '4', category_id: '2', name: 'Velvet Butter Chicken', description: 'Slow-simmered chicken in a decadent smoked tomato and cream reduction', price: 650, image: null, dietary_tags: ['spicy'], is_popular: true },
    { id: '5', category_id: '2', name: 'Grand Biryani Manifest', description: 'Long-grain basmati layers with spiced tender protein and saffron pearls', price: 550, image: null, dietary_tags: ['spicy'], is_popular: true },
    { id: '8', category_id: '3', name: 'Artisan Mango Lassi', description: 'Whipped organic yogurt with sun-ripened mango nectar', price: 180, image: null, dietary_tags: ['vegetarian'], is_popular: true },
]

type CartItem = {
    id: string
    name: string
    price: number
    quantity: number
    notes?: string
}

function OrderLoading() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
            <div className="relative">
                <div className="w-20 h-20 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                <Satellite className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-primary animate-pulse" />
            </div>
            <p className="text-[0.6rem] font-tactical text-primary uppercase tracking-[0.4em] animate-pulse">Syncing_Tactical_Menu...</p>
        </div>
    )
}

export default function OrderPage() {
    return (
        <Suspense fallback={<OrderLoading />}>
            <OrderContent />
        </Suspense>
    )
}

function OrderContent() {
    const searchParams = useSearchParams()
    const tableNumber = searchParams.get('table') || '1'

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [cart, setCart] = useState<CartItem[]>([])
    const [showCart, setShowCart] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [orderSubmitted, setOrderSubmitted] = useState(false)
    const [orderNumber, setOrderNumber] = useState<number | null>(null)

    const addToCart = (item: any) => {
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

    const filteredItems = menuItems.filter(item => {
        const matchesCategory = !selectedCategory || item.category_id === selectedCategory
        const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesCategory && matchesSearch
    })

    if (orderSubmitted) {
        return (
            <PremiumLayout className="min-h-screen flex items-center justify-center p-8">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full">
                    <Card className="p-12 text-center space-y-10 border-border shadow-xl">
                        <div className="relative mx-auto w-32 h-32">
                            <div className="absolute inset-0 bg-primary/20 rounded-[2.5rem] animate-ping opacity-20" />
                            <div className="relative w-full h-full bg-primary flex items-center justify-center rounded-[2.5rem] shadow-glow shadow-primary/40 group">
                                <HandPlatter className="w-16 h-16 text-white group-hover:scale-110 transition-transform" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase italic leading-none">Manifest_Confirmed</h1>
                            <p className="text-muted font-bold text-lg leading-relaxed opacity-70 italic">Your mission-critical sustenance has been prioritized by the kitchen nodes.</p>
                        </div>

                        <div className="bg-surface/40 rounded-[2.5rem] p-10 border border-border relative overflow-hidden group">
                            <div className="absolute inset-0 bg-industrial opacity-[0.03] pointer-events-none" />
                            <p className="text-[0.6rem] font-tactical text-primary uppercase tracking-[0.4em] mb-3">Order_Identification</p>
                            <p className="text-6xl font-black text-foreground tracking-[0.1em]">#{orderNumber}</p>
                            <div className="mt-8 pt-8 border-t border-border flex justify-between items-center text-[0.6rem] font-tactical text-muted uppercase tracking-[0.2em]">
                                <span className="flex items-center gap-2"><Target className="w-3.5 h-3.5 text-primary" /> STATION: T_{tableNumber}</span>
                                <span className="flex items-center gap-2 animate-pulse text-primary"><Clock className="w-3.5 h-3.5" /> ETA: ~20m</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <Button size="lg" className="w-full h-20 text-xl font-bold rounded-[2.5rem]" onClick={() => { setOrderSubmitted(false); setOrderNumber(null); }}>
                                Refine_Order
                            </Button>
                            <Link href="/track" className="w-full">
                                <Button variant="ghost" className="w-full h-16 text-sm font-tactical uppercase tracking-widest border border-border">
                                    Track_Signal
                                </Button>
                            </Link>
                        </div>
                    </Card>
                </motion.div>
            </PremiumLayout>
        )
    }

    return (
        <PremiumLayout className="min-h-screen pb-40">
            {/* Ground Ops Header */}
            <div className="relative h-[480px] flex flex-col justify-end p-8 lg:p-16 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover grayscale opacity-40 brightness-50" alt="Banner" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                    <div className="absolute inset-0 bg-industrial opacity-[0.05]" />
                </div>

                <div className="relative z-10 space-y-8">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        <Badge variant="primary" className="px-6 py-2.5 mb-6">
                            <Activity className="w-4 h-4 mr-3 text-primary animate-pulse" />
                            SYSTEM_ACTIVE // STATION_T{tableNumber}
                        </Badge>
                        <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter uppercase italic leading-none drop-shadow-2xl">
                            {restaurant.name.split('_')[0]}<span className="text-primary italic">_{restaurant.name.split('_')[1]}</span>
                        </h1>
                        <p className="text-muted font-bold text-xl md:text-2xl mt-4 max-w-2xl italic opacity-80 uppercase tracking-tight">{restaurant.tagline}</p>
                    </motion.div>
                </div>

                {/* Tactical Overlays */}
                <div className="absolute top-12 right-12 z-10 flex flex-col items-end gap-3 font-tactical text-[0.6rem] text-primary opacity-40">
                    <p>COORD: 33.6844° N, 73.0479° E</p>
                    <p>SIGNAL: OPTIMAL_ENCRYPTED</p>
                    <Radar className="w-6 h-6 mt-2 animate-spin-slow" />
                </div>
            </div>

            {/* Tactical Navigation Bar */}
            <div className="sticky top-0 z-40 glass-card border-b border-border px-8 py-6 space-y-6">
                <div className="relative group max-w-4xl mx-auto">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Search_Asset_Index..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-18 pl-18 pr-8 bg-surface/50 border-2 border-border rounded-3xl font-tactical text-sm tracking-widest focus:border-primary outline-none transition-all placeholder:text-muted/40 uppercase"
                    />
                </div>

                <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar max-w-5xl mx-auto px-2">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={cn(
                            "h-14 px-8 rounded-2xl font-tactical text-[0.7rem] uppercase tracking-[0.2em] transition-all border-2",
                            !selectedCategory ? "bg-primary text-white border-primary shadow-glow shadow-primary/20" : "bg-surface/20 text-muted border-border hover:border-primary/50"
                        )}>
                        ALL_SEECTORS
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={cn(
                                "h-14 px-10 rounded-2xl font-tactical text-[0.7rem] uppercase tracking-[0.2em] transition-all whitespace-nowrap border-2 group",
                                selectedCategory === cat.id ? "bg-primary text-white border-primary shadow-glow shadow-primary/20" : "bg-surface/20 text-muted border-border hover:border-primary/50"
                            )}>
                            <span className="block text-[0.5rem] opacity-50 group-hover:text-primary transition-colors">{cat.subtitle}</span>
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Asset Grid */}
            <div className="max-w-7xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-2 gap-12">
                {filteredItems.map((item) => {
                    const cartItem = cart.find(c => c.id === item.id)
                    return (
                        <motion.div key={item.id} layout className="group">
                            <Card className="p-0 border-border overflow-hidden bg-surface/10 hover:border-primary/40 transition-all duration-700">
                                <div className="flex flex-col sm:flex-row h-full">
                                    {/* Item Visuall */}
                                    <div className="w-full sm:w-52 h-52 sm:h-auto bg-surface relative overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-1000">
                                        <div className="absolute inset-0 bg-industrial opacity-[0.05] z-10" />
                                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface to-transparent z-10" />

                                        {/* Placeholder with Grid */}
                                        <div className="w-full h-full flex items-center justify-center bg-slate-900 group-hover:bg-slate-800 transition-colors">
                                            <Utensils className="w-12 h-12 text-primary/20" />
                                            {/* Corner Decorators */}
                                            <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-primary/40" />
                                            <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-primary/40" />
                                            <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-primary/40" />
                                            <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-primary/40" />
                                        </div>

                                        {item.is_popular && (
                                            <div className="absolute top-4 right-4 z-20 bg-primary text-white p-2.5 rounded-xl shadow-glow shadow-primary/40">
                                                <Star className="w-4 h-4 fill-current" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Item Specss */}
                                    <div className="flex-1 p-8 flex flex-col justify-between space-y-6">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start gap-4">
                                                <h3 className="text-2xl font-black text-foreground tracking-tighter uppercase italic leading-none group-hover:text-primary transition-colors">{item.name}</h3>
                                                <span className="text-2xl font-black text-primary tracking-tighter">Rs.{item.price}</span>
                                            </div>
                                            <p className="text-muted font-bold text-sm leading-relaxed opacity-70 italic line-clamp-3">{item.description}</p>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex gap-3">
                                                {item.dietary_tags.map(tag => (
                                                    <Badge key={tag} variant="primary" className="px-3 py-1.5 bg-primary/5 text-primary border-primary/20">
                                                        {tag === 'vegetarian' ? <Leaf className="w-3.5 h-3.5 mr-2" /> : <Flame className="w-3.5 h-3.5 mr-2" />}
                                                        {tag.toUpperCase()}
                                                    </Badge>
                                                ))}
                                            </div>

                                            {cartItem ? (
                                                <div className="flex items-center gap-5 bg-background border-2 border-primary rounded-2xl p-2 shadow-glow shadow-primary/10">
                                                    <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 rounded-xl bg-surface hover:bg-surface-hover flex items-center justify-center transition-all">
                                                        <Minus className="w-4 h-4 text-primary" />
                                                    </button>
                                                    <span className="font-black text-primary text-xl tabular-nums w-4 text-center">{cartItem.quantity}</span>
                                                    <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 rounded-xl bg-primary hover:scale-105 flex items-center justify-center transition-all shadow-glow">
                                                        <Plus className="w-4 h-4 text-white" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <Button
                                                    onClick={() => addToCart(item)}
                                                    variant="ghost"
                                                    className="h-14 px-8 rounded-2xl border-border hover:border-primary font-tactical text-[0.65rem]"
                                                >
                                                    Link_to_Manifest
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    )
                })}
            </div>

            {/* Tactical Floating Cart Pill */}
            <AnimatePresence>
                {cart.length > 0 && !showCart && (
                    <motion.div
                        initial={{ y: 200, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 200, opacity: 0 }}
                        transition={{ type: 'spring', damping: 20 }}
                        className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-xl px-8"
                    >
                        <button
                            onClick={() => setShowCart(true)}
                            className="w-full h-24 bg-slate-950/90 backdrop-blur-3xl border-2 border-primary/50 shadow-glow shadow-primary/20 text-white rounded-[3rem] flex items-center pointer-events-auto group px-3 relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-industrial opacity-[0.05]" />
                            <div className="w-18 h-18 bg-primary rounded-[2rem] flex items-center justify-center shadow-glow group-hover:scale-110 transition-transform">
                                <ShoppingCart className="w-8 h-8" />
                            </div>
                            <div className="flex-1 px-8 flex justify-between items-center mr-6">
                                <div className="space-y-1">
                                    <p className="text-[0.6rem] font-tactical text-primary uppercase tracking-[0.4em] leading-none">Manifest_Voucher</p>
                                    <p className="text-3xl font-black tracking-tighter">Rs.{cartTotal}</p>
                                </div>
                                <div className="flex items-center gap-6">
                                    <Badge variant="primary" className="bg-primary/20 text-primary border-primary/40 px-5 py-2">
                                        {cartItemCount} UNITS
                                    </Badge>
                                    <div className="w-10 h-10 rounded-full border border-primary/40 flex items-center justify-center group-hover:translate-x-2 transition-transform">
                                        <ChevronRight className="w-6 h-6 text-primary" />
                                    </div>
                                </div>
                            </div>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Premium Voucher Manifest Overlay */}
            <AnimatePresence>
                {showCart && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCart(false)} className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]" />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 lg:left-auto lg:right-12 lg:bottom-12 lg:w-[600px] bg-slate-950 border-t-2 lg:border-2 border-primary/30 rounded-t-[4rem] lg:rounded-[4rem] z-[101] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-industrial opacity-[0.05] pointer-events-none" />

                            <div className="p-12 pb-8 border-b border-border flex items-center justify-between relative">
                                <div className="space-y-1">
                                    <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">Voucher_Manifest</h2>
                                    <div className="flex items-center gap-3 text-primary text-[0.6rem] font-tactical tracking-widest uppercase opacity-60">
                                        <Lock className="w-3 h-3" /> SECURE_TRANSACTION_ACTIVE
                                    </div>
                                </div>
                                <button onClick={() => setShowCart(false)} className="w-14 h-14 bg-surface rounded-2xl border border-border flex items-center justify-center hover:bg-surface-hover hover:border-primary/50 transition-all text-muted hover:text-primary"><X className="w-7 h-7" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-12 pt-6 space-y-10 custom-scrollbar relative">
                                {cart.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between group">
                                        <div className="space-y-2">
                                            <p className="font-black text-white tracking-tighter uppercase italic text-xl group-hover:text-primary transition-colors">{item.name}</p>
                                            <div className="flex items-center gap-4">
                                                <span className="text-[0.6rem] font-tactical text-muted uppercase tracking-[0.2em]">Unit_ID: {item.id}</span>
                                                <div className="h-1 w-1 rounded-full bg-border" />
                                                <span className="text-[0.6rem] font-black text-primary tracking-widest uppercase">Rs. {item.price} EA</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-5 bg-surface/50 border-2 border-border rounded-2xl p-2 relative group-hover:border-primary/30 transition-colors">
                                            <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center hover:bg-surface transition-colors shadow-sm"><Minus className="w-4 h-4 text-muted" /></button>
                                            <span className="font-black text-lg text-white w-6 text-center tabular-nums">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center hover:scale-105 transition-all text-white shadow-glow shadow-primary/20"><Plus className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}

                                {cart.length === 0 && (
                                    <div className="py-20 text-center space-y-6">
                                        <div className="w-20 h-20 bg-surface rounded-3xl flex items-center justify-center mx-auto opacity-20">
                                            <ShoppingCart className="w-10 h-10 text-muted" />
                                        </div>
                                        <p className="text-muted font-tactical text-[0.7rem] tracking-[0.4em] uppercase">MANIFEST_EMPTY // NO_ASSETS_LINKED</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-12 bg-surface/30 backdrop-blur-3xl space-y-10 border-t border-border relative">
                                <div className="space-y-4">
                                    <div className="flex justify-between text-[0.65rem] font-tactical text-muted uppercase tracking-[0.3em] italic">
                                        <span>Operational_Subtotal</span>
                                        <span className="text-foreground">Rs. {cartTotal}</span>
                                    </div>
                                    <div className="flex justify-between text-[0.65rem] font-tactical text-muted uppercase tracking-[0.3em] italic">
                                        <span>Infrastructure_Levy (16%)</span>
                                        <span className="text-foreground">Rs. {Math.round(cartTotal * 0.16)}</span>
                                    </div>
                                    <div className="flex justify-between items-end pt-6 border-t border-border">
                                        <div>
                                            <span className="text-[0.7rem] font-tactical text-primary uppercase tracking-[0.4em] block mb-2">Grand_Total</span>
                                            <span className="text-xs font-black text-muted uppercase tracking-[0.2em] italic opacity-40">Ready_for_Execution</span>
                                        </div>
                                        <span className="text-6xl font-black text-white tracking-tighter leading-none group-hover:text-glow transition-all">
                                            <span className="text-2xl align-top mr-1">Rs.</span>{Math.round(cartTotal * 1.16)}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    className="w-full h-24 text-2xl font-tactical rounded-[3rem] shadow-glow shadow-primary/30"
                                    onClick={() => {
                                        setOrderNumber(1000 + Math.floor(Math.random() * 9000))
                                        setOrderSubmitted(true)
                                        setCart([])
                                        setShowCart(false)
                                    }}
                                >
                                    Confirm_Execution_Link
                                    <ChevronRight className="w-8 h-8 ml-4 group-hover:translate-x-2 transition-transform" />
                                </Button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </PremiumLayout>
    )
}
