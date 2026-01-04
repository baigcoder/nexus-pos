'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sparkles,
    Star,
    Clock,
    Tag,
    Plus,
    Trash2,
    Calendar,
    ArrowRight,
    Search,
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    UtensilsCrossed,
    Flame
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Modal, Input } from '@/components/ui/common'
import { cn } from '@/lib/utils'

// Types
interface SimpleMenuItem {
    id: string
    name: string
    price: number
    description?: string
    image_url?: string
}

interface DailySpecial {
    id: string
    menu_item_id: string
    menu_item?: SimpleMenuItem
    discount_percent: number
    valid_date: string
    is_active: boolean
}

export default function DailySpecialsPage() {
    const { restaurant } = useAuthStore()
    const { success, error: showError } = useToast()
    const [specials, setSpecials] = useState<DailySpecial[]>([])
    const [menuItems, setMenuItems] = useState<SimpleMenuItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    const today = new Date().toISOString().split('T')[0]

    useEffect(() => {
        async function loadData() {
            if (!restaurant?.id) return
            setIsLoading(true)
            try {
                const supabase = createClient()

                // Fetch active menu items
                const { data: menuData, error: menuError } = await supabase
                    .from('menu_items')
                    .select('id, name, price, description, image_url')
                    .eq('restaurant_id', restaurant.id)
                    .eq('is_available', true)

                if (menuError) throw menuError
                setMenuItems(menuData || [])

                // Fetch daily specials
                const { data: specialsData, error: specialsError } = await supabase
                    .from('daily_specials')
                    .select('*, menu_item:menu_item_id(id, name, price, description, image_url)')
                    .eq('restaurant_id', restaurant.id)
                    .eq('is_active', true)

                if (specialsError) throw specialsError
                setSpecials((specialsData || []).map((s: any) => ({
                    ...s,
                    menu_item: s.menu_item || undefined
                })))
            } catch (err) {
                showError('Error', 'Failed to load specials')
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [restaurant?.id])

    const todaySpecials = specials.filter(s => s.valid_date === today)
    const avgDiscount = todaySpecials.length > 0
        ? Math.round(todaySpecials.reduce((s, sp) => s + sp.discount_percent, 0) / todaySpecials.length)
        : 0

    const handleRemoveSpecial = async (id: string) => {
        try {
            const supabase = createClient()
            const { error } = await supabase.from('daily_specials').delete().eq('id', id)
            if (error) throw error
            setSpecials(specials.filter(s => s.id !== id))
            success('Success', 'Special removed successfully')
        } catch (err) {
            showError('Error', 'Failed to remove special')
        }
    }

    const handleAddSpecial = async (itemId: string, discount: number) => {
        if (!restaurant) return

        try {
            const supabase = createClient()
            const item = menuItems.find(m => m.id === itemId)
            if (!item) return

            const { data, error } = await supabase
                .from('daily_specials')
                .insert({
                    restaurant_id: restaurant.id,
                    menu_item_id: itemId,
                    discount_percent: discount,
                    valid_date: today,
                    is_active: true
                })
                .select('*, menu_item:menu_item_id(id, name, price, description, image_url)')
                .single()

            if (error) throw error

            setSpecials([...specials, data])
            setShowModal(false)
            success('Success', `${item.name} is now a daily special!`)
        } catch (err) {
            showError('Error', 'Failed to add special')
        }
    }

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    }

    const itemVariant = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
    }

    return (
        <div className="min-h-screen pb-20">
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-12">

                {/* Header Section */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <motion.div variants={itemVariant} className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-600/10 border border-orange-600/20 rounded-xl flex items-center justify-center">
                                <Flame className="w-5 h-5 text-orange-600 animate-pulse" />
                            </div>
                            <Badge variant="outline" className="border-orange-600/20 text-orange-600 bg-orange-600/5 px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                                Daily Live
                            </Badge>
                        </motion.div>
                        <motion.h1 variants={itemVariant} className="text-4xl lg:text-6xl font-display font-bold text-white tracking-tight uppercase">
                            Premium <span className="text-orange-600">Specials</span>
                        </motion.h1>
                        <motion.p variants={itemVariant} className="text-neutral-500 text-lg font-medium max-w-xl">
                            Curate today's high-demand items with exclusive discounts. Boost your sales with dynamic pricing.
                        </motion.p>
                    </div>

                    <motion.div variants={itemVariant}>
                        <Button
                            onClick={() => setShowModal(true)}
                            className="bg-orange-600 hover:bg-orange-500 text-white h-16 px-10 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-2xl shadow-orange-600/20 group transition-all"
                        >
                            <Plus className="w-5 h-5 mr-3 group-hover:rotate-90 transition-transform duration-300" />
                            Featured Special
                        </Button>
                    </motion.div>
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: "Today's Volume", value: todaySpecials.length, icon: Sparkles, color: 'text-orange-500', glow: 'shadow-orange-500/10' },
                        { label: 'Avg Markdown', value: `${avgDiscount}%`, icon: Tag, color: 'text-emerald-500', glow: 'shadow-emerald-500/10' },
                        { label: 'Expires In', value: 'Midnight', icon: Clock, color: 'text-blue-500', glow: 'shadow-blue-500/10' },
                        { label: 'Global Date', value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), icon: Calendar, color: 'text-purple-500', glow: 'shadow-purple-500/10' },
                    ].map((stat, idx) => (
                        <motion.div key={idx} variants={itemVariant}>
                            <Card className={cn(
                                "group p-6 bg-neutral-900/50 backdrop-blur-xl border-neutral-800 hover:border-neutral-700 transition-all duration-500 overflow-hidden relative",
                                stat.glow
                            )}>
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-black/40 border border-neutral-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <stat.icon className={cn("w-5 h-5", stat.color)} />
                                        </div>
                                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{stat.label}</p>
                                    </div>
                                    <h3 className="text-3xl font-bold text-white tracking-tight">{stat.value}</h3>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Content Grid */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest">Active Boards</h2>
                        <div className="h-[1px] flex-1 bg-neutral-900 mx-8" />
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-64 bg-neutral-900/50 animate-pulse rounded-3xl border border-neutral-800" />
                            ))}
                        </div>
                    ) : todaySpecials.length === 0 ? (
                        <Card className="p-20 bg-neutral-900/30 border-neutral-800/50 backdrop-blur-sm text-center rounded-[2.5rem] border-dashed">
                            <div className="w-24 h-24 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto mb-8">
                                <Sparkles className="w-10 h-10 text-neutral-700" />
                            </div>
                            <h3 className="text-2xl font-bold text-white uppercase tracking-widest mb-3">The Stage is Empty</h3>
                            <p className="text-neutral-500 text-lg max-w-sm mx-auto mb-10">
                                No active specials for today. Start featuring your top items to drive more traffic.
                            </p>
                            <Button variant="outline" onClick={() => setShowModal(true)} className="border-neutral-800 text-neutral-400 hover:text-white h-14 px-8">
                                Add First Special
                            </Button>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <AnimatePresence mode="popLayout">
                                {todaySpecials.map((special) => (
                                    <motion.div
                                        key={special.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                        className="group relative"
                                    >
                                        <Card className="p-0 bg-neutral-950 border-neutral-800 hover:border-orange-600/30 transition-all duration-500 overflow-hidden shadow-2xl group-hover:shadow-orange-600/5 rounded-3xl h-full flex flex-col">
                                            {/* Special Header with Image/Icon */}
                                            <div className="relative h-48 bg-neutral-900 overflow-hidden">
                                                {special.menu_item?.image_url ? (
                                                    <img
                                                        src={special.menu_item.image_url}
                                                        alt={special.menu_item.name}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-60"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-black">
                                                        <UtensilsCrossed className="w-16 h-16 text-neutral-800 opacity-50" />
                                                    </div>
                                                )}

                                                {/* Overlay Badges */}
                                                <div className="absolute top-5 left-5 right-5 flex justify-between items-center z-10">
                                                    <div className="bg-orange-600 text-white font-black text-sm px-4 py-1.5 rounded-xl shadow-xl flex items-center gap-2">
                                                        <Tag className="w-4 h-4" />
                                                        {special.discount_percent}% OFF
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleRemoveSpecial(special.id)
                                                        }}
                                                        className="w-10 h-10 rounded-xl bg-black/60 backdrop-blur-md border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-rose-500 hover:border-rose-500 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />
                                            </div>

                                            {/* Content */}
                                            <div className="p-8 flex-1 flex flex-col">
                                                <h3 className="text-2xl font-bold text-white mb-2 line-clamp-1">{special.menu_item?.name}</h3>
                                                <p className="text-neutral-500 text-sm mb-8 line-clamp-2 leading-relaxed">
                                                    {special.menu_item?.description || "A premium delicacy prepared with care."}
                                                </p>

                                                <div className="mt-auto pt-6 border-t border-neutral-900 flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-[0.2em] mb-1">Price Point</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-neutral-600 line-through text-xs font-medium">Rs.{special.menu_item?.price}</span>
                                                            <span className="text-2xl font-bold text-orange-500">
                                                                Rs.{Math.round((special.menu_item?.price || 0) * (1 - special.discount_percent / 100))}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="w-12 h-12 rounded-2xl bg-orange-600/10 border border-orange-600/20 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-all duration-500">
                                                        <ArrowRight className="w-6 h-6 rotate-[-45deg] group-hover:rotate-0 transition-transform duration-500" />
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {/* Add Special Modal */}
                <Modal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    title="Feature New Special"
                    size="lg"
                >
                    <div className="p-2">
                        <AddSpecialForm
                            menuItems={menuItems.filter(m => !specials.some(s => s.menu_item_id === m.id))}
                            onAdd={handleAddSpecial}
                            onCancel={() => setShowModal(false)}
                        />
                    </div>
                </Modal>
            </motion.div>
        </div>
    )
}

function AddSpecialForm({ menuItems, onAdd, onCancel }: {
    menuItems: SimpleMenuItem[]
    onAdd: (itemId: string, discount: number) => void
    onCancel: () => void
}) {
    const [selectedItem, setSelectedItem] = useState('')
    const [discount, setDiscount] = useState(25)
    const [searchTerm, setSearchTerm] = useState('')

    const filteredItems = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const selectedItemData = menuItems.find(m => m.id === selectedItem)

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.2em]">Select Target Item</p>
                    <span className="text-[11px] font-medium text-neutral-600">{filteredItems.length} available</span>
                </div>

                {/* Search Bar */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-orange-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search menu inventory..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black/40 border border-neutral-800 rounded-2xl h-14 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-orange-600/50 transition-all"
                    />
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                    {filteredItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setSelectedItem(item.id)}
                            className={cn(
                                "group relative w-full p-4 rounded-2xl text-left transition-all duration-300 border",
                                selectedItem === item.id
                                    ? 'bg-orange-600/10 border-orange-600/50 ring-1 ring-orange-600/20'
                                    : 'bg-black/20 border-neutral-900 hover:border-neutral-800 hover:bg-neutral-900/40'
                            )}
                        >
                            <div className="flex justify-between items-center relative z-10">
                                <div className="space-y-1">
                                    <span className={cn(
                                        "font-bold transition-colors",
                                        selectedItem === item.id ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200'
                                    )}>{item.name}</span>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[9px] uppercase tracking-tighter border-neutral-800">Available</Badge>
                                        <span className="text-xs text-neutral-500">Regular Rs.{item.price}</span>
                                    </div>
                                </div>
                                <div className={cn(
                                    "w-6 h-6 rounded-full border flex items-center justify-center transition-all",
                                    selectedItem === item.id
                                        ? 'bg-orange-600 border-orange-600 text-white'
                                        : 'border-neutral-800 text-transparent'
                                )}>
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                            </div>
                        </button>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="p-12 text-center bg-neutral-950/40 rounded-3xl border border-neutral-900 border-dashed">
                            <AlertCircle className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                            <p className="text-neutral-500 text-sm">No matching items found</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.2em] px-1">Configure Markdown</p>
                <div className="grid grid-cols-4 gap-3">
                    {[15, 25, 40, 50].map((d) => (
                        <button
                            key={d}
                            onClick={() => setDiscount(d)}
                            className={cn(
                                "h-14 rounded-2xl font-bold transition-all border flex items-center justify-center gap-2",
                                discount === d
                                    ? 'bg-orange-600 border-orange-600 text-white'
                                    : 'bg-black/40 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                            )}
                        >
                            {d}%
                        </button>
                    ))}
                </div>
            </div>

            {selectedItemData && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-orange-600/5 border border-orange-600/20 rounded-3xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-orange-600 uppercase tracking-[0.25em]">Live Preview</span>
                        <div className="flex items-center gap-2 text-orange-600">
                            <Star className="w-3 h-3 fill-orange-600" />
                            <span className="text-[10px] font-black uppercase">Daily Special</span>
                        </div>
                    </div>
                    <div className="flex items-end justify-between">
                        <div>
                            <h4 className="text-lg font-bold text-white mb-1">{selectedItemData.name}</h4>
                            <p className="text-xs text-neutral-500">Expires in 21 hours</p>
                        </div>
                        <div className="text-right">
                            <span className="block text-xs text-neutral-600 line-through mb-1">Rs.{selectedItemData.price}</span>
                            <span className="text-2xl font-black text-white">
                                Rs.{Math.round(selectedItemData.price * (1 - discount / 100))}
                            </span>
                        </div>
                    </div>
                </motion.div>
            )}

            <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={onCancel} className="flex-1 h-16 rounded-2xl border-neutral-800 text-neutral-500 hover:text-white font-bold uppercase tracking-widest text-xs">
                    Dismiss
                </Button>
                <Button
                    onClick={() => onAdd(selectedItem, discount)}
                    disabled={!selectedItem}
                    className="flex-1 h-16 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase tracking-widest text-xs shadow-xl shadow-orange-600/10"
                >
                    Deploy Special
                </Button>
            </div>
        </div>
    )
}
