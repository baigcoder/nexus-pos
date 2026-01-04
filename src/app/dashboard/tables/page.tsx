'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Plus,
    Users,
    MapPin,
    CheckCircle2,
    Grid3X3,
    Edit2,
    Trash2,
    Activity,
    Layers,
    Monitor,
    Zap
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Modal, LoadingSpinner } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import type { Table, TableStatus } from '@/types'

const statusConfig: Record<TableStatus, {
    label: string;
    bg: string;
    text: string;
    dot: string;
    glow: string;
    border: string;
}> = {
    available: {
        label: 'Available',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-500',
        dot: 'bg-emerald-500',
        glow: 'shadow-emerald-500/20',
        border: 'border-emerald-500/20'
    },
    occupied: {
        label: 'Occupied',
        bg: 'bg-orange-600/10',
        text: 'text-orange-600',
        dot: 'bg-orange-600',
        glow: 'shadow-orange-600/20',
        border: 'border-orange-600/20'
    },
    reserved: {
        label: 'Reserved',
        bg: 'bg-blue-500/10',
        text: 'text-blue-500',
        dot: 'bg-blue-500',
        glow: 'shadow-blue-500/20',
        border: 'border-blue-500/20'
    },
    billing: {
        label: 'Billing',
        bg: 'bg-rose-500/10',
        text: 'text-rose-500',
        dot: 'bg-rose-500',
        glow: 'shadow-rose-500/20',
        border: 'border-rose-500/20'
    },
}

export default function TablesPage() {
    const { restaurant } = useAuthStore()
    const { success, error: showError } = useToast()
    const [tables, setTables] = useState<Table[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingTable, setEditingTable] = useState<Table | null>(null)

    useEffect(() => {
        if (restaurant?.id) fetchTables()
    }, [restaurant?.id])

    const fetchTables = async () => {
        if (!restaurant?.id) return
        setIsLoading(true)
        try {
            const supabase = createClient()
            const { data } = await supabase
                .from('tables')
                .select('*')
                .eq('restaurant_id', restaurant.id)
                .order('table_number', { ascending: true })
            setTables(data || [])
        } finally { setIsLoading(false) }
    }

    const handleStatusChange = async (tableId: string, newStatus: TableStatus) => {
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('tables')
                .update({ status: newStatus })
                .eq('id', tableId)

            if (error) throw error

            setTables(tables.map(t => t.id === tableId ? { ...t, status: newStatus } : t))
            success('Status Updated', `Table status synchronized to ${newStatus}.`)
        } catch (err: any) { showError('Update Failed', err.message) }
    }

    const deleteTable = async (id: string) => {
        if (!confirm('Are you sure you want to decommission this table?')) return
        try {
            const supabase = createClient()
            const { error } = await supabase.from('tables').delete().eq('id', id)
            if (error) throw error
            setTables(tables.filter(t => t.id !== id))
            success('Table Removed', 'The table has been removed from operations.')
        } catch (err) { showError('Operation Failed', 'Could not delete the table.') }
    }

    const stats = {
        total: tables.length,
        available: tables.filter(t => t.status === 'available').length,
        occupied: tables.filter(t => t.status === 'occupied').length,
        capacity: tables.reduce((sum, t) => sum + (t.capacity || 0), 0),
    }

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const itemVariant = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
    }

    return (
        <div className="min-h-screen pb-20">
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-12">

                {/* Premium Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <motion.div variants={itemVariant} className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-600/10 border border-orange-600/20 rounded-xl flex items-center justify-center">
                                <Monitor className="w-5 h-5 text-orange-600" />
                            </div>
                            <Badge variant="outline" className="border-orange-600/20 text-orange-600 bg-orange-600/5 px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                                Real-time Floor
                            </Badge>
                        </motion.div>
                        <motion.h1 variants={itemVariant} className="text-4xl lg:text-6xl font-display font-bold text-white tracking-tight uppercase">
                            Table <span className="text-orange-600 text-glow">Layout</span>
                        </motion.h1>
                        <motion.p variants={itemVariant} className="text-neutral-500 text-lg font-medium max-w-xl">
                            Live visualization of your restaurant floor. Manage seating and service states with precision.
                        </motion.p>
                    </div>

                    <motion.div variants={itemVariant}>
                        <Button
                            onClick={() => setShowModal(true)}
                            className="bg-orange-600 hover:bg-orange-500 text-white h-16 px-10 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-2xl shadow-orange-600/20 group transition-all"
                        >
                            <Plus className="w-5 h-5 mr-3 group-hover:rotate-90 transition-transform duration-300" />
                            Add Table
                        </Button>
                    </motion.div>
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Nodes', value: stats.total, icon: Grid3X3, color: 'text-white', glow: 'shadow-white/5' },
                        { label: 'Available', value: stats.available, icon: CheckCircle2, color: 'text-emerald-500', glow: 'shadow-emerald-500/10' },
                        { label: 'Live Traffic', value: stats.occupied, icon: Activity, color: 'text-orange-600', glow: 'shadow-orange-600/10' },
                        { label: 'Max Capacity', value: stats.capacity, icon: MapPin, color: 'text-blue-500', glow: 'shadow-blue-500/10' },
                    ].map((stat, idx) => (
                        <motion.div key={idx} variants={itemVariant}>
                            <Card className={cn(
                                "group p-6 bg-neutral-900/50 backdrop-blur-xl border-neutral-800 hover:border-neutral-700 transition-all duration-500 overflow-hidden relative rounded-3xl",
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
                                    <h3 className="text-3xl font-black text-white tracking-tight">{stat.value}</h3>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Status Legend Bar */}
                <motion.div variants={itemVariant} className="flex flex-wrap items-center justify-center gap-6 p-6 bg-neutral-950/50 backdrop-blur-2xl rounded-[2rem] border border-neutral-900 border-dashed">
                    <div className="flex items-center gap-2 mr-4">
                        <Zap className="w-4 h-4 text-orange-600" />
                        <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em]">Operational Key</span>
                    </div>
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                        <div key={key} className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-black border border-neutral-900 group/key hover:border-neutral-800 transition-all">
                            <div className={cn("w-2 h-2 rounded-full", cfg.dot, cfg.glow)} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 group-hover/key:text-white transition-colors">{cfg.label}</span>
                        </div>
                    ))}
                </motion.div>

                {/* Tactical Table Grid */}
                <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-4">
                            <Layers className="w-6 h-6 text-orange-600" />
                            Floor Topology
                        </h2>
                        <div className="h-[1px] flex-1 bg-neutral-900 mx-8 hidden sm:block" />
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-20"><LoadingSpinner /></div>
                    ) : tables.length === 0 ? (
                        <Card className="p-20 bg-neutral-900/30 border-neutral-800/50 backdrop-blur-sm text-center rounded-[3rem] border-dashed">
                            <Grid3X3 className="w-16 h-16 text-neutral-800 mx-auto mb-6" />
                            <h3 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">Clean Slate</h3>
                            <p className="text-neutral-500 text-lg max-w-sm mx-auto mb-10 leading-relaxed">
                                No tables have been mapped to your floor layout. Start by adding your first tactical node.
                            </p>
                            <Button variant="black" onClick={() => setShowModal(true)} className="h-14 px-10 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase tracking-widest text-xs">
                                Deploy First Table
                            </Button>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                            {tables.map((table) => {
                                const cfg = statusConfig[table.status]
                                return (
                                    <motion.div key={table.id} variants={itemVariant} layout>
                                        <Card className={cn(
                                            "pt-10 pb-8 px-6 bg-neutral-950 border border-neutral-900 hover:border-neutral-800 transition-all duration-500 relative rounded-[2.5rem] group overflow-hidden h-full flex flex-col items-center",
                                            cfg.glow.replace('/20', '/5')
                                        )}>
                                            {/* Action Overlay */}
                                            <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all z-20">
                                                <button
                                                    onClick={() => { setEditingTable(table); setShowModal(true); }}
                                                    className="w-10 h-10 rounded-xl bg-white text-black hover:bg-orange-600 hover:text-white flex items-center justify-center shadow-xl transition-all"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteTable(table.id)}
                                                    className="w-10 h-10 rounded-xl bg-neutral-900 text-neutral-500 hover:bg-rose-600 hover:text-white flex items-center justify-center shadow-xl transition-all border border-neutral-800"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Table Node Visualization */}
                                            <div className="relative mb-8">
                                                {/* Ambient Glow */}
                                                <div className={cn(
                                                    "absolute inset-0 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity",
                                                    cfg.dot
                                                )} />

                                                {/* Status Ring */}
                                                <div className={cn(
                                                    "w-32 h-32 rounded-full border-2 flex items-center justify-center relative bg-black/40 backdrop-blur-sm group-hover:scale-110 transition-transform duration-500 shadow-2xl",
                                                    cfg.border
                                                )}>
                                                    <span className="text-4xl font-black text-white tracking-widest">{table.table_number}</span>

                                                    {/* Pulse Indicator */}
                                                    <div className={cn(
                                                        "absolute -top-1 -right-1 w-5 h-5 rounded-full border-4 border-black z-10",
                                                        cfg.dot,
                                                        table.status === 'occupied' || table.status === 'billing' ? 'animate-pulse' : ''
                                                    )} />
                                                </div>
                                            </div>

                                            <div className="text-center space-y-1 mb-8">
                                                <h3 className="text-lg font-black text-white uppercase tracking-tighter">NODE {table.table_number}</h3>
                                                <div className="flex items-center justify-center gap-2 text-neutral-600">
                                                    <Users className="w-3 h-3" />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">{table.capacity} PAX</span>
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            <div className={cn(
                                                "mt-auto px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] border",
                                                cfg.bg, cfg.text, cfg.border
                                            )}>
                                                {cfg.label}
                                            </div>

                                            {/* Interactive Controls */}
                                            <div className="mt-8 pt-6 border-t border-neutral-900 w-full flex gap-3">
                                                {table.status !== 'available' && (
                                                    <button
                                                        onClick={() => handleStatusChange(table.id, 'available')}
                                                        className="flex-1 h-12 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black font-black text-[9px] uppercase tracking-widest transition-all border border-emerald-500/20"
                                                    >
                                                        RESET
                                                    </button>
                                                )}
                                                {table.status === 'available' && (
                                                    <button
                                                        onClick={() => handleStatusChange(table.id, 'occupied')}
                                                        className="flex-1 h-12 rounded-xl bg-orange-600/10 hover:bg-orange-600 text-orange-600 hover:text-white font-black text-[9px] uppercase tracking-widest transition-all border border-orange-600/20"
                                                    >
                                                        ENGAGE
                                                    </button>
                                                )}
                                                {table.status === 'occupied' && (
                                                    <button
                                                        onClick={() => handleStatusChange(table.id, 'billing')}
                                                        className="flex-1 h-12 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white font-black text-[9px] uppercase tracking-widest transition-all border border-rose-500/20"
                                                    >
                                                        BILL
                                                    </button>
                                                )}
                                            </div>
                                        </Card>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Table Form Modal */}
                <Modal
                    isOpen={showModal}
                    onClose={() => { setShowModal(false); setEditingTable(null); }}
                    title={editingTable ? `RECONFIGURE NODE ${editingTable.table_number}` : 'DEPLOY NEW NODE'}
                    size="md"
                >
                    <div className="p-2">
                        <TableForm
                            table={editingTable}
                            restaurantId={restaurant?.id || ''}
                            onSuccess={() => { fetchTables(); setShowModal(false); setEditingTable(null); }}
                            onCancel={() => { setShowModal(false); setEditingTable(null); }}
                        />
                    </div>
                </Modal>
            </motion.div>
        </div>
    )
}

function TableForm({ table, restaurantId, onSuccess, onCancel }: any) {
    const [isLoading, setIsLoading] = useState(false)
    const [tableNumber, setTableNumber] = useState(table?.table_number || '')
    const [capacity, setCapacity] = useState(table?.capacity || 4)

    const handleSubmit = async (e: any) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const supabase = createClient()
            const payload = {
                restaurant_id: restaurantId,
                table_number: tableNumber,
                capacity,
                status: table?.status || 'available'
            }

            if (table) {
                const { error } = await supabase.from('tables').update(payload).eq('id', table.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('tables').insert(payload)
                if (error) throw error
            }
            onSuccess()
        } catch (err) { console.error(err) } finally { setIsLoading(false) }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6">
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Tactical ID</label>
                    <input
                        type="text"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        placeholder="e.g. 01, Alpha, B1"
                        required
                        className="w-full bg-black border border-neutral-800 rounded-2xl h-16 px-6 text-sm text-white font-bold focus:outline-none focus:border-orange-600/50 transition-all placeholder:text-neutral-800"
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Seating Payload (PAX)</label>
                    <div className="grid grid-cols-4 gap-3">
                        {[2, 4, 6, 8].map((cap) => (
                            <button
                                key={cap}
                                type="button"
                                onClick={() => setCapacity(cap)}
                                className={cn(
                                    "h-14 rounded-2xl font-black text-xs transition-all border flex items-center justify-center",
                                    capacity === cap
                                        ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-600/20'
                                        : 'bg-black/40 border-neutral-800 text-neutral-600 hover:border-neutral-700'
                                )}
                            >
                                {cap}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Custom Capacity</label>
                    <input
                        type="number"
                        value={capacity}
                        onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                        placeholder="Custom value"
                        className="w-full bg-black border border-neutral-800 rounded-2xl h-14 px-6 text-sm text-white font-bold focus:outline-none focus:border-orange-600/50 transition-all"
                    />
                </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-neutral-900">
                <Button
                    variant="outline"
                    className="flex-1 h-16 rounded-2xl border-neutral-800 text-neutral-500 font-black uppercase tracking-widest text-[10px] hover:text-white"
                    onClick={onCancel}
                    type="button"
                >
                    ABORT
                </Button>
                <Button
                    className="flex-1 h-16 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-orange-600/20 border-none"
                    isLoading={isLoading}
                    type="submit"
                >
                    {table ? 'SAVE CONFIG' : 'DEPLOY NODE'}
                </Button>
            </div>
        </form>
    )
}
