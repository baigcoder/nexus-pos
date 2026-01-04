'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Package,
    Plus,
    Search,
    AlertTriangle,
    TrendingDown,
    RotateCcw,
    Edit2,
    Trash2,
    Truck
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Modal, Input } from '@/components/ui/common'
import { cn } from '@/lib/utils'

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

    // Fetch from Supabase
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

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
    const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } } }

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-10 pb-24">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-orange-600/10 text-orange-600 border-orange-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            ● Stock Management
                        </Badge>
                        {lowStockItems.length > 0 && (
                            <Badge className="bg-rose-500/10 text-rose-500 border-none font-bold text-[10px]">
                                <AlertTriangle className="w-3 h-3 mr-1" /> {lowStockItems.length} Low Stock
                            </Badge>
                        )}
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white uppercase">
                        Inventory <span className="text-orange-600">Management</span>
                    </h1>
                    <p className="text-neutral-400 text-lg font-medium">
                        Tracking <span className="text-white font-bold">{items.length} items</span> worth Rs.{(totalValue / 1000).toFixed(1)}K
                    </p>
                </div>
                <Button onClick={() => setShowModal(true)} icon={Plus} className="h-14 px-10 bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase tracking-widest text-xs">
                    Add Item
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Items', value: items.length, icon: Package, color: 'text-blue-500' },
                    { label: 'Low Stock', value: lowStockItems.length, icon: TrendingDown, color: 'text-rose-500' },
                    { label: 'Total Value', value: `Rs.${(totalValue / 1000).toFixed(0)}K`, icon: Truck, color: 'text-emerald-500' },
                    { label: 'Categories', value: '6', icon: Package, color: 'text-purple-500' },
                ].map((stat, idx) => (
                    <motion.div key={idx} variants={item}>
                        <Card className="p-5 bg-neutral-900 border-neutral-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">{stat.label}</p>
                                    <h3 className={cn("text-2xl font-bold", stat.color)}>{stat.value}</h3>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-neutral-600">
                                    <stat.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search items..."
                        className="w-full h-12 bg-black border border-neutral-800 rounded-xl pl-12 pr-4 text-sm text-white placeholder:text-neutral-700 focus:border-orange-600 outline-none"
                    />
                </div>
                <div className="flex gap-2">
                    {(['all', 'low'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                'h-12 px-6 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all',
                                filter === f ? 'bg-orange-600 text-white border-orange-600' : 'bg-black text-neutral-500 border-neutral-800 hover:border-neutral-700'
                            )}
                        >
                            {f === 'all' ? 'All Items' : 'Low Stock'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Inventory Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map((inv) => (
                    <motion.div key={inv.id} variants={item}>
                        <Card className={cn(
                            "p-6 bg-neutral-900 border-neutral-800 hover:border-orange-600/50 transition-all",
                            inv.current_stock <= inv.min_stock && 'border-rose-500/30 bg-rose-500/5'
                        )}>
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center",
                                        inv.current_stock <= inv.min_stock ? 'bg-rose-500/20 text-rose-500' : 'bg-orange-600/20 text-orange-500'
                                    )}>
                                        <Package className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">{inv.name}</h3>
                                        <p className="text-[10px] text-neutral-600 font-bold uppercase">{inv.unit}</p>
                                    </div>
                                </div>
                                {inv.current_stock <= inv.min_stock && (
                                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="p-3 bg-black border border-neutral-800 rounded-xl text-center">
                                    <span className={cn("text-xl font-bold", inv.current_stock <= inv.min_stock ? 'text-rose-500' : 'text-white')}>
                                        {inv.current_stock}
                                    </span>
                                    <p className="text-[9px] font-bold text-neutral-600 uppercase">In Stock</p>
                                </div>
                                <div className="p-3 bg-black border border-neutral-800 rounded-xl text-center">
                                    <span className="text-xl font-bold text-neutral-500">{inv.min_stock}</span>
                                    <p className="text-[9px] font-bold text-neutral-600 uppercase">Min Level</p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleRestock(inv.id)}
                                    className="flex-1 h-10 bg-black border border-neutral-800 rounded-xl text-[10px] font-bold text-neutral-400 uppercase tracking-widest hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <RotateCcw className="w-3 h-3" /> Restock
                                </button>
                                <button className="w-10 h-10 bg-black border border-neutral-800 rounded-xl flex items-center justify-center text-neutral-600 hover:text-orange-600 hover:border-orange-600 transition-all">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    )
}
