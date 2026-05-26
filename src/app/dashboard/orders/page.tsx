'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Clock, CheckCircle2, XCircle, ChefHat, Utensils,
  DollarSign, Eye, X, Printer, ArrowRight, MapPin,
  LayoutList, LayoutGrid, RefreshCw, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAllOrders } from '@/hooks/useRealtimeOrders'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import type { Order, OrderStatus } from '@/types'

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string; border: string; dot: string; icon: React.ElementType }> = {
  pending:  { label: 'Pending',  color: 'text-rose-500',   bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   dot: 'bg-rose-500',   icon: Clock },
  preparing: { label: 'Preparing', color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-500',   icon: ChefHat },
  ready:   { label: 'Ready',   color: 'text-emerald-500',  bg: 'bg-emerald-500/10',  border: 'border-emerald-500/20',  dot: 'bg-emerald-500',  icon: CheckCircle2 },
  served:  { label: 'Served',  color: 'text-blue-500',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   dot: 'bg-blue-500',   icon: Utensils },
  paid:   { label: 'Paid',   color: 'text-brand',     bg: 'bg-brand-subtle',   border: 'border-brand/20',     dot: 'bg-brand',     icon: DollarSign },
  cancelled: { label: 'Cancelled', color: 'text-[var(--text-muted)]', bg: 'bg-[var(--surface-active)]', border: 'border-[var(--border)]', dot: 'bg-[var(--text-muted)]', icon: XCircle },
}

const kanbanStatuses: OrderStatus[] = ['pending', 'preparing', 'ready', 'served']

export default function OrdersPage() {
  const { orders: realtimeOrders, isLoading, refresh } = useAllOrders()
  const { success, error: showError } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  const filteredOrders = realtimeOrders.filter(order => {
    const matchesSearch = order.order_number?.toString().includes(searchQuery) ||
      order.table?.table_number?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getTimeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
  }

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (error) {
      showError('Error', 'Failed to update order status')
    } else {
      success('Updated', `Order status changed to ${newStatus}`)
      setSelectedOrder(null)
      refresh()
    }
  }

  const stats = [
    { label: 'Total', value: realtimeOrders.length, icon: Utensils },
    { label: 'Active', value: realtimeOrders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)).length, icon: Clock },
    { label: 'Revenue', value: `Rs. ${(realtimeOrders.reduce((sum, o) => sum + (o.total || 0), 0) / 1000).toFixed(1)}K`, icon: DollarSign },
  ]

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full bg-brand-subtle border border-brand/20 text-[10px] font-bold text-brand uppercase tracking-wider">
                Order Hub
              </span>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Live Sync</span>
            </div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Order <span className="text-brand">History</span>
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Managing <span className="text-[var(--text-primary)] font-semibold">{realtimeOrders.length} orders</span> across the restaurant.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              disabled={isLoading}
              className="h-10 px-4 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              Refresh
            </button>

            <Link
              href="/dashboard/kitchen"
              className="h-10 px-4 rounded-lg bg-brand hover:bg-brand-hover text-[var(--text-primary)] transition-all text-sm font-medium flex items-center gap-2 shadow-glow"
            >
              <ChefHat className="w-4 h-4" />
              Kitchen
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-subtle flex items-center justify-center text-brand">
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-[var(--text-primary)]">{stat.value}</p>
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters & View Toggle */}
        <div className="flex flex-col xl:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order # or table..."
              className="w-full h-10 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg pl-10 pr-4 text-sm outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>

          <div className="flex gap-2 flex-wrap justify-center">
            {(['all', 'pending', 'preparing', 'ready', 'served', 'paid'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all border',
                  statusFilter === status
                    ? 'bg-brand text-[var(--text-primary)] border-brand shadow-glow'
                    : 'bg-[var(--surface-raised)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                )}
              >
                {status === 'all' ? 'All' : statusConfig[status].label}
              </button>
            ))}
          </div>

          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "px-3 py-2 text-sm transition-all flex items-center gap-1.5",
                viewMode === 'list' ? "bg-brand text-[var(--text-primary)]" : "bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
              aria-label="List view"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                "px-3 py-2 text-sm transition-all flex items-center gap-1.5",
                viewMode === 'kanban' ? "bg-brand text-[var(--text-primary)]" : "bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
              aria-label="Kanban view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand" />
          </div>
        ) : viewMode === 'list' ? (
          <ListView
            orders={filteredOrders}
            onSelect={setSelectedOrder}
            getTimeAgo={getTimeAgo}
          />
        ) : (
          <KanbanView
            orders={filteredOrders}
            onSelect={setSelectedOrder}
            onStatusChange={updateOrderStatus}
            getTimeAgo={getTimeAgo}
          />
        )}

        {/* Order Detail Modal */}
        <AnimatePresence>
          {selectedOrder && (
            <Modal
              isOpen={!!selectedOrder}
              onClose={() => setSelectedOrder(null)}
              title={`Order #${selectedOrder.order_number}`}
              size="lg"
            >
              <OrderDetail
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
                onStatusChange={updateOrderStatus}
              />
            </Modal>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ============================================
  LIST VIEW
  ============================================ */

function ListView({ orders, onSelect, getTimeAgo }: {
  orders: Order[]
  onSelect: (o: Order) => void
  getTimeAgo: (d: string) => string
}) {
  return (
    <div className="rounded-xl overflow-hidden bg-[var(--surface-raised)] border border-[var(--border)]">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              <th className="px-5 py-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Order</th>
              <th className="px-5 py-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Table</th>
              <th className="px-5 py-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Items</th>
              <th className="px-5 py-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Total</th>
              <th className="px-5 py-4 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
              <th className="px-5 py-4 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Time</th>
              <th className="px-5 py-4 text-right text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {orders.length > 0 ? orders.map((order) => {
              const cfg = statusConfig[order.status]
              return (
                <tr
                  key={order.id}
                  className="group hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <td className="px-5 py-4">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">#{order.order_number}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center font-bold text-[11px] text-[var(--text-primary)]">
                        {order.table?.table_number || '?'}
                      </div>
                      <span className="text-sm text-[var(--text-secondary)]">Table {order.table?.table_number || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-[var(--text-primary)]">{order.items?.length || 0}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Rs. {order.total.toLocaleString()}</span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      cfg.bg, cfg.color, cfg.border
                    )}>
                      <cfg.icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">{getTimeAgo(order.created_at)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => onSelect(order)}
                      className="h-8 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all inline-flex items-center gap-2"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-[var(--text-muted)] text-sm font-medium">
                  No orders found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============================================
  KANBAN VIEW
  ============================================ */

function KanbanView({ orders, onSelect, onStatusChange, getTimeAgo }: {
  orders: Order[]
  onSelect: (o: Order) => void
  onStatusChange: (id: string, s: OrderStatus) => void
  getTimeAgo: (d: string) => string
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kanbanStatuses.map(status => {
        const cfg = statusConfig[status]
        const statusOrders = orders.filter(o => o.status === status)
        return (
          <div key={status} className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                <span className={cn("text-xs font-bold uppercase tracking-wider", cfg.color)}>{cfg.label}</span>
              </div>
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">{statusOrders.length}</span>
            </div>

            <div className="flex flex-col gap-2 min-h-[200px]">
              {statusOrders.map(order => (
                <motion.button
                  key={order.id}
                  layout
                  onClick={() => onSelect(order)}
                  className="text-left p-4 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-[var(--text-primary)]">#{order.order_number}</span>
                    <span className="text-[10px] font-medium text-[var(--text-muted)]">{getTimeAgo(order.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-2">
                    <MapPin className="w-3 h-3" />
                    Table {order.table?.table_number || 'N/A'}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">{order.items?.length || 0} items</span>
                    <span className="text-sm font-semibold text-brand">Rs. {order.total}</span>
                  </div>
                </motion.button>
              ))}

              {statusOrders.length === 0 && (
                <div className="py-8 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-raised)]">
                  <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">No orders</p>
                </div>
              )}
            </div>

            {/* Quick advance actions */}
            {status !== 'served' && (
              <div className="flex gap-2">
                {status === 'pending' && (
                  <button
                    onClick={() => statusOrders[0] && onStatusChange(statusOrders[0].id, 'preparing')}
                    disabled={statusOrders.length === 0}
                    className="flex-1 h-8 rounded-lg bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider border border-amber-500/20 hover:bg-amber-500 hover:text-[var(--text-primary)] transition-all disabled:opacity-30"
                  >
                    Start Prep
                  </button>
                )}
                {status === 'preparing' && (
                  <button
                    onClick={() => statusOrders[0] && onStatusChange(statusOrders[0].id, 'ready')}
                    disabled={statusOrders.length === 0}
                    className="flex-1 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20 hover:bg-emerald-500 hover:text-[var(--text-primary)] transition-all disabled:opacity-30"
                  >
                    Mark Ready
                  </button>
                )}
                {status === 'ready' && (
                  <button
                    onClick={() => statusOrders[0] && onStatusChange(statusOrders[0].id, 'served')}
                    disabled={statusOrders.length === 0}
                    className="flex-1 h-8 rounded-lg bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20 hover:bg-blue-500 hover:text-[var(--text-primary)] transition-all disabled:opacity-30"
                  >
                    Serve
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ============================================
  ORDER DETAIL
  ============================================ */

function OrderDetail({ order, onClose, onStatusChange }: {
  order: Order
  onClose: () => void
  onStatusChange: (id: string, s: OrderStatus) => void
}) {
  const cfg = statusConfig[order.status]
  const nextStatus: Record<OrderStatus, OrderStatus | null> = {
    pending: 'preparing',
    preparing: 'ready',
    ready: 'served',
    served: 'paid',
    paid: null,
    cancelled: null,
  }
  const ns = nextStatus[order.status]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-brand flex items-center justify-center font-bold text-lg">
            {order.table?.table_number || '?'}
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Table {order.table?.table_number || 'N/A'}</p>
            <span className={cn("text-[10px] font-bold uppercase tracking-wider", cfg.color)}>{cfg.label}</span>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
        {(order.items || []).map((item, i) => (
          <div
            key={i}
            className="flex justify-between items-center p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-md bg-brand-subtle flex items-center justify-center text-[11px] font-bold text-brand">
                x{item.quantity}
              </span>
              <span className="text-sm text-[var(--text-primary)]">{item.menu_item?.name || 'Item'}</span>
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">Rs. {item.subtotal || 0}</span>
          </div>
        ))}
      </div>

      <div className="p-4 bg-[var(--surface)] rounded-xl border border-[var(--border)] space-y-2">
        <div className="flex justify-between text-sm text-[var(--text-muted)]">
          <span>Subtotal</span>
          <span className="text-[var(--text-primary)]">Rs. {order.subtotal}</span>
        </div>
        <div className="flex justify-between text-sm text-[var(--text-muted)]">
          <span>Tax</span>
          <span className="text-[var(--text-primary)]">Rs. {order.tax}</span>
        </div>
        <div className="h-px bg-[var(--border)] my-2" />
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-brand">Total</span>
          <span className="text-2xl font-bold text-[var(--text-primary)]">Rs. {order.total}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 h-11 rounded-lg font-medium text-sm border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-all"
        >
          Close
        </button>
        {ns && (
          <button
            onClick={() => onStatusChange(order.id, ns)}
            className="flex-1 h-11 rounded-lg bg-brand hover:bg-brand-hover text-[var(--text-primary)] font-medium text-sm shadow-glow transition-all flex items-center justify-center gap-2"
          >
            Mark as {statusConfig[ns].label}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
        {!ns && order.status === 'served' && (
          <Link href={`/dashboard/billing?order=${order.id}`} className="flex-1">
            <button className="w-full h-11 rounded-lg bg-brand hover:bg-brand-hover text-[var(--text-primary)] font-medium text-sm shadow-glow transition-all flex items-center justify-center gap-2">
              Go to Billing
              <DollarSign className="w-4 h-4" />
            </button>
          </Link>
        )}
      </div>
    </div>
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
