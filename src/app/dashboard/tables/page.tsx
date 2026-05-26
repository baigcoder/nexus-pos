'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Users, CheckCircle2, Grid3X3, Edit2, Trash2,
  Activity, Monitor, Zap, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'
import type { Table, TableStatus } from '@/types'

const statusConfig: Record<TableStatus, {
  label: string
  bg: string
  text: string
  dot: string
  border: string
}> = {
  available: {
    label: 'Ready',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    dot: 'bg-emerald-500',
    border: 'border-emerald-500/20',
  },
  occupied: {
    label: 'In Service',
    bg: 'bg-brand-subtle',
    text: 'text-brand',
    dot: 'bg-brand',
    border: 'border-brand/20',
  },
  reserved: {
    label: 'Reserved',
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    dot: 'bg-blue-500',
    border: 'border-blue-500/20',
  },
  billing: {
    label: 'Clearing',
    bg: 'bg-rose-500/10',
    text: 'text-rose-500',
    dot: 'bg-rose-500',
    border: 'border-rose-500/20',
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
      success('Status Updated', `Table status updated to ${newStatus}.`)
    } catch (err: any) { showError('Update Failed', err.message) }
  }

  const deleteTable = async (id: string) => {
    if (!confirm('Are you sure you want to remove this table?')) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('tables').delete().eq('id', id)
      if (error) throw error
      setTables(tables.filter(t => t.id !== id))
      success('Table Removed', 'The table has been removed.')
    } catch (err) { showError('Operation Failed', 'Could not delete the table.') }
  }

  const stats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    capacity: tables.reduce((sum, t) => sum + (t.capacity || 0), 0),
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full bg-brand-subtle border border-brand/20 text-[10px] font-bold text-brand uppercase tracking-wider">
                Live Management
              </span>
            </div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Table <span className="text-brand">Layout</span>
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Interactive floor plan. Monitor seating capacity and service states in real-time.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="h-10 px-5 bg-brand hover:bg-brand-hover text-[var(--text-primary)] rounded-lg flex items-center gap-2 transition-all font-medium text-sm shadow-glow"
          >
            <Plus className="w-4 h-4" />
            Add Table
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Tables', value: stats.total, icon: Grid3X3, color: 'text-[var(--text-primary)]', bg: 'bg-[var(--surface-active)]', border: 'border-[var(--border)]' },
            { label: 'Available', value: stats.available, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { label: 'In Use', value: stats.occupied, icon: Activity, color: 'text-brand', bg: 'bg-brand-subtle', border: 'border-brand/20' },
            { label: 'Total Seats', value: stats.capacity, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={cn(
                "p-4 rounded-xl border flex items-center gap-4",
                stat.bg, stat.border
              )}
            >
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--surface)]/30", stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</p>
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-[var(--surface-raised)] rounded-lg border border-[var(--border)]">
          <div className="flex items-center gap-2 mr-2">
            <Zap className="w-4 h-4 text-brand" />
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</span>
          </div>
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--surface)] border border-[var(--border)]">
              <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{cfg.label}</span>
            </div>
          ))}
        </div>

        {/* Floor Plan Grid */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-brand rounded-full" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Floor Plan</h2>
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider ml-auto">
              {tables.length} tables
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Monitor className="w-8 h-8 animate-spin text-brand" />
            </div>
          ) : tables.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-raised)]">
              <Grid3X3 className="w-12 h-12 text-[var(--text-muted)] mb-4" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">No Tables Yet</h3>
              <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm mb-6">
                Your restaurant floor is empty. Add your first table to start managing seating.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="h-10 px-6 rounded-lg bg-brand hover:bg-brand-hover text-[var(--text-primary)] font-medium text-sm shadow-glow transition-all"
              >
                Add First Table
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {tables.map((table, idx) => {
                const cfg = statusConfig[table.status]
                return (
                  <motion.div
                    key={table.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={cn(
                      "group relative p-5 bg-[var(--surface-raised)] border rounded-xl transition-all hover:border-[var(--border-strong)]",
                      cfg.border
                    )}
                  >
                    {/* Actions */}
                    <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingTable(table); setShowModal(true); }}
                        className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] flex items-center justify-center transition-all"
                        aria-label={`Edit table ${table.table_number}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteTable(table.id)}
                        className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-rose-500 hover:border-rose-500/20 flex items-center justify-center transition-all"
                        aria-label={`Delete table ${table.table_number}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Table Circle */}
                    <div className="flex flex-col items-center mb-4">
                      <div className={cn(
                        "w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center relative bg-[var(--surface)] transition-all",
                        cfg.border,
                        "group-hover:scale-105"
                      )}>
                        <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Table</span>
                        <span className="text-2xl font-bold text-[var(--text-primary)]">{table.table_number}</span>
                        <div className={cn(
                          "absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--surface)]",
                          cfg.dot,
                          (table.status === 'occupied' || table.status === 'billing') && 'animate-pulse'
                        )} />
                      </div>
                    </div>

                    <div className="text-center space-y-2">
                      <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <Users className="w-3 h-3" />
                        <span className="font-medium">{table.capacity} Seats</span>
                      </div>

                      <span className={cn(
                        "inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        cfg.bg, cfg.text, cfg.border
                      )}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-4 pt-3 border-t border-[var(--border)] flex gap-2">
                      {table.status !== 'available' && (
                        <button
                          onClick={() => handleStatusChange(table.id, 'available')}
                          className="flex-1 h-8 rounded-md bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-[var(--text-primary)] font-semibold text-[10px] uppercase tracking-wider transition-all border border-emerald-500/20"
                        >
                          Clear
                        </button>
                      )}
                      {table.status === 'available' && (
                        <button
                          onClick={() => handleStatusChange(table.id, 'occupied')}
                          className="flex-1 h-8 rounded-md bg-brand-subtle hover:bg-brand text-brand hover:text-[var(--text-primary)] font-semibold text-[10px] uppercase tracking-wider transition-all border border-brand/20"
                        >
                          Engage
                        </button>
                      )}
                      {table.status === 'occupied' && (
                        <button
                          onClick={() => handleStatusChange(table.id, 'billing')}
                          className="flex-1 h-8 rounded-md bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-[var(--text-primary)] font-semibold text-[10px] uppercase tracking-wider transition-all border border-rose-500/20"
                        >
                          Bill
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <Modal
            isOpen={showModal}
            onClose={() => { setShowModal(false); setEditingTable(null); }}
            title={editingTable ? `Edit Table ${editingTable.table_number}` : 'Add New Table'}
            size="md"
          >
            <TableForm
              table={editingTable}
              restaurantId={restaurant?.id || ''}
              onSuccess={() => { fetchTables(); setShowModal(false); setEditingTable(null); }}
              onCancel={() => { setShowModal(false); setEditingTable(null); }}
            />
          </Modal>
        )}
      </div>
    </div>
  )
}

/* ============================================
  TABLE FORM
  ============================================ */

function TableForm({ table, restaurantId, onSuccess, onCancel }: {
  table: Table | null
  restaurantId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [tableNumber, setTableNumber] = useState(table?.table_number || '')
  const [capacity, setCapacity] = useState(table?.capacity || 4)

  const handleSubmit = async (e: React.FormEvent) => {
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="table-number" className="label mb-2 block">Table Name / Number</label>
          <input
            id="table-number"
            type="text"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            placeholder="e.g. Table 01, Window Side"
            required
            className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all placeholder:text-[var(--text-muted)]"
          />
        </div>

        <div>
          <label className="label mb-2 block">Standard Seating</label>
          <div className="grid grid-cols-4 gap-3">
            {[2, 4, 6, 8].map((cap) => (
              <button
                key={cap}
                type="button"
                onClick={() => setCapacity(cap)}
                className={cn(
                  "h-11 rounded-lg font-semibold text-sm transition-all border",
                  capacity === cap
                    ? 'bg-brand border-brand text-[var(--text-primary)] shadow-glow'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                )}
              >
                {cap}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="table-capacity" className="label mb-2 block">Custom Capacity</label>
          <input
            id="table-capacity"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
            placeholder="Seats"
            className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all placeholder:text-[var(--text-muted)]"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-11 rounded-lg font-medium text-sm border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 h-11 rounded-lg bg-brand hover:bg-brand-hover text-[var(--text-primary)] font-medium text-sm shadow-glow flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
        >
          {isLoading ? <Monitor className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {table ? 'Update Table' : 'Create Table'}
        </button>
      </div>
    </form>
  )
}

/* ============================================
  MODAL
  ============================================ */

function Modal({ isOpen, onClose, title, children, size = 'md' }: {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--surface)]/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn(
          "relative bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-h-[90vh] flex flex-col overflow-hidden",
          sizes[size]
        )}
      >
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] transition-colors" aria-label="Close modal">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </motion.div>
    </div>
  )
}
