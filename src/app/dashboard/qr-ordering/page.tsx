'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    QrCode,
    Download,
    Grid3X3,
    Eye,
    Copy,
    ExternalLink,
    Smartphone,
    CheckCircle2,
    RefreshCw
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Modal } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface TableQR {
    id: string
    number: number
    qr_code_data: string | null
    is_active: boolean
    capacity?: number
}

export default function QROrderingPage() {
    const { restaurant } = useAuthStore()
    const { success, error: showError } = useToast()
    const [tables, setTables] = useState<TableQR[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedTable, setSelectedTable] = useState<TableQR | null>(null)

    // Fetch from Supabase
    useEffect(() => {
        async function loadTables() {
            if (!restaurant?.id) return
            setIsLoading(true)
            try {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from('tables')
                    .select('*')
                    .eq('restaurant_id', restaurant.id)
                    .order('number')

                if (error) throw error
                setTables(data || [])
            } catch (err) {
                showError('Error', 'Failed to load tables')
            } finally {
                setIsLoading(false)
            }
        }
        loadTables()
    }, [restaurant?.id])

    const activeTables = tables.filter(t => t.is_active).length

    const handleCopyLink = (table: TableQR) => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const slug = restaurant?.slug || 'restaurant'
        navigator.clipboard.writeText(`${baseUrl}/${slug}/order?table=${table.number}`)
        success('Copied!', `Link for Table ${table.number} copied`)
    }

    const handleToggleActive = async (id: string) => {
        const table = tables.find(t => t.id === id)
        if (!table) return

        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('tables')
                .update({ is_active: !table.is_active })
                .eq('id', id)

            if (error) throw error
            setTables(tables.map(t => t.id === id ? { ...t, is_active: !t.is_active } : t))
            success('Updated', `Table ${table.number} ${table.is_active ? 'disabled' : 'enabled'}`)
        } catch (err) {
            showError('Error', 'Failed to update table')
        }
    }

    const handleRegenerateQR = (id: string) => {
        success('Regenerated', 'New QR code generated')
    }

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
    const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } } }

    // Generate a simple QR code pattern (placeholder)
    const generateQRPattern = (seed: string) => {
        const pattern = []
        for (let i = 0; i < 25; i++) {
            pattern.push(Math.random() > 0.5)
        }
        return pattern
    }

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-10 pb-24">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-blue-600/10 text-blue-500 border-blue-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            <QrCode className="w-3 h-3 mr-1" /> QR Ordering
                        </Badge>
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white uppercase">
                        Table <span className="text-blue-500">QR Codes</span>
                    </h1>
                    <p className="text-neutral-400 text-lg font-medium">
                        <span className="text-white font-bold">{activeTables} active</span> table codes for self-ordering
                    </p>
                </div>
                <Button icon={Download} className="h-14 px-10 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest text-xs">
                    Download All QRs
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Active Tables', value: activeTables, icon: Grid3X3, color: 'text-blue-500' },
                    { label: 'Total Tables', value: tables.length, icon: Eye, color: 'text-emerald-500' },
                    { label: 'Inactive', value: tables.length - activeTables, icon: Smartphone, color: 'text-purple-500' },
                    { label: 'Active Rate', value: `${tables.length > 0 ? Math.round((activeTables / tables.length) * 100) : 0}%`, icon: CheckCircle2, color: 'text-yellow-500' },
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

            {/* Tables Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {tables.map((table) => (
                    <motion.div key={table.id} variants={item}>
                        <Card className={cn(
                            "p-6 bg-neutral-900 border-neutral-800 hover:border-blue-500/30 transition-all cursor-pointer",
                            !table.is_active && 'opacity-50'
                        )} onClick={() => setSelectedTable(table)}>
                            {/* QR Code Placeholder */}
                            <div className="w-full aspect-square bg-white rounded-xl mb-4 p-4 flex items-center justify-center">
                                <div className="grid grid-cols-5 gap-1">
                                    {generateQRPattern(table.id).map((filled, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "w-4 h-4 rounded-sm",
                                                filled ? 'bg-black' : 'bg-transparent'
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="text-center">
                                <h3 className="font-bold text-white text-lg">Table {table.number}</h3>
                                <div className="flex justify-center gap-4 mt-2 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                                    <span>Capacity: {table.capacity || '-'}</span>
                                    <span>{table.is_active ? 'Active' : 'Inactive'}</span>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleCopyLink(table) }}
                                    className="flex-1 h-10 rounded-lg bg-black border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-blue-500 hover:border-blue-500 transition-all"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleActive(table.id) }}
                                    className={cn(
                                        "flex-1 h-10 rounded-lg flex items-center justify-center font-bold text-[10px] uppercase tracking-widest transition-all",
                                        table.is_active
                                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                                            : 'bg-neutral-800 text-neutral-500'
                                    )}
                                >
                                    {table.is_active ? 'Active' : 'Off'}
                                </button>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Detail Modal */}
            {selectedTable && (
                <Modal
                    isOpen={!!selectedTable}
                    onClose={() => setSelectedTable(null)}
                    title={`Table ${selectedTable.number}`}
                    size="sm"
                >
                    <div className="space-y-6 py-4">
                        {/* Large QR */}
                        <div className="w-full max-w-xs mx-auto aspect-square bg-white rounded-2xl p-6 flex items-center justify-center">
                            <div className="grid grid-cols-7 gap-1">
                                {Array(49).fill(0).map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "w-6 h-6 rounded-sm",
                                            Math.random() > 0.4 ? 'bg-black' : 'bg-transparent'
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-neutral-900 rounded-xl text-center">
                                <p className="text-2xl font-bold text-emerald-500">{selectedTable.capacity || '-'}</p>
                                <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Capacity</p>
                            </div>
                            <div className="p-4 bg-neutral-900 rounded-xl text-center">
                                <p className="text-2xl font-bold text-blue-500">{selectedTable.is_active ? 'Yes' : 'No'}</p>
                                <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Active</p>
                            </div>
                        </div>

                        <div className="p-4 bg-black border border-neutral-800 rounded-xl">
                            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2">Order Link</p>
                            <p className="text-sm text-neutral-400 break-all">{typeof window !== 'undefined' ? window.location.origin : ''}/{restaurant?.slug || 'restaurant'}/order?table={selectedTable.number}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                variant="outline"
                                icon={RefreshCw}
                                onClick={() => { handleRegenerateQR(selectedTable.id); setSelectedTable(null) }}
                                className="h-14 border-neutral-800 text-neutral-500"
                            >
                                Regenerate
                            </Button>
                            <Button
                                icon={Download}
                                className="h-14 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest text-xs"
                            >
                                Download
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </motion.div>
    )
}
