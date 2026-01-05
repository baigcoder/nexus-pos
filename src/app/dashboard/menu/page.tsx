'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Plus,
    Edit2,
    Trash2,
    Loader2,
    Check,
    FolderOpen,
    Tag,
    X,
    ChevronRight,
    Search,
    Utensils,
    Coffee,
    IceCream,
    Pizza,
    Beef,
    Wine,
    Settings2,
    MoreHorizontal,
    Star,
    Save,
    Image as ImageIcon,
    Clock,
    AlertTriangle,
    Package,
    TrendingUp,
    Layers
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Input, Modal, LoadingSpinner } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import type { Category, MenuItem } from '@/types'

// Category icon options for the owner to select
const CATEGORY_ICONS = [
    { value: 'tag', icon: Tag, label: 'Tag' },
    { value: 'utensils', icon: Utensils, label: 'Utensils' },
    { value: 'coffee', icon: Coffee, label: 'Coffee' },
    { value: 'pizza', icon: Pizza, label: 'Pizza' },
    { value: 'beef', icon: Beef, label: 'Beef' },
    { value: 'wine', icon: Wine, label: 'Wine' },
    { value: 'icecream', icon: IceCream, label: 'Dessert' },
    { value: 'layers', icon: Layers, label: 'Layers' },
]

// Map category names to icons for a more visual experience
const getCategoryIcon = (name: string, iconKey?: string) => {
    if (iconKey) {
        const found = CATEGORY_ICONS.find(i => i.value === iconKey)
        if (found) return found.icon
    }
    const n = name.toLowerCase()
    if (n.includes('drink') || n.includes('beverage')) return Wine
    if (n.includes('burger') || n.includes('main')) return Beef
    if (n.includes('pizza')) return Pizza
    if (n.includes('dessert') || n.includes('sweet')) return IceCream
    if (n.includes('coffee') || n.includes('cafe')) return Coffee
    if (n.includes('starter') || n.includes('appetizer')) return Utensils
    return Tag
}

// Menu Stats Component for Operational Insights
function MenuStats({ categories, items }: { categories: Category[], items: MenuItem[] }) {
    const totalItems = items.length
    const activeItems = items.filter(i => i.is_available).length
    const outOfStock = totalItems - activeItems
    const specialItems = items.filter(i => i.is_special).length

    const stats = [
        { label: 'Total Items', value: totalItems, icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Active', value: activeItems, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Out of Stock', value: outOfStock, icon: AlertTriangle, color: outOfStock > 0 ? 'text-rose-500' : 'text-neutral-500', bg: outOfStock > 0 ? 'bg-rose-500/10' : 'bg-neutral-800' },
        { label: 'Premium Class', value: specialItems, icon: Star, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(stat => (
                <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("p-4 rounded-2xl border border-neutral-800/50 backdrop-blur-md flex items-center gap-4", stat.bg)}
                >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.bg)}>
                        <stat.icon className={cn("w-5 h-5", stat.color)} />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-white">{stat.value}</p>
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{stat.label}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    )
}

export default function MenuPage() {
    const { restaurant, staff, user } = useAuthStore()
    const { success, error: toastError } = useToast()
    const [categories, setCategories] = useState<Category[]>([])
    const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showCategoryModal, setShowCategoryModal] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

    // Waiters see read-only view
    const isViewOnly = staff?.role === 'waiter' || staff?.role === 'kitchen'

    useEffect(() => {
        if (restaurant?.id) {
            fetchCategories()
            fetchAllMenuItems()
        }
    }, [restaurant?.id])

    const fetchCategories = async () => {
        if (!restaurant?.id) return
        setIsLoading(true)
        try {
            const supabase = createClient()
            const { data, error: fetchError } = await supabase
                .from('categories')
                .select('*')
                .eq('restaurant_id', restaurant.id)
                .order('display_order', { ascending: true })

            if (fetchError) throw fetchError
            setCategories(data || [])
            if (data && data.length > 0 && !selectedCategory) {
                setSelectedCategory(data[0].id)
            }
        } catch (err) {
            console.error('Error fetching categories:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchAllMenuItems = async () => {
        if (!restaurant?.id) return
        try {
            const supabase = createClient()
            const { data } = await supabase
                .from('menu_items')
                .select('*')
                .eq('restaurant_id', restaurant.id)
            setAllMenuItems(data || [])
        } catch (err) {
            console.error('Error fetching all menu items:', err)
        }
    }

    const handleDeleteCategory = async (categoryId: string) => {
        if (!confirm('Are you sure? This will permanently remove the category.')) return
        try {
            const supabase = createClient()
            const { error: deleteError } = await supabase
                .from('categories')
                .delete()
                .eq('id', categoryId)
            if (deleteError) throw deleteError
            setCategories(categories.filter(c => c.id !== categoryId))
            if (selectedCategory === categoryId) setSelectedCategory(null)
            success('Category Deleted', 'The category has been removed.')
        } catch (err: any) {
            toastError('Failed', err.message)
        }
    }

    const filteredCategories = categories.filter(category =>
        category.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const itemFade = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    }

    return (
        <div className="relative min-h-screen bg-black overflow-hidden">
            {/* Background Mesh Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-orange-600/10 blur-[120px] rounded-full"
                />
                <motion.div
                    animate={{ x: [0, -80, 0], y: [0, 100, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[20%] -right-[5%] w-[40%] h-[40%] bg-blue-600/5 blur-[100px] rounded-full"
                />
            </div>

            <div className="px-2 lg:px-4 space-y-10 animate-in fade-in duration-700 relative z-10 pb-32">
                {/* Header Section: Premium Balance */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pt-4">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="px-3 py-1 rounded-full bg-orange-600/10 border border-orange-600/20">
                                <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em]">Menu Engine v3.0</span>
                            </div>
                            <div className="h-px w-8 bg-neutral-800" />
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-xs">Premium Inventory</span>
                        </div>

                        <div className="space-y-1">
                            <motion.h1
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-5xl lg:text-7xl font-black text-white tracking-tight leading-[0.9] uppercase"
                            >
                                Menu <br />
                                <span className="bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 bg-clip-text text-transparent">
                                    Manager
                                </span>
                            </motion.h1>
                            <p className="text-lg text-neutral-500 font-medium">
                                Manage <span className="text-white font-bold">{categories.length} categories</span> and all your menu items.
                            </p>
                        </div>
                    </div>

                    {!isViewOnly && (
                        <div className="flex items-center gap-4">
                            <motion.button
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowCategoryModal(true)}
                                className="group relative h-14 px-10 bg-orange-600 rounded-2xl flex items-center gap-3 overflow-hidden shadow-2xl shadow-orange-600/20 transition-all font-black uppercase tracking-widest text-sm text-white"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                <Plus className="w-5 h-5" />
                                New Category
                            </motion.button>
                        </div>
                    )}
                </header>

                {/* Menu Stats Bar for Owner Insights */}
                {!isViewOnly && allMenuItems.length > 0 && (
                    <MenuStats categories={categories} items={allMenuItems} />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Visual Category Navigation */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-orange-600/5 blur-2xl rounded-3xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                            <div className="relative">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-orange-600 transition-colors" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Locate Category..."
                                    className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl pl-12 pr-6 h-14 text-xs font-bold uppercase tracking-widest outline-none focus:border-orange-600/50 focus:bg-black transition-all text-white placeholder:text-neutral-700 shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-3">
                                <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em]">Segments</span>
                                <div className="px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-[10px] font-bold text-white uppercase tracking-widest">
                                    {categories.length}
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="py-20 flex justify-center"><LoadingSpinner /></div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {filteredCategories.map((category) => {
                                        const Icon = getCategoryIcon(category.name)
                                        const isActive = selectedCategory === category.id

                                        return (
                                            <button
                                                key={category.id}
                                                onClick={() => setSelectedCategory(category.id)}
                                                className={cn(
                                                    'group flex items-center gap-4 p-4 rounded-2xl transition-all relative overflow-hidden text-left border-2',
                                                    isActive
                                                        ? 'bg-white border-white text-black shadow-[0_20px_40px_-15px_rgba(255,255,255,0.3)]'
                                                        : 'bg-neutral-900/40 backdrop-blur-md border-neutral-800/50 text-neutral-500 hover:border-orange-600/30 hover:bg-neutral-800/60'
                                                )}
                                            >
                                                <div className={cn(
                                                    'w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-inner',
                                                    isActive
                                                        ? 'bg-orange-600 text-white shadow-orange-900/20'
                                                        : 'bg-neutral-800 text-neutral-600 group-hover:text-orange-600'
                                                )}>
                                                    <Icon className="w-6 h-6" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <span className="block font-black uppercase tracking-tight text-sm lg:text-base truncate">{category.name}</span>
                                                    <span className={cn(
                                                        "text-[10px] font-black uppercase tracking-[0.2em]",
                                                        isActive ? "text-neutral-400" : "text-neutral-700"
                                                    )}>
                                                        Engine Ready
                                                    </span>
                                                </div>

                                                {!isViewOnly && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setEditingCategory(category); setShowCategoryModal(true); }}
                                                        className={cn(
                                                            "p-2 rounded-xl border transition-all opacity-0 group-hover:opacity-100",
                                                            isActive
                                                                ? "border-neutral-200 text-neutral-500 hover:bg-black hover:text-white"
                                                                : "border-neutral-800 text-neutral-700 hover:text-orange-600 hover:border-orange-600/30 hover:bg-neutral-900"
                                                        )}
                                                    >
                                                        <Settings2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dynamic Content Plane */}
                    <div className="lg:col-span-9">
                        <AnimatePresence mode="wait">
                            {selectedCategory ? (
                                <motion.div
                                    key={selectedCategory}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                >
                                    <MenuItemsPanel
                                        categoryId={selectedCategory}
                                        restaurantId={restaurant?.id || ''}
                                        category={categories.find(c => c.id === selectedCategory)}
                                        onDeleteCategory={() => handleDeleteCategory(selectedCategory)}
                                        isViewOnly={isViewOnly}
                                    />
                                </motion.div>
                            ) : (
                                <Card className="h-[60vh] flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 bg-neutral-950/50 backdrop-blur-3xl rounded-3xl">
                                    <div className="relative mb-8">
                                        <div className="absolute inset-0 bg-orange-600/20 blur-[100px] rounded-full" />
                                        <FolderOpen className="w-16 h-16 text-neutral-800 relative" />
                                    </div>
                                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Select a Category</h2>
                                    <p className="mt-4 text-neutral-500 font-bold uppercase tracking-[0.2em] text-[10px]">Choose a category from the left to view and manage its items</p>
                                </Card>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Category Intelligence Modal */}
                <AnimatePresence>
                    {showCategoryModal && (
                        <Modal
                            isOpen={showCategoryModal}
                            onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                            title={editingCategory ? 'Modify Segment' : 'Define New Segment'}
                            size="md"
                            className="bg-black border-neutral-800"
                        >
                            <CategoryForm
                                category={editingCategory}
                                restaurantId={restaurant?.id || ''}
                                onSuccess={() => { fetchCategories(); setShowCategoryModal(false); setEditingCategory(null); }}
                                onCancel={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                            />
                        </Modal>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

function CategoryForm({ category, restaurantId, onSuccess, onCancel }: any) {
    const [isLoading, setIsLoading] = useState(false)
    const [name, setName] = useState(category?.name || '')
    const [description, setDescription] = useState(category?.description || '')
    const [selectedIcon, setSelectedIcon] = useState(category?.icon_key || 'tag')
    const [displayOrder, setDisplayOrder] = useState(category?.display_order?.toString() || '0')

    const handleSubmit = async (e: any) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const supabase = createClient()
            const payload = {
                restaurant_id: restaurantId,
                name,
                description: description || null,
                display_order: parseInt(displayOrder) || 0
            }
            if (category) {
                await supabase.from('categories').update(payload).eq('id', category.id)
            } else {
                await supabase.from('categories').insert(payload)
            }
            onSuccess()
        } catch (err) { console.error(err) } finally { setIsLoading(false) }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 p-2">
            <div className="space-y-6">
                <div>
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-3 block">Segment Name</label>
                    <Input
                        value={name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                        placeholder="e.g. Beverages, Main Course, Desserts"
                        required
                        className="h-14 bg-neutral-900 border-neutral-800 text-white font-bold text-sm focus:border-orange-600/50 rounded-2xl"
                    />
                </div>

                <div>
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-3 block">Icon</label>
                    <div className="flex flex-wrap gap-3">
                        {CATEGORY_ICONS.map(iconOpt => {
                            const IconComponent = iconOpt.icon
                            return (
                                <button
                                    key={iconOpt.value}
                                    type="button"
                                    onClick={() => setSelectedIcon(iconOpt.value)}
                                    className={cn(
                                        'w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all',
                                        selectedIcon === iconOpt.value
                                            ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-600/20'
                                            : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-orange-600/30 hover:text-white'
                                    )}
                                >
                                    <IconComponent className="w-6 h-6" />
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-3 block">Display Order</label>
                        <Input
                            type="number"
                            value={displayOrder}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayOrder(e.target.value)}
                            placeholder="0"
                            className="h-14 bg-neutral-900 border-neutral-800 text-white font-bold text-sm focus:border-orange-600/50 rounded-2xl"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-3 block">Description</label>
                    <textarea
                        value={description}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                        placeholder="A brief description of this category..."
                        rows={3}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-white font-medium text-sm outline-none focus:border-orange-600/50 transition-all resize-none"
                    />
                </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-neutral-800/50">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={onCancel}
                    className="flex-1 h-14 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] border border-neutral-800 text-neutral-500 hover:bg-neutral-900 hover:text-white transition-all outline-none"
                >
                    Cancel
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 h-14 rounded-2xl bg-orange-600 text-white font-black uppercase text-[10px] tracking-[0.2em] border-none shadow-2xl shadow-orange-600/20 flex items-center justify-center gap-3 relative overflow-hidden group disabled:opacity-50 outline-none"
                >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 relative z-10" />}
                    <span className="relative z-10">{category ? 'Update Category' : 'Create Category'}</span>
                </motion.button>
            </div>
        </form>
    )
}

function MenuItemsPanel({ categoryId, restaurantId, category, onDeleteCategory, isViewOnly }: any) {
    const { success, error: toastError } = useToast()
    const [items, setItems] = useState<MenuItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showItemModal, setShowItemModal] = useState(false)
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null)

    useEffect(() => { fetchItems() }, [categoryId])

    const fetchItems = async () => {
        setIsLoading(true)
        try {
            const supabase = createClient()
            const { data } = await supabase.from('menu_items').select('*').eq('category_id', categoryId).order('display_order', { ascending: true })
            setItems(data || [])
        } finally { setIsLoading(false) }
    }

    const handleToggleStock = async (item: MenuItem) => {
        try {
            const supabase = createClient()
            await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
            setItems(items.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i))
            success(item.is_available ? 'Offlined' : 'Onlined', `${item.name} availability toggled.`)
        } catch (err) { toastError('Interface Error') }
    }

    if (isLoading) return <div className="py-24 flex justify-center"><LoadingSpinner size="lg" /></div>

    return (
        <div className="space-y-8">
            {/* Context Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-10 border-b border-neutral-800/50">
                <div className="space-y-6">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-orange-600 flex items-center justify-center text-white shadow-[0_20px_40px_-15px_rgba(234,88,12,0.4)] relative group overflow-hidden">
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                            {React.createElement(getCategoryIcon(category?.name || ''), { className: "w-8 h-8 relative z-10" })}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-px w-8 bg-orange-600/50" />
                                <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em]">Category</span>
                            </div>
                            <h2 className="text-4xl lg:text-5xl font-black text-white uppercase tracking-tighter leading-none">{category?.name}</h2>
                            <p className="text-xs font-bold text-neutral-500 uppercase tracking-[0.2em] mt-3"><span className="text-white">{items.length} items</span> in this category</p>
                        </div>
                    </div>
                </div>

                {!isViewOnly && (
                    <div className="flex items-center gap-4">
                        <motion.button
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onDeleteCategory}
                            className="h-14 px-8 rounded-2xl text-rose-500 hover:bg-rose-500/10 font-black uppercase text-[10px] tracking-[0.2em] transition-all border border-transparent hover:border-rose-500/20"
                        >
                            Delete Category
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowItemModal(true)}
                            className="h-14 px-10 rounded-2xl bg-white text-black font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-white/5 hover:bg-orange-600 hover:text-white transition-all flex items-center gap-3 border-none"
                        >
                            <Plus className="w-4 h-4" />
                            Add Item
                        </motion.button>
                    </div>
                )}
            </div>

            {items.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center text-center bg-neutral-900/20 backdrop-blur-xl rounded-3xl border border-neutral-800 border-dashed">
                    <Tag className="w-16 h-16 mb-6 text-neutral-800" />
                    <h3 className="text-2xl font-black text-neutral-700 uppercase tracking-tight">No Items Yet</h3>
                    <p className="text-[10px] text-neutral-500 font-bold mt-3 uppercase tracking-[0.2em]">Add your first menu item to this category</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {items.map((item, idx) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05, type: 'spring', damping: 20 }}
                            className="relative group perspective-1000"
                        >
                            {/* Outer Glow Effect */}
                            <div className="absolute -inset-0.5 bg-gradient-to-br from-orange-600 to-orange-900 rounded-2xl blur opacity-0 group-hover:opacity-20 transition duration-500" />

                            <div className={cn(
                                'relative h-full p-6 rounded-2xl border border-neutral-800/50 backdrop-blur-3xl transition-all duration-500 flex flex-col gap-8',
                                item.is_available
                                    ? 'bg-neutral-900/40 hover:border-orange-600/30'
                                    : 'bg-neutral-950/80 border-neutral-900 opacity-60 grayscale'
                            )}>
                                {!item.is_available && (
                                    <div className="absolute top-6 right-6 z-10">
                                        <div className="px-4 py-1.5 rounded-full bg-rose-600/10 border border-rose-600/20 text-[10px] font-black text-rose-500 uppercase tracking-widest">Unavailable</div>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row gap-8">
                                    <div className="relative shrink-0 mx-auto sm:mx-0">
                                        <div className="w-40 h-40 rounded-2xl overflow-hidden bg-black border border-neutral-800 flex items-center justify-center group-hover:border-orange-600/30 transition-all duration-700 shadow-2xl">
                                            {item.image_url ? (
                                                <img src={item.image_url} className="w-full h-full object-cover scale-100 group-hover:scale-110 transition-transform duration-1000" />
                                            ) : (
                                                <Utensils className="w-12 h-12 text-neutral-800 group-hover:text-orange-600/20 transition-colors" />
                                            )}
                                        </div>
                                        {item.is_special && (
                                            <div className="absolute -top-3 -right-3 w-12 h-12 bg-white text-black rounded-2xl flex items-center justify-center shadow-2xl scale-110 z-10 border border-neutral-100">
                                                <Star className="w-6 h-6 fill-orange-600 text-orange-600" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 flex flex-col">
                                        <div className="space-y-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <h3 className="font-black text-white uppercase tracking-tight text-2xl leading-tight group-hover:text-orange-600 transition-colors">{item.name}</h3>
                                                <div className="px-5 py-2 rounded-2xl bg-orange-600 text-white shadow-xl shadow-orange-600/20 shrink-0">
                                                    <span className="font-black text-xl tracking-tight">Rs. {item.price}</span>
                                                </div>
                                            </div>
                                            <p className="text-sm text-neutral-400 font-medium line-clamp-2 leading-relaxed">{item.description || "No description provided."}</p>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-neutral-800/50 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {item.preparation_time && (
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 rounded-xl border border-blue-600/20">
                                                        <Clock className="w-3 h-3 text-blue-500" />
                                                        <span className="text-[10px] font-bold text-blue-500">{item.preparation_time} min</span>
                                                    </div>
                                                )}
                                                {item.dietary_tags?.slice(0, 2).map((tag: string) => (
                                                    <div key={tag} className="px-3 py-1.5 bg-neutral-800/50 rounded-xl text-[10px] font-black text-neutral-500 uppercase tracking-widest border border-neutral-800/50">
                                                        {tag}
                                                    </div>
                                                ))}
                                            </div>

                                            {!isViewOnly && (
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => handleToggleStock(item)}
                                                        className={cn(
                                                            'h-12 w-12 rounded-2xl flex items-center justify-center transition-all bg-neutral-800/50 border border-neutral-700/50 hover:scale-110 active:scale-95',
                                                            item.is_available ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-rose-500 hover:bg-rose-500/10'
                                                        )}
                                                    >
                                                        {item.is_available ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5 rotate-45" />}
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingItem(item); setShowItemModal(true); }}
                                                        className="h-12 w-12 rounded-2xl bg-orange-600 text-white hover:bg-white hover:text-black transition-all flex items-center justify-center shadow-xl shadow-orange-600/10 hover:scale-110 active:scale-95 border-none"
                                                    >
                                                        <Settings2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {showItemModal && (
                    <Modal
                        isOpen={showItemModal}
                        onClose={() => { setShowItemModal(false); setEditingItem(null); }}
                        title={editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
                        size="lg"
                        className="bg-black border-neutral-800"
                    >
                        <MenuItemForm
                            categoryId={categoryId}
                            restaurantId={restaurantId}
                            item={editingItem}
                            onSuccess={() => { fetchItems(); setShowItemModal(false); setEditingItem(null); }}
                            onCancel={() => { setShowItemModal(false); setEditingItem(null); }}
                        />
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    )
}

function MenuItemForm({ categoryId, restaurantId, item, onSuccess, onCancel }: any) {
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: item?.name || '',
        description: item?.description || '',
        price: item?.price?.toString() || '',
        image_url: item?.image_url || '',
        preparation_time: item?.preparation_time?.toString() || '',
        dietary_tags: item?.dietary_tags || [],
        is_available: item?.is_available ?? true,
        is_special: item?.is_special ?? false,
    })

    const dietaryOptions = [
        { value: 'vegan', label: 'Vegan', icon: '🌱' },
        { value: 'vegetarian', label: 'Vegetarian', icon: '🥬' },
        { value: 'spicy', label: 'Spicy', icon: '🌶️' },
        { value: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
        { value: 'halal', label: 'Halal', icon: '☪️' },
        { value: 'dairy-free', label: 'Dairy-Free', icon: '🥛' },
    ]

    const handleSubmit = async (e: any) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const supabase = createClient()
            const payload = {
                name: formData.name,
                description: formData.description || null,
                price: parseFloat(formData.price),
                image_url: formData.image_url || null,
                preparation_time: formData.preparation_time ? parseInt(formData.preparation_time) : null,
                dietary_tags: formData.dietary_tags,
                is_available: formData.is_available,
                is_special: formData.is_special,
                category_id: categoryId,
                restaurant_id: restaurantId,
                display_order: item?.display_order || 0
            }
            if (item) {
                await supabase.from('menu_items').update(payload).eq('id', item.id)
            } else {
                await supabase.from('menu_items').insert(payload)
            }
            onSuccess()
        } catch (err) { console.error(err) } finally { setIsLoading(false) }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 p-2">
            {/* Basic Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-3 block">Item Name</label>
                        <Input
                            value={formData.name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Classic Cheese Burger"
                            required
                            className="h-14 bg-neutral-900 border-neutral-800 text-white font-bold text-sm focus:border-orange-600/50 rounded-2xl"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-3 block">Price (Rs.)</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.price}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, price: e.target.value })}
                                placeholder="0.00"
                                required
                                className="h-14 bg-neutral-900 border-neutral-800 text-white font-bold text-sm focus:border-orange-600/50 rounded-2xl"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-3 block flex items-center gap-2">
                                <Clock className="w-3 h-3" /> Prep Time (min)
                            </label>
                            <Input
                                type="number"
                                value={formData.preparation_time}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, preparation_time: e.target.value })}
                                placeholder="e.g. 15"
                                className="h-14 bg-neutral-900 border-neutral-800 text-white font-bold text-sm focus:border-orange-600/50 rounded-2xl"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-3 block">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="A delicious item with fresh ingredients..."
                            rows={4}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-white font-medium text-sm outline-none focus:border-orange-600/50 transition-all resize-none"
                        />
                    </div>
                </div>

                {/* Image & Status */}
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-3 block">Image URL</label>
                        <Input
                            value={formData.image_url}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, image_url: e.target.value })}
                            placeholder="https://example.com/image.jpg"
                            className="h-14 bg-neutral-900 border-neutral-800 text-white font-medium text-sm focus:border-orange-600/50 rounded-2xl"
                        />
                    </div>

                    {/* Image Preview */}
                    <div className="w-full h-40 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden">
                        {formData.image_url ? (
                            <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        ) : (
                            <div className="text-center">
                                <ImageIcon className="w-10 h-10 text-neutral-700 mx-auto mb-2" />
                                <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Image Preview</p>
                            </div>
                        )}
                    </div>

                    {/* Status Toggles */}
                    <div className="grid grid-cols-2 gap-4">
                        <label className="flex items-center gap-4 cursor-pointer group bg-neutral-900 h-14 w-full border border-neutral-800 rounded-2xl px-4 hover:border-orange-600/30 transition-all">
                            <div className={cn(
                                "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                formData.is_available ? "bg-emerald-600 border-emerald-600" : "bg-black border-neutral-700"
                            )}>
                                <input type="checkbox" className="hidden" checked={formData.is_available} onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })} />
                                {formData.is_available && <Check className="w-4 h-4 text-white" />}
                            </div>
                            <span className="text-[10px] font-black text-neutral-400 group-hover:text-white uppercase tracking-widest">In Stock</span>
                        </label>
                        <label className="flex items-center gap-4 cursor-pointer group bg-neutral-900 h-14 w-full border border-neutral-800 rounded-2xl px-4 hover:border-orange-600/30 transition-all">
                            <div className={cn(
                                "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                formData.is_special ? "bg-orange-600 border-orange-600" : "bg-black border-neutral-700"
                            )}>
                                <input type="checkbox" className="hidden" checked={formData.is_special} onChange={(e) => setFormData({ ...formData, is_special: e.target.checked })} />
                                {formData.is_special && <Star className="w-4 h-4 text-white fill-white" />}
                            </div>
                            <span className="text-[10px] font-black text-neutral-400 group-hover:text-white uppercase tracking-widest">Premium</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Dietary Tags */}
            <div className="space-y-4">
                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em]">Dietary Tags</label>
                <div className="flex flex-wrap gap-3">
                    {dietaryOptions.map(opt => (
                        <motion.button
                            key={opt.value}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={() => {
                                const tags = formData.dietary_tags.includes(opt.value)
                                    ? formData.dietary_tags.filter((t: string) => t !== opt.value)
                                    : [...formData.dietary_tags, opt.value]
                                setFormData({ ...formData, dietary_tags: tags })
                            }}
                            className={cn(
                                'px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border-2 outline-none',
                                formData.dietary_tags.includes(opt.value)
                                    ? 'bg-white text-black border-white'
                                    : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:border-orange-600/30'
                            )}
                        >
                            <span>{opt.icon}</span>
                            <span>{opt.label}</span>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-6 border-t border-neutral-800/50">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={onCancel}
                    className="flex-1 h-14 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] border border-neutral-800 text-neutral-500 hover:bg-neutral-900 hover:text-white transition-all outline-none"
                >
                    Cancel
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 h-14 rounded-2xl bg-orange-600 text-white font-black uppercase text-[10px] tracking-[0.2em] border-none shadow-2xl shadow-orange-600/20 flex items-center justify-center gap-3 relative overflow-hidden group disabled:opacity-50 outline-none"
                >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 relative z-10" />}
                    <span className="relative z-10">{item ? 'Update Item' : 'Create Item'}</span>
                </motion.button>
            </div>
        </form>
    )
}


