'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Package, Plus, Search, AlertTriangle, TrendingDown,
  RotateCcw, Edit2, Truck
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'
import {
  PageHeader, StatCard, DashboardSearch, FilterButton,
  EmptyState, PageLoading, containerVariants, itemVariants,
  SectionCard, ActionButton
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
  const [filter, setFilter] = useState<'all' | 'low'>('all')

  useEffect(() => {
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
    loadInventory()
  }, [restaurant?.id])

  const lowStockItems = items.filter(i => i.current_stock <= i.min_stock)
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'low' && item.current_stock <= item.min_stock)
    return matchesSearch && matchesFilter
  })

  const totalValue = items.reduce((sum, i) => sum + (i.current_stock * i.cost_per_unit), 0)

  const handleRestock = async (id: string) => {
    try {
      const supabase = createClient()
      const item = items.find(i => i.id === id)
      if (!item) return

      const { error } = await supabase
        .from('inventory')
        .update({
          current_stock: item.current_stock + 10,
          last_restocked: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
      setItems(items.map(i => i.id === id ? { ...i, current_stock: i.current_stock + 10, last_restocked: new Date().toISOString().split('T')[0] } : i))
      success('Restocked', 'Added 10 units to inventory')
    } catch (err) {
      showError('Error', 'Failed to restock item')
    }
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
            onClick={() => setShowModal(true)}
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
          label="Categories"
          value="6"
          icon={Package}
          tone="brand"
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
          action={{ label: 'Add Item', onClick: () => setShowModal(true) }}
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
                  onClick={() => handleRestock(inv.id)}
                  className="flex-1 h-9 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3 h-3" /> Restock
                </button>
                <button className="h-9 w-9 bg-[var(--surface)] border border-[var(--border)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-brand hover:border-brand/30 transition-all">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
