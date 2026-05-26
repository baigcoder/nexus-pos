'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Loader2, Tag, Search, Utensils, Coffee, Pizza, Beef, Wine,
  IceCream, Layers, Star, Image as ImageIcon, Clock, GripVertical, X,
  Check, Copy, Download, Upload, MoreVertical, ChevronDown, Eye, EyeOff,
  Settings2, Package, TrendingUp, AlertTriangle, Soup, Salad,
  Sparkles, FileDown, FileUp, LayoutTemplate, DollarSign, Percent, ToggleLeft,
  Megaphone, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore, useIsOwner } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import type { Category, MenuItem, MenuCustomization } from '@/types'
import {
  ALLERGENS, ALLERGEN_LABELS, DIETARY_TAG_OPTIONS, CATEGORY_ICONS,
  MENU_TEMPLATES, generateId, createEmptyCustomization, createEmptyOption,
  cloneMenuItem, exportMenuToCSV, parseCSVToItems, calculateMargin, getMarginColor,
} from '@/lib/menu-utils'

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================
export default function MenuPage() {
  const { restaurant, staff } = useAuthStore()
  const { success, error: showError, warning } = useToast()
  const isOwner = useIsOwner()
  const isViewOnly = staff?.role === 'waiter' || staff?.role === 'kitchen'
  const restaurantId = restaurant?.id

  const [categories, setCategories] = useState<Category[]>([])
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'items' | 'analytics'>('items')

  const fetchCategories = useCallback(async () => {
    if (!restaurantId) return
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true })
      if (error) throw error
      setCategories(data || [])
      if (data?.length && !selectedCategory) setSelectedCategory(data[0].id)
    } catch (err) { console.error('Error fetching categories:', err) }
  }, [restaurantId, selectedCategory])

  const fetchAllMenuItems = useCallback(async () => {
    if (!restaurantId) return
    try {
      const supabase = createClient()
      const { data } = await supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId)
      setAllMenuItems(data || [])
    } catch (err) { console.error('Error fetching menu items:', err) }
  }, [restaurantId])

  useEffect(() => { fetchCategories() }, [fetchCategories])
  useEffect(() => { if (restaurantId) fetchAllMenuItems() }, [restaurantId, fetchAllMenuItems])
  useEffect(() => { setIsLoading(false) }, [categories])

  const filteredItems = allMenuItems.filter(item => {
    if (selectedCategory && item.category_id !== selectedCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return item.name.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q)
    }
    return true
  })

  const categoryItems = selectedCategory ? allMenuItems.filter(i => i.category_id === selectedCategory) : []

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Delete this category and all its items?')) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('categories').delete().eq('id', categoryId)
      if (error) throw error
      setCategories(prev => prev.filter(c => c.id !== categoryId))
      if (selectedCategory === categoryId) setSelectedCategory(null)
      success('Deleted', 'Category removed.')
    } catch (err: any) { showError('Error', err.message) }
  }

  const handleToggleCategory = async (category: Category) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('categories').update({ is_active: !category.is_active }).eq('id', category.id)
      if (error) throw error
      setCategories(prev => prev.map(c => c.id === category.id ? { ...c, is_active: !c.is_active } : c))
    } catch (err: any) { showError('Error', err.message) }
  }

  const handleToggleItem = async (item: MenuItem) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
      if (error) throw error
      setAllMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i))
    } catch (err: any) { showError('Error', err.message) }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Delete this menu item permanently?')) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('menu_items').delete().eq('id', itemId)
      if (error) throw error
      setAllMenuItems(prev => prev.filter(i => i.id !== itemId))
      success('Deleted', 'Menu item removed.')
    } catch (err: any) { showError('Error', err.message) }
  }

  const handleDuplicateItem = async (item: MenuItem) => {
    try {
      const supabase = createClient()
      const cloned = cloneMenuItem(item)
      const { data, error } = await supabase.from('menu_items').insert({
        ...cloned,
        restaurant_id: restaurantId,
        name: `${item.name} (Copy)`,
        display_order: item.display_order + 1,
      }).select().single()
      if (error) throw error
      setAllMenuItems(prev => [...prev, data])
      success('Duplicated', 'Item copied.')
    } catch (err: any) { showError('Error', err.message) }
  }

  const handleBulkToggle = async (available: boolean) => {
    if (selectedItems.size === 0) return
    try {
      const supabase = createClient()
      const ids = Array.from(selectedItems)
      const { error } = await supabase.from('menu_items').update({ is_available: available }).in('id', ids)
      if (error) throw error
      setAllMenuItems(prev => prev.map(i => selectedItems.has(i.id) ? { ...i, is_available: available } : i))
      setSelectedItems(new Set())
      setShowBulkActions(false)
      success('Updated', `${ids.length} items ${available ? 'enabled' : 'disabled'}.`)
    } catch (err: any) { showError('Error', err.message) }
  }

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return
    if (!confirm(`Delete ${selectedItems.size} items permanently?`)) return
    try {
      const supabase = createClient()
      const ids = Array.from(selectedItems)
      const { error } = await supabase.from('menu_items').delete().in('id', ids)
      if (error) throw error
      setAllMenuItems(prev => prev.filter(i => !selectedItems.has(i.id)))
      setSelectedItems(new Set())
      setShowBulkActions(false)
      success('Deleted', `${ids.length} items removed.`)
    } catch (err: any) { showError('Error', err.message) }
  }

  const handleExportCSV = () => {
    const csv = exportMenuToCSV(categories, allMenuItems)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `menu-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    success('Exported', 'Menu CSV downloaded.')
  }

  const handleApplyTemplate = async (templateKey: string) => {
    const template = MENU_TEMPLATES[templateKey]
    if (!template || !restaurantId) return
    try {
      const supabase = createClient()
      for (let i = 0; i < template.categories.length; i++) {
        const { error } = await supabase.from('categories').insert({
          restaurant_id: restaurantId,
          name: template.categories[i],
          display_order: categories.length + i,
          icon_key: 'tag',
          is_active: true,
        })
        if (error) throw error
      }
      setShowTemplateModal(false)
      fetchCategories()
      success('Template Applied', `${template.categories.length} categories created.`)
    } catch (err: any) { showError('Error', err.message) }
  }

  const totalItems = allMenuItems.length
  const activeItems = allMenuItems.filter(i => i.is_available).length
  const outOfStock = allMenuItems.filter(i => !i.is_available).length
  const premiumItems = allMenuItems.filter(i => i.is_special).length
  const avgMargin = allMenuItems.length > 0
    ? Math.round(allMenuItems.reduce((s, i) => s + calculateMargin(i.price, i.cost_price || 0), 0) / allMenuItems.length)
    : 0

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-brand-subtle border border-brand/20 text-[10px] font-bold text-brand uppercase tracking-wider">
                {totalItems} Items
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                {activeItems} Active
              </span>
            </div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Menu <span className="text-brand">Management</span>
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Manage categories, items, customizations, and pricing</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isOwner && (
              <>
                <button onClick={() => setShowTemplateModal(true)} className="h-9 px-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] text-xs font-semibold flex items-center gap-1.5 transition-all">
                  <LayoutTemplate className="w-3.5 h-3.5" /> Templates
                </button>
                <button onClick={() => setShowImportModal(true)} className="h-9 px-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] text-xs font-semibold flex items-center gap-1.5 transition-all">
                  <FileUp className="w-3.5 h-3.5" /> Import
                </button>
                <button onClick={handleExportCSV} className="h-9 px-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] text-xs font-semibold flex items-center gap-1.5 transition-all">
                  <FileDown className="w-3.5 h-3.5" /> Export CSV
                </button>
                <button onClick={() => { setEditingCategory(null); setShowCategoryModal(true) }} className="h-9 px-4 rounded-lg bg-brand hover:bg-brand-hover text-[var(--text-primary)] text-xs font-semibold flex items-center gap-1.5 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Category
                </button>
                <button onClick={() => { setEditingItem(null); setShowItemModal(true) }} className="h-9 px-4 rounded-lg bg-brand hover:bg-brand-hover text-[var(--text-primary)] text-xs font-semibold flex items-center gap-1.5 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Item
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Total Items" value={totalItems} icon={Utensils} />
          <StatCard label="Active" value={activeItems} icon={Check} color="emerald" />
          <StatCard label="Out of Stock" value={outOfStock} icon={Package} color={outOfStock > 0 ? 'rose' : 'emerald'} />
          <StatCard label="Premium" value={premiumItems} icon={Star} color="amber" />
          <StatCard label="Avg Margin" value={`${avgMargin}%`} icon={TrendingUp} color={avgMargin >= 50 ? 'emerald' : 'amber'} />
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Categories */}
          <div className="lg:col-span-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search menu..." className="w-full h-10 pl-10 pr-4 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] outline-none focus:border-brand/50" />
            </div>

            <div className="space-y-1">
              {categories.map(cat => (
                <div key={cat.id} className={cn("group flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all", selectedCategory === cat.id ? "bg-brand text-[var(--text-primary)]" : "hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]")}>
                  <button onClick={() => setSelectedCategory(cat.id)} className="flex-1 flex items-center gap-2 min-w-0 text-left">
                    <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0", selectedCategory === cat.id ? "bg-white/20" : cat.is_active ? "bg-[var(--surface)] border border-[var(--border)]" : "bg-rose-500/10 border border-rose-500/20")}>
                      {getCategoryIcon(cat.icon_key, cat.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs font-semibold truncate", !cat.is_active && "line-through text-[var(--text-muted)]")}>{cat.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{allMenuItems.filter(i => i.category_id === cat.id).length} items</p>
                    </div>
                  </button>
                  {isOwner && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleToggleCategory(cat)} className={cn("p-1 rounded text-[10px]", cat.is_active ? "text-emerald-500 hover:bg-emerald-500/10" : "text-rose-500 hover:bg-rose-500/10")} title={cat.is_active ? 'Deactivate' : 'Activate'}>
                        {cat.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => { setEditingCategory(cat); setShowCategoryModal(true) }} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]" title="Edit">
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteCategory(cat.id)} className="p-1 rounded text-rose-500 hover:bg-rose-500/10" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Items */}
          <div className="lg:col-span-9 space-y-4">
            {/* Tabs */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1 p-1 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <button onClick={() => setActiveTab('items')} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-all", activeTab === 'items' ? "bg-brand text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]")}>Items</button>
                <button onClick={() => setActiveTab('analytics')} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-all", activeTab === 'analytics' ? "bg-brand text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]")}>Analytics</button>
              </div>
              {isOwner && selectedItems.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-brand">{selectedItems.size} selected</span>
                  <button onClick={() => handleBulkToggle(true)} className="h-8 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs font-semibold flex items-center gap-1">Enable</button>
                  <button onClick={() => handleBulkToggle(false)} className="h-8 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs font-semibold flex items-center gap-1">Disable</button>
                  <button onClick={handleBulkDelete} className="h-8 px-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs font-semibold flex items-center gap-1">Delete</button>
                  <button onClick={() => { setSelectedItems(new Set()); setShowBulkActions(false) }} className="h-8 px-3 rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)]">Cancel</button>
                </div>
              )}
            </div>

            {activeTab === 'items' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredItems.length === 0 ? (
                  <div className="col-span-2 flex flex-col items-center py-16 text-[var(--text-muted)]">
                    <Utensils className="w-12 h-12 mb-3 opacity-50" />
                    <p className="font-semibold">{selectedCategory ? 'No items in this category' : 'No menu items yet'}</p>
                    <p className="text-xs mt-1">Add items or import from CSV</p>
                  </div>
                ) : (
                  filteredItems.map(item => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      isOwner={isOwner ?? false}
                      isSelected={selectedItems.has(item.id)}
                      onSelect={(sel) => {
                        setSelectedItems(prev => {
                          const next = new Set(prev)
                          if (sel) next.add(item.id); else next.delete(item.id)
                          return next
                        })
                        if (sel) setShowBulkActions(true)
                      }}
                      onToggle={() => handleToggleItem(item)}
                      onEdit={() => { setEditingItem(item); setShowItemModal(true) }}
                      onDuplicate={() => handleDuplicateItem(item)}
                      onDelete={() => handleDeleteItem(item.id)}
                      currency={restaurant?.currency || 'PKR'}
                    />
                  ))
                )}
              </div>
            ) : (
              <MenuAnalytics categories={categories} items={allMenuItems} currency={restaurant?.currency || 'PKR'} />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCategoryModal && (
        <CategoryFormModal
          category={editingCategory}
          restaurantId={restaurantId!}
          onClose={() => { setShowCategoryModal(false); setEditingCategory(null) }}
          onSave={() => { setShowCategoryModal(false); setEditingCategory(null); fetchCategories() }}
        />
      )}
      {showItemModal && (
        <MenuItemFormModal
          item={editingItem}
          categories={categories}
          restaurantId={restaurantId!}
          selectedCategoryId={selectedCategory}
          onClose={() => { setShowItemModal(false); setEditingItem(null) }}
          onSave={() => { setShowItemModal(false); setEditingItem(null); fetchAllMenuItems() }}
          currency={restaurant?.currency || 'PKR'}
        />
      )}
      {showTemplateModal && (
        <TemplateModal onClose={() => setShowTemplateModal(false)} onApply={handleApplyTemplate} />
      )}
      {showImportModal && (
        <ImportModal categories={categories} restaurantId={restaurantId!} onClose={() => setShowImportModal(false)} onImport={() => { setShowImportModal(false); fetchAllMenuItems(); fetchCategories() }} />
      )}
    </div>
  )
}

// ============================================================
// STAT CARD
// ============================================================
function StatCard({ label, value, icon: Icon, color = 'brand' }: { label: string; value: string | number; icon: React.ElementType; color?: string }) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-subtle border-brand/20 text-brand',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600',
    rose: 'bg-rose-500/10 border-rose-500/20 text-rose-600',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-600',
  }
  return (
    <div className={cn("p-3 rounded-xl border", colors[color] || colors.brand)}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
        <Icon className="w-4 h-4 opacity-50" />
      </div>
      <p className="text-xl font-black mt-0.5">{value}</p>
    </div>
  )
}

// ============================================================
// MENU ITEM CARD
// ============================================================
function MenuItemCard({ item, isOwner, isSelected, onSelect, onToggle, onEdit, onDuplicate, onDelete, currency }: {
  item: MenuItem; isOwner: boolean; isSelected: boolean; onSelect: (v: boolean) => void;
  onToggle: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void; currency: string;
}) {
  const [showActions, setShowActions] = useState(false)
  const margin = calculateMargin(item.price, item.cost_price || 0)

  return (
    <div className={cn("group relative p-4 rounded-xl border transition-all", !item.is_available && "opacity-60", isSelected ? "border-brand bg-brand-subtle/30" : "bg-[var(--surface-raised)] border-[var(--border)] hover:border-[var(--border-strong)]")}>
      {isOwner && (
        <div className="absolute top-2 left-2">
          <input type="checkbox" checked={isSelected} onChange={e => onSelect(e.target.checked)} className="w-4 h-4 rounded border-[var(--border)] text-brand focus:ring-brand" />
        </div>
      )}
      <div className={cn("flex gap-3", isOwner && "ml-6")}>
        <div className="w-16 h-16 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0 overflow-hidden">
          {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <Utensils className="w-6 h-6 text-[var(--text-muted)]" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-sm text-[var(--text-primary)] truncate">{item.name}</p>
                {item.is_special && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
              </div>
              {item.description && <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">{item.description}</p>}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-brand">{formatCurrency(item.price, currency)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {item.preparation_time && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] flex items-center gap-0.5"><Clock className="w-3 h-3" />{item.preparation_time}m</span>}
            {(item.cost_price || 0) > 0 && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-semibold", margin >= 50 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>{margin}% margin</span>}
            {item.calories && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)]">{item.calories} cal</span>}
            {(item.dietary_tags || []).slice(0, 2).map(tag => {
              const dt = DIETARY_TAG_OPTIONS.find(d => d.value === tag)
              return dt ? <span key={tag} className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-semibold", dt.color)}>{dt.label}</span> : null
            })}
            {(item.dietary_tags || []).length > 2 && <span className="text-[10px] text-[var(--text-muted)]">+{item.dietary_tags.length - 2}</span>}
            {item.customizations?.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-semibold">{item.customizations.length} mod{item.customizations.length > 1 ? 's' : ''}</span>}
            {!item.is_available && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 font-semibold">Unavailable</span>}
          </div>
        </div>
      </div>
      {isOwner && (
        <div className={cn("mt-2 flex items-center justify-between", isOwner && "ml-6")}>
          <div className="flex items-center gap-1">
            <button onClick={onToggle} className={cn("h-7 px-2.5 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all", item.is_available ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600" : "bg-rose-500/10 border border-rose-500/30 text-rose-600")}>
              {item.is_available ? <><Check className="w-3 h-3" /> Available</> : <><X className="w-3 h-3" /> Unavailable</>}
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={onDuplicate} className="p-1.5 rounded-md hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
            <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Edit"><Settings2 className="w-3.5 h-3.5" /></button>
            <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// MENU ANALYTICS TAB
// ============================================================
function MenuAnalytics({ categories, items, currency }: { categories: Category[]; items: MenuItem[]; currency: string }) {
  const categoryStats = categories.map(cat => {
    const catItems = items.filter(i => i.category_id === cat.id)
    const avgPrice = catItems.length > 0 ? catItems.reduce((s, i) => s + i.price, 0) / catItems.length : 0
    const avgMargin = catItems.length > 0 ? catItems.reduce((s, i) => s + calculateMargin(i.price, i.cost_price || 0), 0) / catItems.length : 0
    return { ...cat, itemCount: catItems.length, avgPrice, avgMargin }
  }).filter(c => c.itemCount > 0)

  const topSelling = [...items].sort((a, b) => (b.is_available ? 1 : 0) - (a.is_available ? 1 : 0)).slice(0, 5)
  const lowMargin = [...items].filter(i => (i.cost_price || 0) > 0).sort((a, b) => calculateMargin(a.price, a.cost_price || 0) - calculateMargin(b.price, b.cost_price || 0)).slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoryStats.map(cat => (
          <div key={cat.id} className="p-4 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)]">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">{cat.name}</h3>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-[var(--text-muted)]">Items</span><span className="font-semibold">{cat.itemCount}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[var(--text-muted)]">Avg Price</span><span className="font-semibold">{formatCurrency(Math.round(cat.avgPrice), currency)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[var(--text-muted)]">Avg Margin</span><span className={cn("font-semibold", getMarginColor(cat.avgMargin))}>{cat.avgMargin.toFixed(1)}%</span></div>
            </div>
          </div>
        ))}
      </div>
      {lowMargin.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
          <h3 className="font-bold text-sm text-rose-500 flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4" />Low Margin Items</h3>
          <div className="space-y-2">
            {lowMargin.map(item => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-primary)]">{item.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--text-muted)]">{formatCurrency(item.price, currency)}</span>
                  <span className="text-[var(--text-muted)]">Cost: {formatCurrency(item.cost_price || 0, currency)}</span>
                  <span className={cn("font-bold", getMarginColor(calculateMargin(item.price, item.cost_price || 0)))}>{calculateMargin(item.price, item.cost_price || 0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// CATEGORY FORM MODAL
// ============================================================
function CategoryFormModal({ category, restaurantId, onClose, onSave }: { category: Category | null; restaurantId: string; onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState(category?.name || '')
  const [description, setDescription] = useState(category?.description || '')
  const [selectedIcon, setSelectedIcon] = useState(category?.icon_key || 'tag')
  const [displayOrder, setDisplayOrder] = useState(category?.display_order?.toString() || '0')
  const [isActive, setIsActive] = useState(category?.is_active ?? true)
  const [isSaving, setIsSaving] = useState(false)
  const { success, error: showError } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const supabase = createClient()
      const payload = { restaurant_id: restaurantId, name, description: description || null, icon_key: selectedIcon, display_order: parseInt(displayOrder) || 0, is_active: isActive }
      if (category) {
        const { error } = await supabase.from('categories').update(payload).eq('id', category.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('categories').insert(payload)
        if (error) throw error
      }
      success(category ? 'Updated' : 'Created', `Category ${category ? 'updated' : 'created'} successfully.`)
      onSave()
    } catch (err: any) { showError('Error', err.message) } finally { setIsSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{category ? 'Edit' : 'New'} <span className="text-brand">Category</span></h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="label">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50" />
          </div>
          <div className="space-y-2">
            <label className="label">Icon</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICONS.map(icon => (
                <button key={icon.value} type="button" onClick={() => setSelectedIcon(icon.value)} className={cn("w-10 h-10 rounded-lg border flex items-center justify-center text-[var(--text-muted)] transition-all", selectedIcon === icon.value ? "border-brand bg-brand-subtle text-brand" : "border-[var(--border)] hover:border-[var(--border-strong)]")}>
                  <span className="text-lg">{icon.label === 'Pizza' ? '🍕' : icon.label === 'Coffee' ? '☕' : icon.label === 'Beef' ? '🥩' : icon.label === 'Wine' ? '🍷' : icon.label === 'Dessert' ? '🍨' : icon.label === 'Soup' ? '🍜' : icon.label === 'Salad' ? '🥗' : icon.label === 'Bread' ? '🍞' : icon.label === 'Cake' ? '🎂' : '🏷️'}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="label">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="label">Display Order</label>
              <input type="number" value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50" />
            </div>
            <div className="space-y-2">
              <label className="label">Status</label>
              <button type="button" onClick={() => setIsActive(!isActive)} className={cn("w-full h-11 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5", isActive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600" : "bg-rose-500/10 border-rose-500/30 text-rose-600")}>
                {isActive ? <><Check className="w-3.5 h-3.5" /> Active</> : <><X className="w-3.5 h-3.5" /> Inactive</>}
              </button>
            </div>
          </div>
          <button type="submit" disabled={isSaving || !name.trim()} className="w-full h-11 bg-brand hover:bg-brand-hover text-[var(--text-primary)] rounded-lg font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {category ? 'Update Category' : 'Create Category'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// MENU ITEM FORM MODAL (with customizations builder)
// ============================================================
function MenuItemFormModal({ item, categories, restaurantId, selectedCategoryId, onClose, onSave, currency }: {
  item: MenuItem | null; categories: Category[]; restaurantId: string; selectedCategoryId: string | null;
  onClose: () => void; onSave: () => void; currency: string;
}) {
  const [name, setName] = useState(item?.name || '')
  const [description, setDescription] = useState(item?.description || '')
  const [price, setPrice] = useState(item?.price?.toString() || '')
  const [costPrice, setCostPrice] = useState(item?.cost_price?.toString() || '0')
  const [categoryId, setCategoryId] = useState(item?.category_id || selectedCategoryId || '')
  const [imageUrl, setImageUrl] = useState(item?.image_url || '')
  const [prepTime, setPrepTime] = useState(item?.preparation_time?.toString() || '')
  const [calories, setCalories] = useState(item?.calories?.toString() || '')
  const [dietaryTags, setDietaryTags] = useState<string[]>(item?.dietary_tags || [])
  const [allergens, setAllergens] = useState<string[]>(item?.allergens || [])
  const [isAvailable, setIsAvailable] = useState(item?.is_available ?? true)
  const [isSpecial, setIsSpecial] = useState(item?.is_special ?? false)
  const [specialUntil, setSpecialUntil] = useState(item?.special_until ? item.special_until.split('T')[0] : '')
  const [customizations, setCustomizations] = useState<MenuCustomization[]>(item?.customizations || [])
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showCustomizations, setShowCustomizations] = useState((item?.customizations?.length || 0) > 0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { success, error: showError } = useToast()

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showError('File Too Large', 'Max 5MB'); return }
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'menu-items')
      const res = await fetch('/api/menu/upload-image', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImageUrl(data.url)
      success('Uploaded', 'Image uploaded.')
    } catch (err: any) { showError('Upload Failed', err.message) } finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !price || !categoryId) { showError('Validation', 'Name, price, and category are required.'); return }
    setIsSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: name.trim(),
        description: description || null,
        price: parseFloat(price),
        cost_price: parseFloat(costPrice) || 0,
        image_url: imageUrl || null,
        dietary_tags: dietaryTags,
        allergens: allergens,
        customizations: customizations,
        is_available: isAvailable,
        is_special: isSpecial,
        special_until: specialUntil ? `${specialUntil}T23:59:59` : null,
        preparation_time: parseInt(prepTime) || null,
        calories: parseInt(calories) || null,
        display_order: item?.display_order || 0,
      }
      if (item) {
        const { error } = await supabase.from('menu_items').update(payload).eq('id', item.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('menu_items').insert(payload)
        if (error) throw error
      }
      success(item ? 'Updated' : 'Created', `Item ${item ? 'updated' : 'created'} successfully.`)
      onSave()
    } catch (err: any) { showError('Error', err.message) } finally { setIsSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl w-full max-w-2xl max-h-[90vh] shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{item ? 'Edit' : 'New'} <span className="text-brand">Item</span></h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="label">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} required className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50" />
            </div>
            <div className="space-y-2">
              <label className="label">Category *</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required className="w-full h-11 px-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm outline-none focus:border-brand/50 appearance-none">
                <option value="">Select category</option>
                {categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="label">Selling Price *</label>
              <input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} required className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50" />
            </div>
            <div className="space-y-2">
              <label className="label">Cost Price</label>
              <input type="number" step="0.01" min="0" value={costPrice} onChange={e => setCostPrice(e.target.value)} className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50" />
              {parseFloat(price) > 0 && parseFloat(costPrice) > 0 && <p className={cn("text-[10px] font-semibold", getMarginColor(calculateMargin(parseFloat(price), parseFloat(costPrice))))}>Margin: {calculateMargin(parseFloat(price), parseFloat(costPrice))}%</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="label">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 resize-none" />
          </div>

          {/* Image */}
          <div className="space-y-2">
            <label className="label">Image</label>
            <div className="flex items-center gap-3">
              {imageUrl && <img src={imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-[var(--border)]" />}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 disabled:opacity-50">
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}Upload
              </button>
              <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Or paste URL..." className="flex-1 h-9 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 text-xs text-[var(--text-primary)] outline-none focus:border-brand/50" />
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button type="button" onClick={() => setIsAvailable(!isAvailable)} className={cn("h-9 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1", isAvailable ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600" : "bg-rose-500/10 border-rose-500/30 text-rose-600")}>
              {isAvailable ? <><Check className="w-3 h-3" /> Available</> : <><X className="w-3 h-3" /> Unavailable</>}
            </button>
            <button type="button" onClick={() => setIsSpecial(!isSpecial)} className={cn("h-9 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1", isSpecial ? "bg-amber-500/10 border-amber-500/30 text-amber-600" : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]")}>
              <Star className="w-3 h-3" />{isSpecial ? 'Premium' : 'Normal'}
            </button>
            <div className="space-y-1">
              <input type="number" min="0" value={prepTime} onChange={e => setPrepTime(e.target.value)} placeholder="Prep (min)" className="w-full h-9 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 text-xs text-[var(--text-primary)] outline-none focus:border-brand/50" />
            </div>
            <div className="space-y-1">
              <input type="number" min="0" value={calories} onChange={e => setCalories(e.target.value)} placeholder="Calories" className="w-full h-9 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 text-xs text-[var(--text-primary)] outline-none focus:border-brand/50" />
            </div>
          </div>

          {isSpecial && (
            <div className="space-y-2">
              <label className="label">Special Until</label>
              <input type="date" value={specialUntil} onChange={e => setSpecialUntil(e.target.value)} className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50" />
              <p className="text-[10px] text-[var(--text-muted)]">Item will automatically stop being marked as premium after this date</p>
            </div>
          )}

          {/* Dietary Tags */}
          <div className="space-y-2">
            <label className="label">Dietary Tags</label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_TAG_OPTIONS.map(tag => (
                <button key={tag.value} type="button" onClick={() => setDietaryTags(prev => prev.includes(tag.value) ? prev.filter(t => t !== tag.value) : [...prev, tag.value])} className={cn("px-2.5 py-1 rounded-md text-xs font-semibold border transition-all", dietaryTags.includes(tag.value) ? tag.color + " border-transparent" : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]")}>
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Allergens */}
          <div className="space-y-2">
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", showAdvanced && "rotate-90")} />
              Allergens & Advanced
            </button>
            {showAdvanced && (
              <div className="space-y-3 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                <div className="space-y-2">
                  <label className="label text-[10px]">Allergens (14 major)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALLERGENS.map(a => (
                      <button key={a} type="button" onClick={() => setAllergens(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])} className={cn("px-2 py-0.5 rounded text-[10px] font-semibold border transition-all", allergens.includes(a) ? "bg-rose-500/10 border-rose-500/30 text-rose-600" : "bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-muted)]")}>
                        {ALLERGEN_LABELS[a]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Customizations Builder */}
          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between">
              <label className="label">Customizations / Modifiers</label>
              <button type="button" onClick={() => { setCustomizations(prev => [...prev, createEmptyCustomization()]); setShowCustomizations(true) }} className="h-7 px-2.5 rounded-md bg-brand-subtle border border-brand/20 text-brand text-[10px] font-bold flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Group
              </button>
            </div>
            {showCustomizations && customizations.map((cust, ci) => (
              <CustomizationEditor key={cust.id} customization={cust} index={ci} onChange={c => setCustomizations(prev => prev.map((x, i) => i === ci ? c : x))} onRemove={() => setCustomizations(prev => prev.filter((_, i) => i !== ci))} />
            ))}
          </div>
        </form>
        <div className="p-5 border-t border-[var(--border)] shrink-0">
          <button type="button" onClick={handleSave} disabled={isSaving || !name.trim() || !price} className="w-full h-11 bg-brand hover:bg-brand-hover text-[var(--text-primary)] rounded-lg font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {item ? 'Update Item' : 'Create Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CUSTOMIZATION EDITOR
// ============================================================
function CustomizationEditor({ customization, index, onChange, onRemove }: { customization: MenuCustomization; index: number; onChange: (c: MenuCustomization) => void; onRemove: () => void }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-3">
      <div className="flex items-center gap-3">
        <input value={customization.name} onChange={e => onChange({ ...customization, name: e.target.value })} placeholder="Group name (e.g. Size, Add-ons)" className="flex-1 h-9 bg-[var(--surface-raised)] border border-[var(--border)] rounded-md px-3 text-xs text-[var(--text-primary)] outline-none focus:border-brand/50" />
        <select value={customization.type} onChange={e => onChange({ ...customization, type: e.target.value as 'single' | 'multiple' })} className="h-9 px-2 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] text-xs text-[var(--text-primary)] outline-none">
          <option value="single">Single choice</option>
          <option value="multiple">Multi choice</option>
        </select>
        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)]">
          <input type="checkbox" checked={customization.required} onChange={e => onChange({ ...customization, required: e.target.checked })} className="w-3.5 h-3.5 rounded" />
          Required
        </label>
        <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-rose-500/10 text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      <div className="space-y-2 pl-2">
        {customization.options.map((opt, oi) => (
          <div key={opt.id} className="flex items-center gap-2">
            <input value={opt.name} onChange={e => onChange({ ...customization, options: customization.options.map((o, i) => i === oi ? { ...o, name: e.target.value } : o) })} placeholder="Option name" className="flex-1 h-8 bg-[var(--surface-raised)] border border-[var(--border)] rounded px-2 text-xs text-[var(--text-primary)] outline-none focus:border-brand/50" />
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--text-muted)]">+Rs</span>
              <input type="number" step="0.01" min="0" value={opt.price_modifier} onChange={e => onChange({ ...customization, options: customization.options.map((o, i) => i === oi ? { ...o, price_modifier: parseFloat(e.target.value) || 0 } : o) })} className="w-16 h-8 bg-[var(--surface-raised)] border border-[var(--border)] rounded px-2 text-xs text-[var(--text-primary)] outline-none focus:border-brand/50" />
            </div>
            <button type="button" onClick={() => onChange({ ...customization, options: customization.options.filter((_, i) => i !== oi) })} className="p-0.5 rounded hover:bg-rose-500/10 text-rose-400"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...customization, options: [...customization.options, createEmptyOption()] })} className="h-8 px-3 rounded-md border border-dashed border-[var(--border)] text-[10px] font-semibold text-[var(--text-muted)] hover:text-brand hover:border-brand transition-all flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add option
        </button>
      </div>
    </div>
  )
}

// ============================================================
// TEMPLATE MODAL
// ============================================================
function TemplateModal({ onClose, onApply }: { onClose: () => void; onApply: (key: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Menu <span className="text-brand">Templates</span></h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {Object.entries(MENU_TEMPLATES).map(([key, template]) => (
            <button key={key} onClick={() => onApply(key)} className="w-full p-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-brand/30 text-left transition-all">
              <p className="font-semibold text-sm text-[var(--text-primary)]">{template.description}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{template.categories.join(' → ')}</p>
              <p className="text-[10px] text-brand mt-1 font-semibold">{template.categories.length} categories</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// IMPORT MODAL
// ============================================================
function ImportModal({ categories, restaurantId, onClose, onImport }: { categories: Category[]; restaurantId: string; onClose: () => void; onImport: () => void }) {
  const [csv, setCsv] = useState('')
  const [selectedCat, setSelectedCat] = useState(categories[0]?.id || '')
  const [isImporting, setIsImporting] = useState(false)
  const { success, error: showError } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = async () => {
    if (!csv.trim() || !selectedCat) { showError('Error', 'Paste CSV data and select a category.'); return }
    setIsImporting(true)
    try {
      const items = parseCSVToItems(csv, selectedCat)
      if (items.length === 0) { showError('Error', 'No valid items found in CSV.'); setIsImporting(false); return }
      const supabase = createClient()
      const rows = items.map(item => ({ ...item, restaurant_id: restaurantId, is_available: true, is_active: true, customizations: [], allergens: [], cost_price: 0, dietary_tags: item.dietary_tags }))
      const { error } = await supabase.from('menu_items').insert(rows)
      if (error) throw error
      success('Imported', `${items.length} items imported.`)
      onImport()
    } catch (err: any) { showError('Error', err.message) } finally { setIsImporting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Import <span className="text-brand">CSV</span></h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="label">Target Category</label>
            <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)} className="w-full h-11 px-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm outline-none appearance-none">
              {categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="label">Paste CSV Data</label>
            <p className="text-[10px] text-[var(--text-muted)]">Format: Category,Name,Description,Price,Cost Price,Dietary Tags,Allergens,Is Available,Is Special,Prep Time,Calories</p>
            <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={6} placeholder="Paste your CSV here..." className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-brand/50 resize-none font-mono" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleImport} disabled={isImporting || !selectedCat} className="flex-1 h-10 bg-brand hover:bg-brand-hover text-[var(--text-primary)] rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}Import
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// HELPER: Get category icon
// ============================================================
function getCategoryIcon(iconKey: string | null, name: string): string {
  if (iconKey && CATEGORY_ICONS.some(i => i.value === iconKey)) return iconKey
  const n = (name || '').toLowerCase()
  if (n.includes('drink') || n.includes('beverage') || n.includes('juice')) return 'wine'
  if (n.includes('burger') || n.includes('main') || n.includes('grill')) return 'beef'
  if (n.includes('pizza')) return 'pizza'
  if (n.includes('dessert') || n.includes('sweet') || n.includes('cake')) return 'icecream'
  if (n.includes('coffee') || n.includes('tea') || n.includes('cafe')) return 'coffee'
  if (n.includes('starter') || n.includes('appetiz') || n.includes('soup')) return 'soup'
  if (n.includes('salad')) return 'salad'
  if (n.includes('bread') || n.includes('naan') || n.includes('roti')) return 'bread'
  return 'tag'
}