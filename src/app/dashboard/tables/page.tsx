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
        label: 'Ready',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-500',
        dot: 'bg-emerald-500',
        glow: 'shadow-[0_0_30px_rgba(16,185,129,0.15)]',
        border: 'border-emerald-500/20'
    },
    occupied: {
        label: 'In Service',
        bg: 'bg-orange-600/10',
        text: 'text-orange-600',
        dot: 'bg-orange-600',
        glow: 'shadow-[0_0_30px_rgba(234,88,12,0.15)]',
        border: 'border-orange-600/20'
    },
    reserved: {
        label: 'Reserved',
        bg: 'bg-blue-500/10',
        text: 'text-blue-500',
        dot: 'bg-blue-500',
        glow: 'shadow-[0_0_30px_rgba(59,130,246,0.15)]',
        border: 'border-blue-500/20'
    },
    billing: {
        label: 'Clearing',
        bg: 'bg-rose-500/10',
        text: 'text-rose-500',
        dot: 'bg-rose-500',
        glow: 'shadow-[0_0_30px_rgba(244,63,94,0.15)]',
        border: 'border-rose-500/20'
    }
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
        <div className="min-h-screen relative overflow-hidden pb-20">
            {/* Mesh Gradient Background Orbs */}
            <div className="fixed inset-0 pointer-events-none -z-10 bg-black">
                <motion.div
                    animate={{
                        x: [0, 100, 0],
                        y: [0, -50, 0],
                        scale: [1, 1.2, 1]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-orange-600/10 blur-[120px] rounded-full"
                />
                <motion.div
                    animate={{
                        x: [0, -80, 0],
                        y: [0, 100, 0],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[20%] -right-[5%] w-[40%] h-[40%] bg-blue-600/5 blur-[100px] rounded-full"
                />
            </div>

            <motion.div variants={container} initial="hidden" animate="show" className="px-2 lg:px-4 space-y-10 relative z-10">

                {/* Premium Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pt-4">
                    <div className="space-y-6">
                        <motion.div variants={itemVariant} className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-orange-600/10 border border-orange-600/20 rounded-2xl flex items-center justify-center">
                                <Monitor className="w-6 h-6 text-orange-600" />
                            </div>
                            <div className="px-4 py-1.5 rounded-full bg-orange-600/10 border border-orange-600/20 text-[10px] font-black text-orange-600 uppercase tracking-[0.2em]">
                                Live Management
                            </div>
                        </motion.div>

                        <div className="space-y-1">
                            <motion.h1
                                variants={itemVariant}
                                className="text-5xl lg:text-7xl font-black text-white tracking-tight leading-[0.9] uppercase"
                            >
                                Table <br />
                                <span className="bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 bg-clip-text text-transparent">
                                    Layout
                                </span>
                            </motion.h1>
                            <motion.p variants={itemVariant} className="text-lg text-neutral-500 font-medium max-w-xl mt-4">
                                Interactive visualization of your restaurant floor. Monitor seating capacity and service states in real-time.
                            </motion.p>
                        </div>
                    </div>

                    <motion.div variants={itemVariant}>
                        <motion.button
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowModal(true)}
                            className="group relative h-14 px-10 bg-orange-600 rounded-2xl flex items-center gap-3 overflow-hidden shadow-2xl shadow-orange-600/20 transition-all font-black uppercase tracking-widest text-sm text-white border-none"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                            Add Table
                        </motion.button>
                    </motion.div>
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Tables', value: stats.total, icon: Grid3X3, color: 'text-white', glow: 'from-white/10' },
                        { label: 'Available', value: stats.available, icon: CheckCircle2, color: 'text-emerald-500', glow: 'from-emerald-500/10' },
                        { label: 'In Use', value: stats.occupied, icon: Activity, color: 'text-orange-600', glow: 'from-orange-600/10' },
                        { label: 'Total Seats', value: stats.capacity, icon: Users, color: 'text-blue-500', glow: 'from-blue-500/10' },
                    ].map((stat, idx) => (
                        <motion.div key={idx} variants={itemVariant}>
                            <Card className="group p-8 bg-neutral-900/40 backdrop-blur-3xl border-neutral-800/50 hover:border-orange-600/30 transition-all duration-500 overflow-hidden relative rounded-[2rem]">
                                <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500", stat.glow)} />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-2xl bg-black/40 border border-neutral-800 flex items-center justify-center group-hover:scale-110 group-hover:border-orange-600/30 transition-all duration-500">
                                            <stat.icon className={cn("w-6 h-6", stat.color)} />
                                        </div>
                                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] group-hover:text-neutral-400 transition-colors">{stat.label}</p>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="text-4xl font-black text-white tracking-tight leading-none">{stat.value}</h3>
                                        <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">{stat.label.split(' ')[1] || 'Nodes'}</span>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Status Legend Bar */}
                <motion.div variants={itemVariant} className="flex flex-wrap items-center justify-center gap-4 p-4 bg-neutral-900/20 backdrop-blur-3xl rounded-[2.5rem] border border-neutral-800/50">
                    <div className="flex items-center gap-3 px-6 py-2 border-r border-neutral-800/50 mr-2">
                        <Zap className="w-4 h-4 text-orange-600" />
                        <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em]">Live Status Key</span>
                    </div>
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                        <div key={key} className="flex items-center gap-3 px-6 py-2.5 rounded-2xl hover:bg-white/5 transition-all group/key cursor-default">
                            <div className={cn("w-2.5 h-2.5 rounded-full", cfg.dot, "shadow-[0_0_10px_currentColor]")} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 group-hover/key:text-white transition-colors">{cfg.label}</span>
                        </div>
                    ))}
                </motion.div>

                {/* Floor Plan Grid */}
                <div className="space-y-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-8 bg-orange-600 rounded-full" />
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-4">
                                Floor Plan
                            </h2>
                        </div>
                        <div className="h-[1px] flex-1 bg-neutral-800/50 mx-10 hidden sm:block" />
                        <div className="flex items-center gap-2 text-neutral-500">
                            <Layers className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Topology View</span>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-20"><LoadingSpinner /></div>
                    ) : tables.length === 0 ? (
                        <Card className="p-20 bg-neutral-900/30 border-neutral-800/50 backdrop-blur-sm text-center rounded-[3rem] border-dashed">
                            <Grid3X3 className="w-16 h-16 text-neutral-800 mx-auto mb-6" />
                            <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2">No Tables Yet</h3>
                            <p className="text-neutral-500 text-lg max-w-sm mx-auto mb-10 leading-relaxed font-medium">
                                Your restaurant floor is empty. Add your first table to start managing seating and orders.
                            </p>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowModal(true)}
                                className="h-14 px-10 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-widest text-xs shadow-2xl shadow-orange-600/20 transition-all border-none"
                            >
                                Add First Table
                            </motion.button>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                            {tables.map((table) => {
                                const cfg = statusConfig[table.status]
                                return (
                                    <motion.div key={table.id} variants={itemVariant} layout>
                                        <Card className={cn(
                                            "pt-12 pb-10 px-8 bg-neutral-900/40 backdrop-blur-3xl border-neutral-800/50 hover:border-orange-600/30 transition-all duration-700 relative rounded-[3rem] group overflow-hidden h-full flex flex-col items-center shadow-2xl",
                                            cfg.glow.replace('/20', '/5')
                                        )}>
                                            {/* Premium Background Textures */}
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                            <div className={cn("absolute -top-24 -right-24 w-48 h-48 blur-[80px] opacity-10 group-hover:opacity-30 transition-opacity duration-700 rounded-full", cfg.dot)} />

                                            {/* Action Overlay */}
                                            <div className="absolute top-6 right-6 flex flex-col gap-3 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500 z-20">
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => { setEditingTable(table); setShowModal(true); }}
                                                    className="w-12 h-12 rounded-2xl bg-white text-black hover:bg-orange-600 hover:text-white flex items-center justify-center shadow-2xl transition-all duration-300"
                                                >
                                                    <Edit2 className="w-5 h-5" />
                                                </motion.button>
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => deleteTable(table.id)}
                                                    className="w-12 h-12 rounded-2xl bg-neutral-950/50 text-neutral-500 hover:bg-rose-600 hover:text-white flex items-center justify-center shadow-2xl transition-all duration-300 border border-neutral-800"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </motion.button>
                                            </div>

                                            {/* Table Geometry */}
                                            <div className="relative mb-8 group-hover:scale-110 transition-transform duration-700">
                                                <div className={cn(
                                                    "absolute inset-0 blur-3xl opacity-20 group-hover:opacity-50 transition-all duration-700",
                                                    cfg.dot
                                                )} />

                                                <div className={cn(
                                                    "w-36 h-36 rounded-full border-2 flex flex-col items-center justify-center relative bg-black/60 backdrop-blur-md shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-700",
                                                    cfg.border,
                                                    "group-hover:border-white/20"
                                                )}>
                                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-1">Table</span>
                                                    <span className="text-5xl font-black text-white tracking-tighter leading-none">{table.table_number}</span>

                                                    {/* Status Pulse */}
                                                    <div className={cn(
                                                        "absolute -top-1 -right-1 w-6 h-6 rounded-full border-4 border-black z-10",
                                                        cfg.dot,
                                                        (table.status === 'occupied' || table.status === 'billing') && 'animate-ping opacity-75'
                                                    )} />
                                                    <div className={cn(
                                                        "absolute -top-1 -right-1 w-6 h-6 rounded-full border-4 border-black z-10",
                                                        cfg.dot
                                                    )} />
                                                </div>
                                            </div>

                                            <div className="text-center space-y-2 mb-10 relative z-10">
                                                <div className="flex items-center justify-center gap-3">
                                                    <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/5 flex items-center gap-2">
                                                        <Users className="w-3 h-3 text-neutral-400" />
                                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{table.capacity} Seats</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            <div className={cn(
                                                "px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] border shadow-2xl relative z-10 transition-all duration-500",
                                                cfg.bg, cfg.text, cfg.border,
                                                "group-hover:bg-white group-hover:text-black group-hover:border-white"
                                            )}>
                                                {cfg.label}
                                            </div>

                                            {/* Action Controls */}
                                            <div className="mt-10 pt-8 border-t border-neutral-800/50 w-full flex gap-4 relative z-10">
                                                {table.status !== 'available' && (
                                                    <motion.button
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => handleStatusChange(table.id, 'available')}
                                                        className="flex-1 h-12 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black font-black text-[9px] uppercase tracking-widest transition-all border border-emerald-500/20"
                                                    >
                                                        Clear Node
                                                    </motion.button>
                                                )}
                                                {table.status === 'available' && (
                                                    <motion.button
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => handleStatusChange(table.id, 'occupied')}
                                                        className="flex-1 h-12 rounded-2xl bg-orange-600/10 hover:bg-orange-600 text-orange-600 hover:text-white font-black text-[9px] uppercase tracking-widest transition-all border border-orange-600/20"
                                                    >
                                                        Engage
                                                    </motion.button>
                                                )}
                                                {table.status === 'occupied' && (
                                                    <motion.button
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => handleStatusChange(table.id, 'billing')}
                                                        className="flex-1 h-12 rounded-2xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white font-black text-[9px] uppercase tracking-widest transition-all border border-rose-500/20"
                                                    >
                                                        Finalize
                                                    </motion.button>
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
                    title={editingTable ? `EDit Table ${editingTable.table_number}` : 'Add New Table'}
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
        <form onSubmit={handleSubmit} className="space-y-10">
            <div className="space-y-8">
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Table Name/Number</label>
                    <input
                        type="text"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        placeholder="e.g. Table 01, Window Side"
                        required
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl h-14 px-6 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600/50 transition-all placeholder:text-neutral-700 shadow-inner"
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Standard Seating</label>
                    <div className="grid grid-cols-4 gap-4">
                        {[2, 4, 6, 8].map((cap) => (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                key={cap}
                                type="button"
                                onClick={() => setCapacity(cap)}
                                className={cn(
                                    "h-14 rounded-2xl font-black text-xs transition-all border flex items-center justify-center relative overflow-hidden",
                                    capacity === cap
                                        ? 'bg-orange-600 border-orange-600 text-white shadow-2xl shadow-orange-600/30'
                                        : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-white'
                                )}
                            >
                                {capacity === cap && (
                                    <motion.div layoutId="active-cap" className="absolute inset-0 bg-orange-600" />
                                )}
                                <span className="relative z-10">{cap}</span>
                            </motion.button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Custom Capacity</label>
                    <input
                        type="number"
                        value={capacity}
                        onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                        placeholder="How many seats?"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl h-14 px-6 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600/50 transition-all placeholder:text-neutral-700 shadow-inner"
                    />
                </div>
            </div>

            <div className="flex gap-4 pt-10 border-t border-neutral-800/50">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onCancel}
                    type="button"
                    className="flex-1 h-14 rounded-2xl bg-neutral-800/50 border border-neutral-800 text-neutral-500 font-black uppercase tracking-widest text-[10px] hover:bg-neutral-800 hover:text-white transition-all shadow-lg"
                >
                    Cancel
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 h-14 rounded-2xl bg-orange-600 text-white font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-orange-600/30 border-none relative overflow-hidden group"
                    type="submit"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center"><LoadingSpinner className="w-4 h-4" /></div>
                    ) : (
                        <>
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                            {table ? 'Update Table' : 'Create Table'}
                        </>
                    )}
                </motion.button>
            </div>
        </form>
    )
}
