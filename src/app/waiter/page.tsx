'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Utensils,
    Grid3X3,
    ShoppingCart,
    Plus,
    Minus,
    X,
    Send,
    ChefHat,
    Clock,
    Search,
    ArrowLeft,
    Check,
    Loader2,
    AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore, useOrderStore } from '@/stores'

// Sample data for demo
const sampleCategories = [
    { id: '1', name: 'Starters', image_url: null },
    { id: '2', name: 'Main Course', image_url: null },
    { id: '3', name: 'Drinks', image_url: null },
    { id: '4', name: 'Desserts', image_url: null },
]

const sampleMenuItems = [
    { id: '1', category_id: '1', name: 'Samosa (2 pcs)', price: 150, is_available: true, dietary_tags: ['vegetarian'] },
    { id: '2', category_id: '1', name: 'Chicken Tikka', price: 450, is_available: true, dietary_tags: ['spicy'] },
    { id: '3', category_id: '1', name: 'Spring Rolls', price: 280, is_available: true, dietary_tags: ['vegetarian'] },
    { id: '4', category_id: '2', name: 'Butter Chicken', price: 650, is_available: true, dietary_tags: ['spicy'] },
    { id: '5', category_id: '2', name: 'Chicken Biryani', price: 550, is_available: true, dietary_tags: ['spicy'] },
    { id: '6', category_id: '2', name: 'Palak Paneer', price: 450, is_available: true, dietary_tags: ['vegetarian'] },
    { id: '7', category_id: '2', name: 'Dal Makhani', price: 350, is_available: true, dietary_tags: ['vegetarian', 'vegan'] },
    { id: '8', category_id: '3', name: 'Mango Lassi', price: 180, is_available: true, dietary_tags: ['vegetarian'] },
    { id: '9', category_id: '3', name: 'Fresh Lime Soda', price: 120, is_available: true, dietary_tags: ['vegan'] },
    { id: '10', category_id: '3', name: 'Coca Cola', price: 80, is_available: true, dietary_tags: [] },
    { id: '11', category_id: '4', name: 'Gulab Jamun', price: 150, is_available: true, dietary_tags: ['vegetarian'] },
    { id: '12', category_id: '4', name: 'Kheer', price: 180, is_available: true, dietary_tags: ['vegetarian'] },
]

const sampleTables = [
    { id: '1', table_number: '1', capacity: 4, status: 'available' },
    { id: '2', table_number: '2', capacity: 2, status: 'occupied' },
    { id: '3', table_number: '3', capacity: 6, status: 'available' },
    { id: '4', table_number: '4', capacity: 4, status: 'available' },
    { id: '5', table_number: '5', capacity: 8, status: 'reserved' },
    { id: '6', table_number: '6', capacity: 4, status: 'occupied' },
]

type CartItem = {
    id: string
    name: string
    price: number
    quantity: number
    notes?: string
}

export default function WaiterPage() {
    const { restaurant } = useAuthStore()
    const { success, error } = useToast()
    const [view, setView] = useState<'tables' | 'menu'>('tables')
    const [selectedTable, setSelectedTable] = useState<typeof sampleTables[0] | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [cart, setCart] = useState<CartItem[]>([])
    const [showCart, setShowCart] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editingItemNotes, setEditingItemNotes] = useState<string | null>(null)
    const [itemNotes, setItemNotes] = useState('')

    // Use sample data or fetch from DB
    const categories = sampleCategories
    const menuItems = sampleMenuItems
    const tables = sampleTables

    const handleTableSelect = (table: typeof sampleTables[0]) => {
        setSelectedTable(table)
        setView('menu')
        setSelectedCategory(categories[0]?.id || null)
    }

    const addToCart = (item: typeof sampleMenuItems[0]) => {
        const existingItem = cart.find(c => c.id === item.id)
        if (existingItem) {
            setCart(cart.map(c =>
                c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
            ))
        } else {
            setCart([...cart, { id: item.id, name: item.name, price: item.price, quantity: 1 }])
        }
    }

    const updateQuantity = (itemId: string, delta: number) => {
        setCart(cart.map(item => {
            if (item.id === itemId) {
                const newQty = item.quantity + delta
                return newQty > 0 ? { ...item, quantity: newQty } : item
            }
            return item
        }).filter(item => item.quantity > 0))
    }

    const removeFromCart = (itemId: string) => {
        setCart(cart.filter(item => item.id !== itemId))
    }

    const updateItemNotes = (itemId: string, notes: string) => {
        setCart(cart.map(item =>
            item.id === itemId ? { ...item, notes } : item
        ))
        setEditingItemNotes(null)
        setItemNotes('')
    }

    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

    const filteredItems = menuItems.filter(item => {
        const matchesCategory = !selectedCategory || item.category_id === selectedCategory
        const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesCategory && matchesSearch && item.is_available
    })

    const handleSubmitOrder = async () => {
        if (!selectedTable || cart.length === 0) return

        setIsSubmitting(true)

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500))

        success('Order sent to kitchen!', `Table ${selectedTable.table_number} • ${cartItemCount} items`)
        setCart([])
        setShowCart(false)
        setView('tables')
        setSelectedTable(null)
        setIsSubmitting(false)
    }

    const handleBackToTables = () => {
        if (cart.length > 0) {
            if (!confirm('You have items in your cart. Go back anyway?')) return
        }
        setView('tables')
        setSelectedTable(null)
        setCart([])
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        {view === 'menu' && (
                            <button
                                onClick={handleBackToTables}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <ArrowLeft className="w-6 h-6 text-gray-600" />
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                                <Utensils className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">OrderFlow</p>
                                <p className="text-xs text-gray-500">
                                    {view === 'tables' ? 'Select Table' : `Table ${selectedTable?.table_number}`}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/dashboard"
                            className="text-sm text-gray-600 hover:text-gray-900"
                        >
                            Dashboard
                        </Link>

                        {view === 'menu' && (
                            <button
                                onClick={() => setShowCart(true)}
                                className="relative p-3 bg-orange-500 text-white rounded-xl"
                            >
                                <ShoppingCart className="w-6 h-6" />
                                {cartItemCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                                        {cartItemCount}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Tables View */}
            {view === 'tables' && (
                <div className="p-4">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-900">Select a Table</h1>
                        <p className="text-gray-600">Choose a table to start taking orders</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {tables.map((table) => (
                            <motion.button
                                key={table.id}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => table.status !== 'reserved' && handleTableSelect(table)}
                                disabled={table.status === 'reserved'}
                                className={`p-6 rounded-2xl text-center transition-all ${table.status === 'available'
                                        ? 'bg-green-100 hover:bg-green-200 border-2 border-green-300'
                                        : table.status === 'occupied'
                                            ? 'bg-yellow-100 hover:bg-yellow-200 border-2 border-yellow-300'
                                            : 'bg-gray-200 border-2 border-gray-300 opacity-60 cursor-not-allowed'
                                    }`}
                            >
                                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl font-bold mb-2 ${table.status === 'available' ? 'bg-green-500 text-white' :
                                        table.status === 'occupied' ? 'bg-yellow-500 text-white' :
                                            'bg-gray-400 text-white'
                                    }`}>
                                    {table.table_number}
                                </div>
                                <p className="font-semibold text-gray-900">Table {table.table_number}</p>
                                <p className="text-sm text-gray-500">{table.capacity} seats</p>
                                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${table.status === 'available' ? 'bg-green-200 text-green-800' :
                                        table.status === 'occupied' ? 'bg-yellow-200 text-yellow-800' :
                                            'bg-gray-300 text-gray-700'
                                    }`}>
                                    {table.status}
                                </span>
                            </motion.button>
                        ))}
                    </div>
                </div>
            )}

            {/* Menu View */}
            {view === 'menu' && (
                <div className="flex flex-col h-[calc(100vh-64px)]">
                    {/* Search */}
                    <div className="p-4 bg-white border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search menu..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="bg-white border-b overflow-x-auto">
                        <div className="flex p-2 gap-2">
                            {categories.map((category) => (
                                <button
                                    key={category.id}
                                    onClick={() => setSelectedCategory(category.id)}
                                    className={`px-4 py-2 rounded-xl whitespace-nowrap font-medium transition-colors ${selectedCategory === category.id
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {category.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredItems.map((item) => {
                                const cartItem = cart.find(c => c.id === item.id)
                                return (
                                    <motion.div
                                        key={item.id}
                                        whileTap={{ scale: 0.98 }}
                                        className="bg-white rounded-xl p-4 shadow-sm"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                                <div className="flex gap-1 mt-1">
                                                    {item.dietary_tags.map(tag => (
                                                        <span key={tag} className="text-xs">
                                                            {tag === 'vegetarian' && '🥬'}
                                                            {tag === 'vegan' && '🌱'}
                                                            {tag === 'spicy' && '🌶️'}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <span className="font-bold text-orange-600">Rs. {item.price}</span>
                                        </div>

                                        {cartItem ? (
                                            <div className="flex items-center justify-between mt-3">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => updateQuantity(item.id, -1)}
                                                        className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200"
                                                    >
                                                        <Minus className="w-5 h-5" />
                                                    </button>
                                                    <span className="text-xl font-bold w-8 text-center">{cartItem.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, 1)}
                                                        className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center hover:bg-orange-600"
                                                    >
                                                        <Plus className="w-5 h-5" />
                                                    </button>
                                                </div>
                                                <span className="font-semibold text-gray-900">
                                                    Rs. {item.price * cartItem.quantity}
                                                </span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => addToCart(item)}
                                                className="w-full mt-3 py-3 bg-orange-100 text-orange-600 font-semibold rounded-xl hover:bg-orange-200 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Plus className="w-5 h-5" />
                                                Add
                                            </button>
                                        )}
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Floating Cart Summary */}
                    {cart.length > 0 && !showCart && (
                        <motion.div
                            initial={{ y: 100 }}
                            animate={{ y: 0 }}
                            className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg"
                        >
                            <button
                                onClick={() => setShowCart(true)}
                                className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold flex items-center justify-between px-6"
                            >
                                <div className="flex items-center gap-3">
                                    <ShoppingCart className="w-6 h-6" />
                                    <span>{cartItemCount} items</span>
                                </div>
                                <span className="text-xl">Rs. {cartTotal}</span>
                            </button>
                        </motion.div>
                    )}
                </div>
            )}

            {/* Cart Sidebar */}
            <AnimatePresence>
                {showCart && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCart(false)}
                            className="fixed inset-0 bg-black/50 z-50"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 flex flex-col"
                        >
                            {/* Cart Header */}
                            <div className="flex items-center justify-between p-4 border-b">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Order Summary</h2>
                                    <p className="text-sm text-gray-500">Table {selectedTable?.table_number}</p>
                                </div>
                                <button
                                    onClick={() => setShowCart(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <X className="w-6 h-6 text-gray-500" />
                                </button>
                            </div>

                            {/* Cart Items */}
                            <div className="flex-1 overflow-y-auto p-4">
                                {cart.length === 0 ? (
                                    <div className="text-center py-12">
                                        <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500">Your cart is empty</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {cart.map((item) => (
                                            <div key={item.id} className="bg-gray-50 rounded-xl p-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                                        <p className="text-sm text-gray-500">Rs. {item.price} each</p>
                                                        {item.notes && (
                                                            <p className="text-sm text-orange-600 mt-1">📝 {item.notes}</p>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => removeFromCart(item.id)}
                                                        className="p-1 hover:bg-red-100 rounded"
                                                    >
                                                        <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                                                    </button>
                                                </div>

                                                <div className="flex items-center justify-between mt-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, -1)}
                                                            className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center"
                                                        >
                                                            <Minus className="w-4 h-4" />
                                                        </button>
                                                        <span className="w-8 text-center font-bold">{item.quantity}</span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, 1)}
                                                            className="w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <span className="font-bold text-gray-900">
                                                        Rs. {item.price * item.quantity}
                                                    </span>
                                                </div>

                                                {/* Add Notes */}
                                                {editingItemNotes === item.id ? (
                                                    <div className="mt-3 flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={itemNotes}
                                                            onChange={(e) => setItemNotes(e.target.value)}
                                                            placeholder="Special instructions..."
                                                            className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => updateItemNotes(item.id, itemNotes)}
                                                            className="px-3 py-2 bg-orange-500 text-white rounded-lg"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setEditingItemNotes(item.id)
                                                            setItemNotes(item.notes || '')
                                                        }}
                                                        className="mt-2 text-sm text-orange-600 hover:text-orange-700"
                                                    >
                                                        {item.notes ? 'Edit note' : '+ Add note'}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Cart Footer */}
                            {cart.length > 0 && (
                                <div className="p-4 border-t bg-white">
                                    <div className="space-y-2 mb-4">
                                        <div className="flex justify-between text-gray-600">
                                            <span>Subtotal</span>
                                            <span>Rs. {cartTotal}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-600">
                                            <span>Tax (16%)</span>
                                            <span>Rs. {Math.round(cartTotal * 0.16)}</span>
                                        </div>
                                        <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t">
                                            <span>Total</span>
                                            <span>Rs. {Math.round(cartTotal * 1.16)}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSubmitOrder}
                                        disabled={isSubmitting}
                                        className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-5 h-5" />
                                                Send to Kitchen
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
