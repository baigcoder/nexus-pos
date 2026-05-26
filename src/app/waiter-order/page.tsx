'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users,
    Plus,
    Minus,
    ShoppingBag,
    Clock,
    CheckCircle2,
    AlertTriangle,
    X,
    Loader2,
    RefreshCw,
    Search,
    Bell
} from 'lucide-react'
import { Card } from '@/components/ui/common'
import { useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'

interface MenuItem {
    id: string
    name: string
    price: number
    category_id: string
    description?: string
    is_available: boolean
    preparation_time?: number
}

interface Category {
    id: string
    name: string
}

interface Table {
    id: string
    table_number: number
    status: string
    capacity: number
    current_waiter_id?: string
    customer_count?: number
}

interface CartItem {
    menu_item_id: string
    name: string
    price: number
    quantity: number
    notes?: string
}

export default function WaiterOrderPage() {
    const { user, staff, restaurant } = useAuthStore()
    const [tables, setTables] = useState<Table[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [menuItems, setMenuItems] = useState<MenuItem[]>([])
    const [selectedTable, setSelectedTable] = useState<Table | null>(null)
    const [cart, setCart] = useState<CartItem[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [alerts, setAlerts] = useState<any[]>([])
    const [orderNotes, setOrderNotes] = useState('')

    // Load data
    const loadData = useCallback(async () => {
        try {
            // Load tables
            const tablesRes = await fetch('/api/order-flow?view=tables')
            if (tablesRes.ok) {
                const data = await tablesRes.json()
                setTables(data.tables || [])
            }

            // Load menu
            if (restaurant?.slug) {
                const menuRes = await fetch(`/api/v1/menu?restaurant=${restaurant.slug}`)
                if (menuRes.ok) {
                    const data = await menuRes.json()
                    setCategories(data.categories || [])
                    setMenuItems(data.items || [])
                    if (data.categories?.length > 0 && !selectedCategory) {
                        setSelectedCategory(data.categories[0].id)
                    }
                }
            }

            // Load alerts for me
            const alertsRes = await fetch('/api/staff/alerts')
            if (alertsRes.ok) {
                const data = await alertsRes.json()
                setAlerts(data.alerts?.filter((a: any) => !a.is_read) || [])
            }
        } catch (err) {
            console.error('Load error:', err)
        } finally {
            setLoading(false)
        }
    }, [restaurant?.slug, selectedCategory])

    useEffect(() => {
        loadData()
        const interval = setInterval(loadData, 15000)
        return () => clearInterval(interval)
    }, [loadData])

    // Filter items
    const filteredItems = menuItems.filter(item => {
        const matchesCategory = !selectedCategory || item.category_id === selectedCategory
        const matchesSearch = !searchQuery ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesCategory && matchesSearch && item.is_available
    })

    // Cart functions
    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.menu_item_id === item.id)
            if (existing) {
                return prev.map(i =>
                    i.menu_item_id === item.id
                        ? { ...i, quantity: i.quantity + 1 }
                        : i
                )
            }
            return [...prev, {
                menu_item_id: item.id,
                name: item.name,
                price: item.price,
                quantity: 1
            }]
        })
    }

    const updateQuantity = (itemId: string, delta: number) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.menu_item_id === itemId) {
                    const newQty = item.quantity + delta
                    return newQty > 0 ? { ...item, quantity: newQty } : item
                }
                return item
            }).filter(item => item.quantity > 0)
        })
    }

    const removeFromCart = (itemId: string) => {
        setCart(prev => prev.filter(i => i.menu_item_id !== itemId))
    }

    const clearCart = () => {
        setCart([])
        setSelectedTable(null)
        setOrderNotes('')
    }

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

    // Submit order
    const submitOrder = async () => {
        if (!selectedTable || cart.length === 0) return

        setSubmitting(true)
        try {
            const response = await fetch('/api/order-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_order',
                    data: {
                        table_id: selectedTable.id,
                        items: cart.map(i => ({
                            menu_item_id: i.menu_item_id,
                            quantity: i.quantity,
                            notes: i.notes
                        })),
                        notes: orderNotes
                    }
                })
            })

            if (response.ok) {
                const data = await response.json()
                alert(`Order #${data.order.order_number} placed successfully!`)
                clearCart()
                loadData()
            } else {
                const error = await response.json()
                alert(`Error: ${error.error}`)
            }
        } catch (err) {
            console.error('Submit error:', err)
            alert('Failed to submit order')
        } finally {
            setSubmitting(false)
        }
    }

    // Assign self to table
    const assignToTable = async (table: Table) => {
        try {
            await fetch('/api/order-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'assign_table',
                    data: {
                        table_id: table.id,
                        waiter_id: staff?.id,
                        customer_count: 1
                    }
                })
            })
            setSelectedTable({ ...table, current_waiter_id: staff?.id })
            loadData()
        } catch (err) {
            console.error('Assign error:', err)
        }
    }

    return (
        <div className="min-h-screen bg-neutral-950 flex">
            {/* Left Panel - Tables & Menu */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="p-4 bg-neutral-900/50 border-b border-neutral-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-black text-white">Waiter POS</h1>
                            <p className="text-sm text-neutral-500">{staff?.name} • {restaurant?.name}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {alerts.length > 0 && (
                                <div className="relative">
                                    <Bell className="w-6 h-6 text-amber-500" />
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                        {alerts.length}
                                    </span>
                                </div>
                            )}
                            <button
                                onClick={loadData}
                                className="p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700"
                            >
                                <RefreshCw className="w-5 h-5 text-neutral-400" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Tables */}
                <div className="p-4 border-b border-neutral-800">
                    <h2 className="text-sm font-bold text-neutral-500 mb-3">SELECT TABLE</h2>
                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                        {tables.map(table => (
                            <button
                                key={table.id}
                                onClick={() => {
                                    if (!table.current_waiter_id || table.current_waiter_id === staff?.id) {
                                        if (!table.current_waiter_id) {
                                            assignToTable(table)
                                        } else {
                                            setSelectedTable(table)
                                        }
                                    }
                                }}
                                disabled={table.status === 'available'}
                                className={cn(
                                    "p-3 rounded-xl text-center transition-all",
                                    table.current_waiter_id === staff?.id
                                        ? 'bg-emerald-500/20 border-2 border-emerald-500'
                                        : table.current_waiter_id
                                            ? 'bg-neutral-800/50 border border-neutral-700 opacity-50'
                                            : table.status === 'available'
                                                ? 'bg-neutral-800/30 border border-neutral-700 hover:bg-neutral-800/50 cursor-not-allowed'
                                                : 'bg-amber-500/10 border border-amber-500/30',
                                    selectedTable?.id === table.id && 'ring-2 ring-white'
                                )}
                            >
                                <p className="text-lg font-black text-white">T{table.table_number}</p>
                                <p className="text-xs text-neutral-500">
                                    {table.current_waiter_id === staff?.id ? 'My Table' :
                                     table.current_waiter_id ? 'Taken' :
                                     'Available'}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Categories */}
                <div className="p-4 border-b border-neutral-800">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={cn(
                                "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap",
                                !selectedCategory ? 'bg-emerald-500 text-white' : 'bg-neutral-800 text-neutral-400'
                            )}
                        >
                            All
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap",
                                    selectedCategory === cat.id ? 'bg-emerald-500 text-white' : 'bg-neutral-800 text-neutral-400'
                                )}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-neutral-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                        <input
                            type="text"
                            placeholder="Search menu..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500"
                        />
                    </div>
                </div>

                {/* Menu Items */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filteredItems.map(item => (
                            <motion.button
                                key={item.id}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => addToCart(item)}
                                className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-left hover:border-emerald-500/50 transition-colors"
                            >
                                <p className="font-bold text-white text-sm mb-1">{item.name}</p>
                                <p className="text-emerald-500 font-black">Rs.{item.price}</p>
                                {item.preparation_time && (
                                    <p className="text-xs text-neutral-500 mt-1">{item.preparation_time}min</p>
                                )}
                            </motion.button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel - Cart */}
            <div className="w-96 bg-neutral-900/50 border-l border-neutral-800 flex flex-col">
                {/* Selected Table */}
                {selectedTable && (
                    <div className="p-4 border-b border-neutral-800 bg-emerald-500/10">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                                <span className="text-xl font-black text-white">T{selectedTable.table_number}</span>
                            </div>
                            <div>
                                <p className="font-bold text-white">Table {selectedTable.table_number}</p>
                                <p className="text-sm text-emerald-400">Ready to take order</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cart Header */}
                <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-neutral-500" />
                        <span className="font-bold text-white">Order Items ({cart.length})</span>
                    </div>
                    {cart.length > 0 && (
                        <button
                            onClick={clearCart}
                            className="text-sm text-rose-400 hover:text-rose-300"
                        >
                            Clear All
                        </button>
                    )}
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4">
                    {cart.length === 0 ? (
                        <div className="text-center py-12">
                            <ShoppingBag className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
                            <p className="text-neutral-500">Tap menu items to add</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {cart.map(item => (
                                <div key={item.menu_item_id} className="bg-neutral-800 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="font-medium text-white text-sm">{item.name}</p>
                                        <button
                                            onClick={() => removeFromCart(item.menu_item_id)}
                                            className="text-neutral-500 hover:text-rose-400"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-emerald-500 font-bold">Rs.{item.price * item.quantity}</p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => updateQuantity(item.menu_item_id, -1)}
                                                className="w-8 h-8 bg-neutral-700 rounded-lg flex items-center justify-center"
                                            >
                                                <Minus className="w-4 h-4 text-white" />
                                            </button>
                                            <span className="w-8 text-center font-bold text-white">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.menu_item_id, 1)}
                                                className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center"
                                            >
                                                <Plus className="w-4 h-4 text-white" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Notes */}
                {cart.length > 0 && (
                    <div className="p-4 border-t border-neutral-800">
                        <input
                            type="text"
                            placeholder="Special instructions..."
                            value={orderNotes}
                            onChange={e => setOrderNotes(e.target.value)}
                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-500"
                        />
                    </div>
                )}

                {/* Total & Submit */}
                <div className="p-4 border-t border-neutral-800">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-neutral-500">Total</span>
                        <span className="text-2xl font-black text-white">Rs.{cartTotal.toLocaleString()}</span>
                    </div>
                    <button
                        onClick={submitOrder}
                        disabled={!selectedTable || cart.length === 0 || submitting}
                        className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <CheckCircle2 className="w-5 h-5" />
                                PLACE ORDER
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}