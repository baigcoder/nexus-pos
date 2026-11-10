'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Package, Plus, AlertTriangle, TrendingDown,
  RotateCcw, Edit2, Truck, Trash2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Modal, Input, Button } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import {
  PageHeader, StatCard, DashboardSearch, FilterButton,
  EmptyState, PageLoading, containerVariants, itemVariants,
  ActionButton
} from '@/components/dashboard/shared'

interface InventoryItem {
  id: string
  restaurant_id: string
  name: string
  unit: string
  current_stock: number
  min_stock: number
  cost_per_unit: number
  supplier_name: string | null
  last_restocked: string | null
  is_active: boolean
}

export default function InventoryPage() {
  const { restaurant } = useAuthStore()
  const { success, error: showError } = useToast()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null)
  const [filter, setFilter] = useState<'all' | 'low'>('all')

  async function loadInventory() {
    if (!restaurant?.id) return
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setItems(data || [])
    } catch (err) {
      showError('Error', 'Failed to load inventory')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInventory()
  }, [restaurant?.id])

  const lowStockItems = items.filter(i => i.current_stock <= i.min_stock)
  const outOfStockItems = items.filter(i => i.current_stock === 0)
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'low' && item.current_stock <= item.min_stock)
    return matchesSearch && matchesFilter
  })

  const totalValue = items.reduce((sum, i) => sum + (i.current_stock * i.cost_per_unit), 0)

  const openAddModal = () => {
    setEditingItem(null)
    setShowModal(true)
  }

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item)
    setShowModal(true)
  }

  if (isLoading) return <PageLoading />

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-24"
    >
      <PageHeader
        title="Inventory"
        highlight="Management"
        badge="Stock Management"
        subtitle={
          <>
            Tracking <span className="text-[var(--text-primary)] font-semibold">{items.length} items</span> worth {totalValue > 0 ? `Rs.${(totalValue / 1000).toFixed(1)}K` : 'Rs.0'}
            {lowStockItems.length > 0 && (
              <span className="text-rose-500 ml-2">• {lowStockItems.length} low stock</span>
            )}
          </>
        }
        actions={
          <ActionButton
            onClick={openAddModal}
            icon={Plus}
          >
            Add Item
          </ActionButton>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Items"
          value={items.length}
          icon={Package}
          tone="info"
        />
        <StatCard
          label="Low Stock"
          value={lowStockItems.length}
          icon={TrendingDown}
          tone={lowStockItems.length > 0 ? 'error' : 'neutral'}
        />
        <StatCard
          label="Total Value"
          value={`Rs.${(totalValue / 1000).toFixed(0)}K`}
          icon={Truck}
          tone="success"
        />
        <StatCard
          label="Out of Stock"
          value={outOfStockItems.length}
          icon={AlertTriangle}
          tone={outOfStockItems.length > 0 ? 'error' : 'brand'}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <DashboardSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search items..."
          className="max-w-md"
        />
        <div className="flex gap-2">
          <FilterButton
            label="All Items"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            count={items.length}
          />
          <FilterButton
            label="Low Stock"
            active={filter === 'low'}
            onClick={() => setFilter('low')}
            count={lowStockItems.length}
          />
        </div>
      </div>

      {/* Inventory Grid */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No Items Found"
          description={searchQuery ? "No items match your search." : "Your inventory is empty. Add your first item to get started."}
          action={{ label: 'Add Item', onClick: openAddModal }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((inv) => (
            <motion.div
              key={inv.id}
              variants={itemVariants}
              className={cn(
                "group relative p-5 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl hover:border-[var(--border-strong)] transition-all",
                inv.current_stock <= inv.min_stock && 'border-rose-500/30 bg-rose-500/5'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    inv.current_stock <= inv.min_stock ? 'bg-rose-500/10 text-rose-500' : 'bg-brand-subtle text-brand'
                  )}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">{inv.name}</h3>
                    <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">{inv.unit}</p>
                  </div>
                </div>
                {inv.current_stock <= inv.min_stock && (
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-center">
                  <span className={cn("text-xl font-bold", inv.current_stock <= inv.min_stock ? 'text-rose-500' : 'text-[var(--text-primary)]')}>
                    {inv.current_stock}
                  </span>
                  <p className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-1">In Stock</p>
                </div>
                <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-center">
                  <span className="text-xl font-bold text-[var(--text-muted)]">{inv.min_stock}</span>
                  <p className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-1">Min Level</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setRestockItem(inv)}
                  className="flex-1 h-9 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3 h-3" /> Restock
                </button>
                <button
                  onClick={() => openEditModal(inv)}
                  className="h-9 w-9 bg-[var(--surface)] border border-[var(--border)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-brand hover:border-brand/30 transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? 'Edit Item' : 'Add Inventory Item'}
        size="md"
      >
        <InventoryItemForm
          item={editingItem}
          restaurantId={restaurant?.id}
          onSuccess={() => {
            setShowModal(false)
            loadInventory()
          }}
          onDelete={() => {
            setShowModal(false)
            loadInventory()
          }}
          onCancel={() => setShowModal(false)}
        />
      </Modal>

      {/* Restock Modal */}
      <Modal
        isOpen={!!restockItem}
        onClose={() => setRestockItem(null)}
        title={`Restock ${restockItem?.name || ''}`}
        size="sm"
      >
        {restockItem && (
          <RestockForm
            item={restockItem}
            onSuccess={() => {
              setRestockItem(null)
              loadInventory()
            }}
            onCancel={() => setRestockItem(null)}
          />
        )}
      </Modal>
    </motion.div>
  )
}

function InventoryItemForm({
  item,
  restaurantId,
  onSuccess,
  onDelete,
  onCancel,
}: {
  item: InventoryItem | null
  restaurantId?: string
  onSuccess: () => void
  onDelete: () => void
  onCancel: () => void
}) {
  const { success, error: showError } = useToast()
  const [form, setForm] = useState({
    name: item?.name || '',
    unit: item?.unit || '',
    current_stock: item?.current_stock?.toString() || '',
    min_stock: item?.min_stock?.toString() || '',
    cost_per_unit: item?.cost_per_unit?.toString() || '',
    supplier_name: item?.supplier_name || '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [field]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!form.name || !form.unit || !restaurantId) return
    setIsSaving(true)

    try {
      const supabase = createClient()
      const payload = {
        name: form.name.trim(),
        unit: form.unit.trim(),
        current_stock: parseFloat(form.current_stock) || 0,
        min_stock: parseFloat(form.min_stock) || 0,
        cost_per_unit: parseFloat(form.cost_per_unit) || 0,
        supplier_name: form.supplier_name.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (item) {
        const { error } = await supabase
          .from('inventory')
          .update(payload)
          .eq('id', item.id)
        if (error) throw error
        success('Updated', 'Item updated successfully')
      } else {
        const { error } = await supabase
          .from('inventory')
          .insert({
            ...payload,
            restaurant_id: restaurantId,
            is_active: true,
          })
        if (error) throw error
        success('Created', 'Item added to inventory')
      }

      onSuccess()
    } catch (err) {
      showError('Error', `Failed to ${item ? 'update' : 'add'} item`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!item || !confirm('Remove this item from inventory?')) return
    setIsDeleting(true)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('inventory')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', item.id)
      if (error) throw error
      success('Removed', 'Item removed from inventory')
      onDelete()
    } catch (err) {
      showError('Error', 'Failed to remove item')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Input label="Item Name" value={form.name} onChange={handleChange('name')} placeholder="e.g., Chicken Breast" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Unit" value={form.unit} onChange={handleChange('unit')} placeholder="kg, liters, pcs" />
        <Input label="Supplier" value={form.supplier_name} onChange={handleChange('supplier_name')} placeholder="Optional" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input label="In Stock" type="number" min="0" step="any" value={form.current_stock} onChange={handleChange('current_stock')} placeholder="0" />
        <Input label="Min Level" type="number" min="0" step="any" value={form.min_stock} onChange={handleChange('min_stock')} placeholder="0" />
        <Input label="Cost / Unit" type="number" min="0" step="any" value={form.cost_per_unit} onChange={handleChange('cost_per_unit')} placeholder="0" />
      </div>

      <div className="flex gap-3 pt-2">
        {item && (
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={isDeleting}
            icon={Trash2}
            className="h-12"
          >
            Remove
          </Button>
        )}
        <Button variant="outline" onClick={onCancel} className="flex-1 h-12">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!form.name || !form.unit || isSaving}
          isLoading={isSaving}
          className="flex-1 h-12"
        >
          {item ? 'Save Changes' : 'Add Item'}
        </Button>
      </div>
    </div>
  )
}

function RestockForm({
  item,
  onSuccess,
  onCancel,
}: {
  item: InventoryItem
  onSuccess: () => void
  onCancel: () => void
}) {
  const { success, error: showError } = useToast()
  const [quantity, setQuantity] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleRestock = async () => {
    const amount = parseFloat(quantity)
    if (!amount || amount <= 0) return
    setIsSaving(true)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('inventory')
        .update({
          current_stock: item.current_stock + amount,
          last_restocked: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      if (error) throw error
      success('Restocked', `Added ${amount} ${item.unit} to ${item.name}`)
      onSuccess()
    } catch (err) {
      showError('Error', 'Failed to restock item')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-center">
        <span className="text-xl font-bold text-[var(--text-primary)]">{item.current_stock}</span>
        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-1">
          Current Stock ({item.unit})
        </p>
      </div>
      <Input
        label={`Quantity to Add (${item.unit})`}
        type="number"
        min="0"
        step="any"
        value={quantity}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
        placeholder="0"
        autoFocus
      />
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-12">
          Cancel
        </Button>
        <Button
          onClick={handleRestock}
          disabled={!quantity || parseFloat(quantity) <= 0 || isSaving}
          isLoading={isSaving}
          icon={RotateCcw}
          className="flex-1 h-12"
        >
          Restock
        </Button>
      </div>
    </div>
  )
}
