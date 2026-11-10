'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  QrCode,
  Download,
  Grid3X3,
  Eye,
  Copy,
  Smartphone,
  CheckCircle2,
  RefreshCw,
  Printer
} from 'lucide-react'
import QRCode from 'qrcode'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Modal } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface TableQR {
  id: string
  table_number: string
  order_url: string | null
  is_qr_active?: boolean
  capacity?: number
}

export default function QROrderingPage() {
  const { restaurant } = useAuthStore()
  const { success, error: showError } = useToast()
  const [tables, setTables] = useState<TableQR[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTable, setSelectedTable] = useState<TableQR | null>(null)
  const [qrImages, setQrImages] = useState<Record<string, string>>({})
  const [isDownloadingAll, setIsDownloadingAll] = useState(false)

  const generateQRImage = useCallback(async (url: string, size = 256): Promise<string> => {
    return QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
  }, [])

  // Fetch from Supabase
  useEffect(() => {
    async function loadTables() {
      if (!restaurant?.id) return
      setIsLoading(true)
      try {
        const response = await fetch('/api/tables/qr?restaurant_id=' + encodeURIComponent(restaurant.id), { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to load table QR codes')
        setTables(data.tables || [])
      } catch (err) {
        showError('Error', 'Failed to load tables')
      } finally {
        setIsLoading(false)
      }
    }
    loadTables()
  }, [restaurant?.id])

  // Generate real QR images for all tables
  useEffect(() => {
    let cancelled = false
    async function generateAll() {
      const images: Record<string, string> = {}
      for (const table of tables) {
        try {
          if (table.order_url) images[table.id] = await generateQRImage(table.order_url)
        } catch {}
      }
      if (!cancelled) setQrImages(images)
    }
    void generateAll()
    return () => { cancelled = true }
  }, [tables, generateQRImage])

  const activeTables = tables.filter(t => t.is_qr_active !== false).length

  const handleCopyLink = (table: TableQR) => {
    if (!table.order_url) return
    navigator.clipboard.writeText(table.order_url)
    success('Copied!', `Link for Table ${table.table_number} copied`)
  }

  const downloadQR = async (table: TableQR) => {
    try {
      if (!table.order_url) return
      const dataUrl = await generateQRImage(table.order_url, 512)
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${restaurant?.slug || 'restaurant'}-table-${table.table_number}-qr.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      success('Downloaded', `QR code for Table ${table.table_number} saved`)
    } catch {
      showError('Error', 'Failed to generate QR code')
    }
  }

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true)
    try {
      for (const table of tables.filter(t => t.is_qr_active !== false)) {
        await downloadQR(table)
      }
    } finally {
      setIsDownloadingAll(false)
    }
  }

  const handlePrintAll = () => {
    const escapeText = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    const restaurantName = escapeText(restaurant?.name || '')
    const activeTablesList = tables.filter(table => table.order_url && qrImages[table.id])
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const cards = activeTablesList.map(table => `
      <div style="display:inline-block;text-align:center;padding:24px;border:1px solid #ddd;border-radius:12px;margin:12px;page-break-inside:avoid;">
        <img src="${qrImages[table.id] || ''}" style="width:200px;height:200px;" />
        <h3 style="margin:12px 0 4px;font-family:sans-serif;">Table ${escapeText(table.table_number)}</h3>
        <p style="margin:0;color:#666;font-size:12px;font-family:sans-serif;">${restaurantName}</p>
        <p style="margin:4px 0 0;color:#999;font-size:10px;font-family:sans-serif;">Scan to order</p>
      </div>
    `).join('')

    printWindow.document.write(`
      <html><head><title>Table QR Codes - ${restaurantName}</title></head>
      <body style="margin:0;padding:24px;">${cards}</body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const updateTableQr = async (id: string, action: 'set_enabled' | 'rotate') => {
    const table = tables.find(entry => entry.id === id)
    if (!table || !restaurant?.id) return
    if (action === 'rotate' && !window.confirm('Replace this table code? Existing printed codes will stop working.')) return

    try {
      const response = await fetch('/api/tables/qr', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id, tableId: id, action, enabled: table.is_qr_active === false,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to update table')
      setQrImages(current => Object.fromEntries(Object.entries(current).filter(([tableId]) => tableId !== id)))
      setTables(current => current.map(entry => entry.id === id ? result.table : entry))
      setSelectedTable(current => current?.id === id ? result.table : current)
      success('Updated', action === 'rotate' ? 'Download or print the new code.' :
        result.table.is_qr_active ? 'Table ordering enabled. Print the new code.' : 'Table ordering disabled.')
    } catch (error) {
      showError('Error', error instanceof Error ? error.message : 'Failed to update table')
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
            <Badge variant="outline" className="bg-blue-600/10 text-blue-500 border-blue-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
              <QrCode className="w-3 h-3 mr-1" /> QR Ordering
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Table <span className="text-blue-500">QR Codes</span>
          </h1>
          <p className="text-[var(--text-muted)] text-lg font-medium">
            <span className="text-[var(--text-primary)] font-bold">{activeTables} active</span> table codes for self-ordering
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            icon={Printer}
            onClick={handlePrintAll}
            disabled={activeTables === 0}
            className="h-14 px-6 border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-widest text-xs"
          >
            Print All
          </Button>
          <Button
            icon={Download}
            onClick={handleDownloadAll}
            isLoading={isDownloadingAll}
            disabled={activeTables === 0}
            className="h-14 px-10 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest text-xs"
          >
            Download All QRs
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Tables', value: activeTables, icon: Grid3X3, color: 'text-blue-500' },
          { label: 'Total Tables', value: tables.length, icon: Eye, color: 'text-emerald-500' },
          { label: 'Inactive', value: tables.length - activeTables, icon: Smartphone, color: 'text-brand' },
          { label: 'Active Rate', value: `${tables.length > 0 ? Math.round((activeTables / tables.length) * 100) : 0}%`, icon: CheckCircle2, color: 'text-yellow-500' },
        ].map((stat, idx) => (
          <motion.div key={idx} variants={item}>
            <Card className="p-5 bg-[var(--surface-raised)] border-[var(--border)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">{stat.label}</p>
                  <h3 className={cn("text-2xl font-bold", stat.color)}>{stat.value}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">
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
              "p-6 bg-[var(--surface-raised)] border-[var(--border)] hover:border-blue-500/30 transition-all cursor-pointer",
              table.is_qr_active === false && 'opacity-50'
            )} onClick={() => setSelectedTable(table)}>
              {/* Real QR Code */}
              <div className="w-full aspect-square bg-white rounded-xl mb-4 p-4 flex items-center justify-center">
                {qrImages[table.id] ? (
                  <img src={qrImages[table.id]} alt={`QR for Table ${table.table_number}`} className="w-full h-full object-contain" />
                ) : (
                  <QrCode className="w-16 h-16 text-neutral-300 animate-pulse" />
                )}
              </div>

              <div className="text-center">
                <h3 className="font-bold text-[var(--text-primary)] text-lg">Table {table.table_number}</h3>
                <div className="flex justify-center gap-4 mt-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                  <span>Capacity: {table.capacity || '-'}</span>
                  <span>{table.is_qr_active !== false ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyLink(table) }}
                  className="flex-1 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-blue-500 hover:border-blue-500 transition-all"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); downloadQR(table) }}
                  className="flex-1 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-blue-500 hover:border-blue-500 transition-all"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); void updateTableQr(table.id, 'set_enabled') }}
                  className={cn(
                    "flex-1 h-10 rounded-lg flex items-center justify-center font-bold text-[10px] uppercase tracking-widest transition-all",
                    table.is_qr_active !== false
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                      : 'bg-[var(--surface-active)] text-[var(--text-muted)]'
                  )}
                >
                  {table.is_qr_active !== false ? 'Active' : 'Off'}
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
          title={`Table ${selectedTable.table_number}`}
          size="sm"
        >
          <div className="space-y-6 py-4">
            {selectedTable.order_url && (
              <Button variant="outline" onClick={() => updateTableQr(selectedTable.id, 'rotate')}>
                Replace QR code
              </Button>
            )}
            {/* Large QR */}
            <div className="w-full max-w-xs mx-auto aspect-square bg-white rounded-2xl p-6 flex items-center justify-center">
              {qrImages[selectedTable.id] ? (
                <img src={qrImages[selectedTable.id]} alt={`QR for Table ${selectedTable.table_number}`} className="w-full h-full object-contain" />
              ) : (
                <QrCode className="w-20 h-20 text-neutral-300 animate-pulse" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--surface-raised)] rounded-xl text-center">
                <p className="text-2xl font-bold text-emerald-500">{selectedTable.capacity || '-'}</p>
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Capacity</p>
              </div>
              <div className="p-4 bg-[var(--surface-raised)] rounded-xl text-center">
                <p className="text-2xl font-bold text-blue-500">{selectedTable.is_qr_active !== false ? 'Yes' : 'No'}</p>
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Active</p>
              </div>
            </div>

            <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Order Link</p>
              <p className="text-sm text-[var(--text-muted)] break-all">{selectedTable.order_url || 'Ordering is disabled'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                icon={RefreshCw}
                onClick={() => { void updateTableQr(selectedTable.id, 'set_enabled') }}
                className="h-14 border-[var(--border)] text-[var(--text-muted)]"
              >
                {selectedTable.is_qr_active !== false ? 'Disable' : 'Enable'}
              </Button>
              <Button
                icon={Download}
                disabled={!selectedTable.order_url}
                onClick={() => { downloadQR(selectedTable); setSelectedTable(null) }}
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
