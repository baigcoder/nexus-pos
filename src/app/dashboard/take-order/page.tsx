'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Minus,
  ShoppingCart,
  Send,
  ChefHat,
  Trash2,
  Search,
  Grid3X3,
  Users,
  Loader2,
  CheckCircle2,
  StickyNote,
  X
} from 'lucide-react'
import { useAuthStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  description?: string
  image_url?: string
  is_available: boolean
}

interface CartItem {
  item: MenuItem
  quantity: number
  notes?: string
}

interface Table {
  id: string
  table_number: number
  capacity: number
  status: string
}

export default function TakeOrderPage() {
  const { restaurant, staff } = useAuthStore()
  const { success, error: showError } = useToast()
  const supabase = createClient()

  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [customerCount, setCustomerCount] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [tempQuantity, setTempQuantity] = useState(1)
  const [tempNotes, setTempNotes] = useState('')

  useEffect(() => {
    if (restaurant?.id) {
      loadMenuAndTables()
    }
  }, [restaurant?.id])

  async function loadMenuAndTables() {
    setIsLoading(true)
    try {
      // Load menu items
      const { data: menuData } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurant!.id)
        .eq('is_available', true)
        .order('category')

      if (menuData) {
        setMenuItems(menuData)
        const cats = [...new Set(menuData.map((item: any) => item.category))] as string[]
        setCategories(cats)
      }

      // Load tables
      const { data: tableData } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurant!.id)
        .order('table_number')

      if (tableData) {
        setTables(tableData)
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const openItemModal = (item: MenuItem) => {
    const existing = cart.find(c => c.item.id === item.id)
    setSelectedItem(item)
    setTempQuantity(existing?.quantity || 1)
    setTempNotes(existing?.notes || '')
  }

  const addItemToCart = () => {
    if (!selectedItem) return
    setCart(prev => {
      const existing = prev.find(c => c.item.id === selectedItem.id)
      if (existing) {
        return prev.map(c => c.item.id === selectedItem.id
          ? { ...c, quantity: tempQuantity, notes: tempNotes }
          : c
        )
      }
      return [...prev, { item: selectedItem, quantity: tempQuantity, notes: tempNotes }]
    })
    setSelectedItem(null)
    setTempQuantity(1)
    setTempNotes('')
  }

  const quickAddToCart = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id)
      if (existing) {
        return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, { item, quantity: 1 }]
    })
  }

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id)
      if (existing) {
        return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, { item, quantity: 1 }]
    })
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(c => c.item.id === itemId ? { ...c, quantity: c.quantity + delta } : c)
        .filter(c => c.quantity > 0)
    })
  }

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.item.id !== itemId))
  }

  const updateItemNotes = (itemId: string, notes: string) => {
    setCart(prev => prev.map(c =>
      c.item.id === itemId ? { ...c, notes } : c
    ))
  }

  const cartTotal = cart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0)
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)

  const sendToKitchen = async () => {
    if (!selectedTable) {
      showError('Select Table', 'Please select a table first')
      return
    }
    if (cart.length === 0) {
      showError('Empty Cart', 'Please add items to the order')
      return
    }

    setIsSending(true)
    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurant!.id,
          table_id: selectedTable.id,
          staff_id: staff?.id,
          status: 'pending',
          order_type: 'dine_in',
          customer_count: customerCount,
          total_amount: cartTotal,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const orderItems = cart.map(c => ({
        order_id: order.id,
        menu_item_id: c.item.id,
        quantity: c.quantity,
        unit_price: c.item.price,
        total_price: c.item.price * c.quantity,
        notes: c.notes || null,
        status: 'pending'
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      // Update table status
      await supabase
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', selectedTable.id)

      success('Order Sent!', `Order #${order.id.slice(-6)} sent to kitchen`)

      // Reset
      setCart([])
      setSelectedTable(null)
      setCustomerCount(1)
      setShowCart(false)

    } catch (err: any) {
      showError('Error', err.message || 'Failed to create order')
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading menu...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030303] text-[var(--text-primary)]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#030303]/95 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">
              Take <span className="text-brand">Order</span>
            </h1>
            <p className="text-sm text-[var(--text-muted)]">Select items and send to kitchen</p>
          </div>

          {/* Cart Button */}
          <button
            onClick={() => setShowCart(true)}
            className="relative flex items-center gap-3 px-4 py-3 bg-brand hover:bg-brand-hover rounded-xl transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="font-bold">Rs. {cartTotal.toLocaleString()}</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-white text-brand rounded-full text-xs font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Table Selection */}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-raised)]/50 border border-white/10 rounded-xl">
            <Grid3X3 className="w-4 h-4 text-[var(--text-muted)]" />
            <select
              value={selectedTable?.id || ''}
              onChange={(e) => setSelectedTable(tables.find(t => t.id === e.target.value) || null)}
              className="bg-transparent text-[var(--text-primary)] text-sm font-medium outline-none"
            >
              <option value="">Select Table</option>
              {tables.map(table => (
                <option key={table.id} value={table.id} className="bg-[var(--surface-raised)]">
                  Table {table.table_number} ({table.capacity} seats)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-raised)]/50 border border-white/10 rounded-xl">
            <Users className="w-4 h-4 text-[var(--text-muted)]" />
            <button onClick={() => setCustomerCount(Math.max(1, customerCount - 1))} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold w-6 text-center">{customerCount}</span>
            <button onClick={() => setCustomerCount(customerCount + 1)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[var(--surface-raised)]/50 border border-white/10 rounded-xl text-sm outline-none focus:border-brand/50"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors",
              selectedCategory === 'all'
                ? "bg-brand text-[var(--text-primary)]"
                : "bg-[var(--surface-raised)]/50 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors capitalize",
                selectedCategory === cat
                  ? "bg-brand text-[var(--text-primary)]"
                  : "bg-[var(--surface-raised)]/50 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredItems.map(item => {
          const inCart = cart.find(c => c.item.id === item.id)
          return (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.02 }}
              className={cn(
                "relative p-4 bg-[var(--surface-raised)]/50 border rounded-2xl text-left transition-all cursor-pointer",
                inCart ? "border-brand/50 bg-brand/5" : "border-white/10 hover:border-white/20"
              )}
              onClick={() => openItemModal(item)}
            >
              {inCart && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-brand rounded-full text-xs font-bold flex items-center justify-center z-10">
                  {inCart.quantity}
                </div>
              )}
              <div className="aspect-square bg-[var(--surface-active)] rounded-xl mb-3 flex items-center justify-center relative overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <ChefHat className="w-8 h-8 text-[var(--text-muted)]" />
                )}
              </div>
              <h3 className="font-bold text-sm text-[var(--text-primary)] truncate">{item.name}</h3>
              <p className="text-xs text-[var(--text-muted)] capitalize">{item.category}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-brand font-bold">Rs. {item.price.toLocaleString()}</p>
                <button
                  onClick={(e) => quickAddToCart(item, e)}
                  className="w-8 h-8 bg-brand hover:bg-brand-hover rounded-lg flex items-center justify-center transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Cart Drawer */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 bg-[var(--surface)]/50 z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#0a0a0a] border-l border-white/10 z-50 flex flex-col"
            >
              {/* Cart Header */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black">Order Cart</h2>
                  <button onClick={() => setShowCart(false)} className="p-2 hover:bg-white/5 rounded-xl">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {selectedTable && (
                  <Badge className="mt-2 bg-brand-subtle text-brand border-brand/20">
                    Table {selectedTable.table_number} • {customerCount} guests
                  </Badge>
                )}
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-[var(--text-muted)]">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Cart is empty</p>
                    <p className="text-sm">Tap items to add them</p>
                  </div>
                ) : (
                  cart.map(cartItem => (
                    <div key={cartItem.item.id} className="p-4 bg-[var(--surface-raised)]/50 border border-white/10 rounded-xl">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <h4 className="font-bold text-sm">{cartItem.item.name}</h4>
                          <p className="text-xs text-brand">Rs. {cartItem.item.price.toLocaleString()}</p>
                          {cartItem.notes && (
                            <p className="text-xs text-[var(--text-muted)] mt-1">Note: {cartItem.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(cartItem.item.id, -1)}
                            className="w-8 h-8 bg-[var(--surface-active)] rounded-lg flex items-center justify-center hover:bg-[var(--surface-active)]"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-6 text-center font-bold">{cartItem.quantity}</span>
                          <button
                            onClick={() => updateQuantity(cartItem.item.id, 1)}
                            className="w-8 h-8 bg-[var(--surface-active)] rounded-lg flex items-center justify-center hover:bg-[var(--surface-active)]"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setShowNotesModal(cartItem.item.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--surface-active)]/50 rounded-lg"
                        >
                          <StickyNote className="w-3 h-3" />
                          {cartItem.notes ? 'Edit Note' : 'Add Note'}
                        </button>
                        <button
                          onClick={() => removeFromCart(cartItem.item.id)}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 rounded-lg"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Footer */}
              <div className="p-6 border-t border-white/10 space-y-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-brand">Rs. {cartTotal.toLocaleString()}</span>
                </div>
                <button
                  onClick={sendToKitchen}
                  disabled={cart.length === 0 || !selectedTable || isSending}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send to Kitchen
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Notes Modal */}
      <AnimatePresence>
        {showNotesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--surface)]/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowNotesModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[var(--surface-raised)] border border-white/10 rounded-2xl p-6"
            >
              <h3 className="text-lg font-bold mb-4">Add Note</h3>
              <textarea
                value={cart.find(c => c.item.id === showNotesModal)?.notes || ''}
                onChange={(e) => updateItemNotes(showNotesModal, e.target.value)}
                placeholder="e.g., No onions, extra spicy..."
                className="w-full h-24 p-3 bg-[var(--surface-active)] border border-white/10 rounded-xl text-sm resize-none outline-none focus:border-brand/50"
              />
              <button
                onClick={() => setShowNotesModal(null)}
                className="w-full mt-4 py-3 bg-brand rounded-xl font-bold"
              >
                <CheckCircle2 className="w-4 h-4 inline mr-2" />
                Save Note
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item Selection Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--surface)]/70 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden"
            >
              {/* Item Image */}
              <div className="aspect-video bg-[var(--surface-active)] relative">
                {selectedItem.image_url ? (
                  <img src={selectedItem.image_url} alt={selectedItem.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ChefHat className="w-16 h-16 text-[var(--text-muted)]" />
                  </div>
                )}
                <button
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-[var(--surface)]/50 backdrop-blur-xl rounded-full flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Item Details */}
              <div className="p-6 space-y-5">
                <div>
                  <h3 className="text-2xl font-black">{selectedItem.name}</h3>
                  <p className="text-sm text-[var(--text-muted)] capitalize">{selectedItem.category}</p>
                  {selectedItem.description && (
                    <p className="text-sm text-[var(--text-muted)] mt-2">{selectedItem.description}</p>
                  )}
                  <p className="text-2xl font-black text-brand mt-3">Rs. {selectedItem.price.toLocaleString()}</p>
                </div>

                {/* Quantity */}
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Quantity</label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setTempQuantity(Math.max(1, tempQuantity - 1))}
                      className="w-12 h-12 bg-[var(--surface-active)] hover:bg-[var(--surface-active)] rounded-xl flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="text-3xl font-black w-16 text-center">{tempQuantity}</span>
                    <button
                      onClick={() => setTempQuantity(tempQuantity + 1)}
                      className="w-12 h-12 bg-[var(--surface-active)] hover:bg-[var(--surface-active)] rounded-xl flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Special Instructions</label>
                  <textarea
                    value={tempNotes}
                    onChange={(e) => setTempNotes(e.target.value)}
                    placeholder="e.g., No onions, extra spicy, less salt..."
                    className="w-full h-20 p-3 bg-[var(--surface-active)] border border-white/10 rounded-xl text-sm resize-none outline-none focus:border-brand/50 placeholder:text-[var(--text-muted)]"
                  />
                </div>

                {/* Add to Cart Button */}
                <button
                  onClick={addItemToCart}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl font-bold flex items-center justify-center gap-3 text-lg"
                >
                  <Plus className="w-5 h-5" />
                  Add to Order • Rs. {(selectedItem.price * tempQuantity).toLocaleString()}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
