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
    Image as ImageIcon
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Input, Modal, LoadingSpinner } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import type { Category, MenuItem } from '@/types'

// Map category names to icons for a more visual experience
const getCategoryIcon = (name: string) => {
    const n = name.toLowerCase()
    if (n.includes('drink') || n.includes('beverage')) return Wine
    if (n.includes('burger') || n.includes('main')) return Beef
    if (n.includes('pizza')) return Pizza
    if (n.includes('dessert') || n.includes('sweet')) return IceCream
    if (n.includes('coffee') || n.includes('cafe')) return Coffee
    if (n.includes('starter') || n.includes('appetizer')) return Utensils
    return Tag
}

export default function MenuPage() {
    const { restaurant } = useAuthStore()
    const { success, error: toastError } = useToast()
    const [categories, setCategories] = useState<Category[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showCategoryModal, setShowCategoryModal] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

    useEffect(() => {
        if (restaurant?.id) {
            fetchCategories()
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
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-12 pb-32"
        >
            {/* Ultra Premium Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-1.5 rounded-full bg-orange-600/10 border border-orange-600/20">
                            <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em]">Menu Engine v2.0</span>
                        </div>
                        <div className="h-px w-12 bg-neutral-800" />
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Architect your catalog</span>
                    </div>

                    <h1 className="text-5xl lg:text-7xl font-black tracking-tighter text-white uppercase leading-[0.9]">
                        Culinary <br />
                        <span className="text-orange-600">Inventory</span>
                    </h1>

                    <p className="text-neutral-400 max-w-lg text-lg font-medium leading-relaxed">
                        Precision management for your menu ecosystem. Control <span className="text-white font-bold">{categories.length} segments</span> with high-fidelity tools.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <Button
                        variant="white"
                        size="lg"
                        onClick={() => setShowCategoryModal(true)}
                        icon={Plus}
                        className="h-20 px-10 rounded-[2rem] font-black uppercase tracking-[0.1em] text-sm shadow-2xl shadow-white/5 active:scale-95 transition-all"
                    >
                        New Category
                    </Button>
                </div>
            </div>

            {/* Main Orchestration Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                {/* Visual Category Navigation */}
                <motion.div variants={itemFade} className="lg:col-span-3 space-y-8">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-orange-600/5 blur-2xl rounded-3xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                        <div className="relative">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-orange-600 transition-colors" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Locate Category..."
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-[2rem] pl-16 pr-6 h-16 text-xs font-bold uppercase tracking-widest outline-none focus:border-orange-600/50 focus:bg-black transition-all text-white placeholder:text-neutral-700 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-4">
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
                                                'group flex items-center gap-5 p-5 rounded-[2rem] transition-all relative overflow-hidden text-left border-2',
                                                isActive
                                                    ? 'bg-white border-white text-black shadow-2xl shadow-white/5'
                                                    : 'bg-neutral-950 border-neutral-900 text-neutral-500 hover:border-orange-600/30 hover:bg-neutral-900/50'
                                            )}
                                        >
                                            <div className={cn(
                                                'w-12 h-12 rounded-2xl flex items-center justify-center transition-all',
                                                isActive
                                                    ? 'bg-orange-600 text-white'
                                                    : 'bg-neutral-900 text-neutral-600 group-hover:text-orange-600'
                                            )}>
                                                <Icon className="w-6 h-6" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <span className="block font-black uppercase tracking-tight text-sm truncate">{category.name}</span>
                                                <span className={cn(
                                                    "text-[10px] font-bold uppercase tracking-widest",
                                                    isActive ? "text-neutral-400" : "text-neutral-700"
                                                )}>
                                                    View Collection
                                                </span>
                                            </div>

                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingCategory(category); setShowCategoryModal(true); }}
                                                className={cn(
                                                    "p-2 rounded-xl border transition-all",
                                                    isActive
                                                        ? "border-neutral-200 text-neutral-400 hover:bg-black hover:text-white"
                                                        : "border-neutral-800 text-neutral-700 hover:text-orange-600 hover:border-orange-600/30"
                                                )}
                                            >
                                                <Settings2 className="w-4 h-4" />
                                            </button>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Dynamic Content Plane */}
                <motion.div variants={itemFade} className="lg:col-span-9">
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
                                />
                            </motion.div>
                        ) : (
                            <Card className="h-[70vh] flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 bg-neutral-950/50 backdrop-blur-3xl rounded-[3rem]">
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-orange-600/20 blur-[100px] rounded-full" />
                                    <FolderOpen className="w-24 h-24 text-neutral-800 relative" />
                                </div>
                                <h2 className="text-3xl font-black text-white uppercase tracking-tight">Select Context</h2>
                                <p className="mt-4 text-neutral-500 font-bold uppercase tracking-[0.2em] text-xs">Awaiting category selection to drive the display</p>
                            </Card>
                        )}
                    </AnimatePresence>
                </motion.div>
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
        </motion.div>
    )
}

function CategoryForm({ category, restaurantId, onSuccess, onCancel }: any) {
    const [isLoading, setIsLoading] = useState(false)
    const [name, setName] = useState(category?.name || '')
    const [description, setDescription] = useState(category?.description || '')

    const handleSubmit = async (e: any) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const supabase = createClient()
            const payload = {
                restaurant_id: restaurantId,
                name,
                description: description || null,
                display_order: category?.display_order || 0
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
        <form onSubmit={handleSubmit} className="space-y-8 p-4">
            <div className="space-y-6">
                <Input
                    label="Label"
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    placeholder="e.g. CORE BURGERS"
                    required
                    className="h-16 bg-neutral-900 border-neutral-800 text-white font-black uppercase tracking-widest text-xs focus:border-orange-600/50"
                />
                <Input
                    label="Descriptor"
                    value={description}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                    placeholder="Brief architectural overview..."
                    className="h-16 bg-neutral-900 border-neutral-800 text-white font-black uppercase tracking-widest text-xs focus:border-orange-600/50"
                />
            </div>

            <div className="flex gap-4 pt-8 border-t border-neutral-800">
                <Button variant="outline" className="flex-1 h-16 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] border-neutral-800 text-neutral-500" onClick={onCancel} type="button">Discard</Button>
                <Button variant="primary" className="flex-1 h-16 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[10px] tracking-[0.2em] border-none shadow-xl shadow-orange-600/10" isLoading={isLoading} type="submit">
                    {category ? 'Sync Changes' : 'Initialize'}
                </Button>
            </div>
        </form>
    )
}

function MenuItemsPanel({ categoryId, restaurantId, category, onDeleteCategory }: any) {
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
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-neutral-900">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-orange-600 flex items-center justify-center text-white shadow-2xl shadow-orange-600/20">
                            {React.createElement(getCategoryIcon(category?.name || ''), { className: "w-8 h-8" })}
                        </div>
                        <div>
                            <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">{category?.name}</h2>
                            <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em] mt-2">Inventory Segment // {items.length} Units</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDeleteCategory}
                        className="h-14 px-6 rounded-2xl text-rose-500 hover:bg-rose-500/10 font-bold uppercase text-[10px] tracking-widest"
                    >
                        Purge Segment
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        onClick={() => setShowItemModal(true)}
                        icon={Plus}
                        className="h-16 px-8 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white shadow-2xl shadow-orange-600/20 font-black uppercase text-[10px] tracking-[0.2em] border-none transition-all"
                    >
                        Engineer Item
                    </Button>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center text-center bg-neutral-900/20 rounded-[3rem] border border-neutral-900 border-dashed">
                    <Tag className="w-20 h-20 mb-6 text-neutral-800" />
                    <h3 className="text-2xl font-black text-neutral-700 uppercase tracking-tight">Void Segment</h3>
                    <p className="text-[10px] text-neutral-500 font-bold mt-3 uppercase tracking-[0.2em]">No menu items have been architected here</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {items.map((item, idx) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.04 }}
                            className={cn(
                                'group relative p-8 rounded-[2.5rem] border-2 transition-all duration-500',
                                item.is_available
                                    ? 'bg-neutral-900/50 border-neutral-800 hover:border-orange-600/50 hover:bg-black'
                                    : 'bg-neutral-950 border-neutral-900 opacity-40 grayscale pointer-events-none'
                            )}
                        >
                            {!item.is_available && (
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <div className="px-6 py-2 rounded-full bg-black/80 border border-neutral-800 text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Unavailable</div>
                                </div>
                            )}

                            <div className="flex gap-8 relative z-0">
                                <div className="relative shrink-0">
                                    <div className="w-32 h-32 rounded-3xl overflow-hidden bg-black border-2 border-neutral-800 flex items-center justify-center group-hover:border-orange-600/30 transition-all duration-500">
                                        {item.image_url ? (
                                            <img src={item.image_url} className="w-full h-full object-cover scale-105 group-hover:scale-125 transition-transform duration-700" />
                                        ) : (
                                            <ImageIcon className="w-10 h-10 text-neutral-800 group-hover:text-orange-600/20 transition-colors" />
                                        )}
                                    </div>
                                    {item.is_special && (
                                        <div className="absolute -top-3 -right-3 w-10 h-10 bg-orange-600 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-600/50 scale-110">
                                            <Star className="w-5 h-5 fill-white" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between gap-4">
                                            <h3 className="font-black text-white truncate uppercase tracking-tight text-xl leading-none">{item.name}</h3>
                                            <div className="px-3 py-1 rounded-xl bg-orange-600/10 border border-orange-600/20">
                                                <span className="font-black text-orange-600 text-sm tracking-tight text-right">Rs. {item.price}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-neutral-500 font-bold line-clamp-2 uppercase tracking-tight leading-relaxed">{item.description || "No specification provided for this architectural unit."}</p>
                                    </div>

                                    <div className="flex items-center justify-between mt-auto">
                                        <div className="flex gap-2">
                                            {item.dietary_tags?.slice(0, 2).map((tag: string) => (
                                                <div key={tag} className="px-3 py-1 bg-neutral-800 rounded-lg text-[8px] font-black text-neutral-400 uppercase tracking-widest border border-neutral-700">
                                                    {tag}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex gap-3 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 pointer-events-auto">
                                            <button
                                                onClick={() => handleToggleStock(item)}
                                                className={cn(
                                                    'h-12 w-12 rounded-2xl flex items-center justify-center transition-all bg-neutral-800 border-2 border-neutral-700 hover:scale-110 active:scale-90',
                                                    item.is_available ? 'text-emerald-500 hover:border-emerald-500/50' : 'text-rose-500 hover:border-rose-500/50'
                                                )}
                                            >
                                                {item.is_available ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                                            </button>
                                            <button
                                                onClick={() => { setEditingItem(item); setShowItemModal(true); }}
                                                className="h-12 w-12 rounded-2xl bg-white text-black hover:bg-orange-600 hover:text-white transition-all flex items-center justify-center shadow-2xl shadow-white/5 hover:scale-110 active:scale-90 border-none"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
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
                        title={editingItem ? 'Edit Component' : 'New Component Architecture'}
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
        price: item?.price || '',
        dietary_tags: item?.dietary_tags || [],
        is_available: item?.is_available ?? true,
        is_special: item?.is_special ?? false,
    })

    const dietaryOptions = [
        { value: 'vegan', label: 'Vegan', icon: '🌱' },
        { value: 'vegetarian', label: 'Vegetarian', icon: '🥬' },
        { value: 'spicy', label: 'Spicy', icon: '🌶️' },
        { value: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
    ]

    const handleSubmit = async (e: any) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const supabase = createClient()
            const payload = {
                ...formData,
                price: parseFloat(formData.price),
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
        <form onSubmit={handleSubmit} className="space-y-8 p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <Input
                        label="Label"
                        value={formData.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. ULTRA BURGER"
                        required
                        className="h-16 bg-neutral-900 border-neutral-800 text-white font-black uppercase tracking-widest text-xs focus:border-orange-600/50"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Price Value"
                            type="number"
                            value={formData.price}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, price: e.target.value })}
                            placeholder="0.00"
                            required
                            className="h-16 bg-neutral-900 border-neutral-800 text-white font-black uppercase tracking-widest text-xs focus:border-orange-600/50"
                        />
                        <div className="flex items-end pb-3">
                            <label className="flex items-center gap-4 cursor-pointer group bg-neutral-900 h-16 w-full border border-neutral-800 rounded-xl px-4 hover:border-orange-600/30 transition-all">
                                <div className={cn(
                                    "w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all",
                                    formData.is_special ? "bg-orange-600 border-orange-600" : "bg-black border-neutral-800"
                                )}>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={formData.is_special}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, is_special: e.target.checked })}
                                    />
                                    {formData.is_special && <Check className="w-5 h-5 text-white" />}
                                </div>
                                <span className="text-[10px] font-black text-neutral-500 group-hover:text-white uppercase tracking-[0.2em]">Special</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-3 block">Specification</label>
                        <textarea
                            value={formData.description}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Detailed unit specifications..."
                            rows={5}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-white font-bold text-xs uppercase tracking-widest outline-none focus:border-orange-600/50 transition-all resize-none shadow-inner"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em]">Dietary Classifications</label>
                <div className="flex flex-wrap gap-3">
                    {dietaryOptions.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                const tags = formData.dietary_tags.includes(opt.value)
                                    ? formData.dietary_tags.filter((t: string) => t !== opt.value)
                                    : [...formData.dietary_tags, opt.value]
                                setFormData({ ...formData, dietary_tags: tags })
                            }}
                            className={cn(
                                'px-6 py-3 rounded-2xl text-[10px] font-black transition-all flex items-center gap-3 border-2',
                                formData.dietary_tags.includes(opt.value)
                                    ? 'bg-white text-black border-white shadow-xl shadow-white/5'
                                    : 'bg-neutral-900 text-neutral-600 border-neutral-800 hover:border-orange-600/30 hover:text-orange-600'
                            )}
                        >
                            <span className="text-sm scale-125">{opt.icon}</span>
                            <span className="uppercase tracking-widest">{opt.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex gap-4 pt-10 border-t border-neutral-800">
                <Button variant="outline" className="flex-1 h-20 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] border-neutral-800 text-neutral-500" onClick={onCancel} type="button">Decline</Button>
                <Button variant="primary" className="flex-1 h-20 rounded-[2rem] bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[10px] tracking-[0.2em] border-none shadow-2xl shadow-orange-600/20" isLoading={isLoading} type="submit">
                    {item ? 'Commit Segment' : 'Initialize Unit'}
                </Button>
            </div>
        </form>
    )
}

function Star({ className, ...props }: any) {
    return (
        <svg
            {...props}
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    )
}
