'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    QrCode,
    Download,
    Printer,
    Copy,
    Check,
    ExternalLink,
    RefreshCw,
    Eye,
    Scan,
    Smartphone
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Card, Button, Badge, StatCard } from '@/components/ui/common'
import { cn } from '@/lib/utils'

const tables = [
    { id: '1', table_number: 'Table 1', capacity: 4, status: 'available' },
    { id: '2', table_number: 'Table 2', capacity: 2, status: 'occupied' },
    { id: '3', table_number: 'Table 3', capacity: 6, status: 'available' },
    { id: '4', table_number: 'Table 4', capacity: 4, status: 'available' },
    { id: '5', table_number: 'VIP Room A', capacity: 8, status: 'reserved' },
    { id: '6', table_number: 'VIP Room B', capacity: 4, status: 'occupied' },
]

export default function QRCodesPage() {
    const { success } = useToast()
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const getOrderUrl = (tableNumber: string) => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        return `${baseUrl}/order?table=${encodeURIComponent(tableNumber)}`
    }

    const handleCopy = (tableNumber: string) => {
        const url = getOrderUrl(tableNumber)
        navigator.clipboard.writeText(url)
        setCopiedId(tableNumber)
        success('Link Copied', 'The order URL has been copied to your clipboard.')
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleDownload = (tableNumber: string) => {
        success('QR Downloaded', `QR code for ${tableNumber} has been downloaded.`)
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">QR Codes</h1>
                    <p className="text-muted-foreground mt-1">Generate and manage QR codes for each table.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" icon={RefreshCw}>Regenerate All</Button>
                    <Button variant="primary" icon={Printer}>Print All</Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Tables" value={tables.length.toString()} icon={QrCode} />
                <StatCard label="Active Codes" value={tables.length.toString()} icon={Check} />
                <StatCard label="Scans Today" value="156" icon={Scan} change={12} />
                <StatCard label="Orders via QR" value="89" icon={Smartphone} change={8.5} />
            </div>

            {/* Instructions */}
            <Card className="p-6">
                <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <QrCode className="w-8 h-8" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                        <div className="text-center md:text-left">
                            <Printer className="w-5 h-5 text-primary mb-2 mx-auto md:mx-0" />
                            <h3 className="font-semibold text-foreground">1. Print</h3>
                            <p className="text-sm text-muted-foreground">Download and print QR codes for each table.</p>
                        </div>
                        <div className="text-center md:text-left">
                            <Eye className="w-5 h-5 text-primary mb-2 mx-auto md:mx-0" />
                            <h3 className="font-semibold text-foreground">2. Display</h3>
                            <p className="text-sm text-muted-foreground">Place QR codes on tables where customers can scan.</p>
                        </div>
                        <div className="text-center md:text-left">
                            <Smartphone className="w-5 h-5 text-primary mb-2 mx-auto md:mx-0" />
                            <h3 className="font-semibold text-foreground">3. Order</h3>
                            <p className="text-sm text-muted-foreground">Customers scan and order directly from their phones.</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* QR Code Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tables.map((table) => (
                    <motion.div key={table.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <Card className="p-6 hover:shadow-lg transition-shadow group">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-foreground">{table.table_number}</h3>
                                <Badge variant={table.status === 'available' ? 'success' : table.status === 'occupied' ? 'warning' : 'default'}>
                                    {table.status}
                                </Badge>
                            </div>

                            {/* QR Placeholder */}
                            <div className="w-full aspect-square rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center mb-4 p-6">
                                <div className="w-full h-full bg-neutral-100 dark:bg-neutral-900 rounded-lg flex items-center justify-center relative">
                                    <QrCode className="w-20 h-20 text-neutral-300 dark:text-neutral-600" />
                                    {/* Simulated QR pattern */}
                                    <div className="absolute inset-4 grid grid-cols-8 gap-1 opacity-30">
                                        {Array.from({ length: 64 }).map((_, i) => (
                                            <div key={i} className={cn('rounded-sm', Math.random() > 0.5 ? 'bg-neutral-800 dark:bg-white' : '')} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* URL */}
                            <div className="text-xs text-muted-foreground bg-neutral-50 dark:bg-neutral-800/50 p-2 rounded-lg mb-4 truncate font-mono">
                                {getOrderUrl(table.table_number)}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleCopy(table.table_number)}
                                    icon={copiedId === table.table_number ? Check : Copy}
                                >
                                    {copiedId === table.table_number ? 'Copied!' : 'Copy Link'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleDownload(table.table_number)}
                                    icon={Download}
                                >
                                    Download
                                </Button>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
