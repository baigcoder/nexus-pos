'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CreditCard, Banknote, Smartphone, Check, Receipt, DollarSign,
  Percent, Calculator, CheckCircle2, X, Loader2, Tag, ArrowRight,
  Clock, User, Table2
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'

type PaymentMethod = 'cash' | 'card' | 'mobile'

interface BillOrder {
  id: string
  order_number: number
  table_number: string | null
  status: string
  subtotal: number
  tax: number
  total: number
  created_at: string
  order_items: Array<{
    name: string
    quantity: number
    price: number
    subtotal: number
  }> | null
  table: { table_number: string } | null
}

export default function BillingPage() {
  const { success, error: showError } = useToast()
  const { restaurant } = useAuthStore()
  const [orders, setOrders] = useState<BillOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<BillOrder | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [cashReceived, setCashReceived] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const loadOrders = useCallback(async () => {
    if (!restaurant?.id) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, subtotal, tax, total, created_at,
          table:tables(table_number),
          order_items:order_items(quantity, subtotal, menu_item:menu_items(name, price))
        `)
        .eq('restaurant_id', restaurant.id)
        .in('status', ['pending', 'preparing', 'ready', 'served'])
        .order('created_at', { ascending: false })

      if (error) throw error
      const mapped = (data || []).map((order: Record<string, unknown>) => ({
        ...order,
        table_number: (order.table as { table_number: string } | null)?.table_number ?? null,
        order_items: ((order.order_items as Array<Record<string, unknown>> | null) || []).map((item) => ({
          name: ((item.menu_item as Record<string, unknown>)?.name as string) || 'Item',
          quantity: item.quantity as number,
          price: ((item.menu_item as Record<string, unknown>)?.price as number) || 0,
          subtotal: item.subtotal as number,
        })),
      }))
      setOrders(mapped as BillOrder[])
    } catch (err) {
      showError('Error', 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [restaurant?.id, showError])

  useEffect(() => { loadOrders() }, [loadOrders])

  const calculateDiscount = () => {
    if (!selectedOrder) return 0
    if (discountType === 'percent') return Math.round(selectedOrder.subtotal * (discount / 100))
    return discount
  }

  const calculateTotal = () => {
    if (!selectedOrder) return 0
    return Math.max(0, selectedOrder.total - calculateDiscount())
  }

  const calculateChange = () => {
    const received = parseFloat(cashReceived) || 0
    return Math.max(0, received - calculateTotal())
  }

  const handleProcessPayment = async () => {
    if (!selectedOrder) return
    setIsProcessing(true)
    try {
      const response = await fetch('/api/billing/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          paymentMethod,
          cashReceived: paymentMethod === 'cash' ? parseFloat(cashReceived) : undefined,
          discount: calculateDiscount() > 0 ? calculateDiscount() : undefined,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Payment failed')

      success('Payment Complete', `Order #${selectedOrder.order_number} has been paid.`)
      setSelectedOrder(null)
      setDiscount(0)
      setCashReceived('')
      loadOrders()
    } catch (err: any) {
      showError('Payment Failed', err.message || 'Could not process payment')
    } finally {
      setIsProcessing(false)
    }
  }

  const quickAmounts = useCallback((total: number) => {
    const amounts = [500, 1000, 5000]
    return amounts.filter(a => a >= total)
  }, [])

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Billing & Payments</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {orders.length} unpaid order{orders.length !== 1 ? 's' : ''} waiting
          </p>
        </div>
        <button
          onClick={loadOrders}
          disabled={loading}
          className="h-9 px-4 rounded-lg bg-brand-subtle text-brand hover:bg-brand/20 border border-brand/20 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
        >
          <Loader2 className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Order List */}
        <div className="lg:col-span-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[var(--text-muted)]" />
            Unpaid Orders
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] animate-pulse" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)]">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-[var(--text-primary)]">All caught up!</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">No unpaid orders right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <button
                  key={order.id}
                  onClick={() => { setSelectedOrder(order); setCashReceived(''); setDiscount(0) }}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all",
                    selectedOrder?.id === order.id
                      ? "bg-brand-subtle border-brand/30"
                      : "bg-[var(--surface-raised)] border-[var(--border)] hover:border-[var(--border-strong)]"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--text-primary)]">#{order.order_number}</span>
                      {order.table_number && (
                        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                          <Table2 className="w-3 h-3" /> {order.table_number}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-brand">{formatCurrency(order.total)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>{order.order_items?.length || 0} items</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payment Panel */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {selectedOrder ? (
              <motion.div
                key={selectedOrder.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl overflow-hidden"
              >
                {/* Order header */}
                <div className="p-5 border-b border-[var(--border)]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">Order #{selectedOrder.order_number}</h3>
                      <p className="text-xs text-[var(--text-muted)]">{selectedOrder.table_number || 'Takeaway'} · {new Date(selectedOrder.created_at).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    {selectedOrder.order_items?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">{item.quantity}× {item.name}</span>
                        <span className="text-[var(--text-primary)] font-medium">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Subtotal</span>
                    <span className="text-[var(--text-primary)]">{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Tax</span>
                    <span className="text-[var(--text-primary)]">{formatCurrency(selectedOrder.tax)}</span>
                  </div>
                  {calculateDiscount() > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-500">Discount</span>
                      <span className="text-emerald-500 font-medium">-{formatCurrency(calculateDiscount())}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-base font-bold mt-2 pt-2 border-t border-[var(--border)]">
                    <span className="text-[var(--text-primary)]">Total</span>
                    <span className="text-brand text-xl">{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="p-5 border-b border-[var(--border)]">
                  <label className="label mb-3 block">Payment Method</label>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { id: 'cash' as PaymentMethod, label: 'Cash', icon: Banknote },
                      { id: 'card' as PaymentMethod, label: 'Card', icon: CreditCard },
                      { id: 'mobile' as PaymentMethod, label: 'Mobile', icon: Smartphone },
                    ]).map(m => (
                      <button
                        key={m.id}
                        onClick={() => setPaymentMethod(m.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                          paymentMethod === m.id
                            ? "bg-brand-subtle border-brand/30 text-brand"
                            : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                        )}
                      >
                        <m.icon className="w-5 h-5" />
                        <span className="text-xs font-medium">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cash handling */}
                {paymentMethod === 'cash' && (
                  <div className="p-5 border-b border-[var(--border)]">
                    <label className="label mb-3 block">Cash Received</label>
                    <div className="relative mb-3">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input
                        type="number"
                        value={cashReceived}
                        onChange={e => setCashReceived(e.target.value)}
                        placeholder="0"
                        className="w-full h-11 pl-10 pr-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-all"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {quickAmounts(calculateTotal()).map(amt => (
                        <button
                          key={amt}
                          onClick={() => setCashReceived(String(amt))}
                          className="px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-brand/30 hover:text-brand transition-all"
                        >
                          {formatCurrency(amt)}
                        </button>
                      ))}
                    </div>
                    {parseFloat(cashReceived) > 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                        <span className="text-sm text-emerald-500">Change</span>
                        <span className="text-lg font-bold text-emerald-500">{formatCurrency(calculateChange())}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Discount */}
                <div className="p-5 border-b border-[var(--border)]">
                  <label className="label mb-3 block">Discount</label>
                  <div className="flex gap-3 mb-3">
                    <div className="flex-1 relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input
                        type="number"
                        value={discount || ''}
                        onChange={e => setDiscount(Number(e.target.value))}
                        placeholder="0"
                        className="w-full h-11 pl-10 pr-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-all"
                      />
                    </div>
                    <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
                      <button
                        onClick={() => setDiscountType('percent')}
                        className={cn(
                          "px-4 h-11 text-xs font-medium transition-colors",
                          discountType === 'percent' ? "bg-brand text-[var(--text-primary)]" : "bg-[var(--surface)] text-[var(--text-muted)]"
                        )}
                      >
                        %
                      </button>
                      <button
                        onClick={() => setDiscountType('fixed')}
                        className={cn(
                          "px-4 h-11 text-xs font-medium transition-colors",
                          discountType === 'fixed' ? "bg-brand text-[var(--text-primary)]" : "bg-[var(--surface)] text-[var(--text-muted)]"
                        )}
                      >
                        Fixed
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action */}
                <div className="p-5">
                  <button
                    onClick={handleProcessPayment}
                    disabled={isProcessing || (paymentMethod === 'cash' && parseFloat(cashReceived) < calculateTotal())}
                    className="w-full h-12 bg-brand hover:bg-brand-hover text-[var(--text-primary)] font-semibold rounded-lg transition-all shadow-glow hover:shadow-glow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <><Check className="w-5 h-5" /> Complete Payment</>
                    )}
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] border-dashed">
                <Receipt className="w-12 h-12 text-[var(--text-muted)] mb-4" />
                <p className="text-sm font-medium text-[var(--text-primary)]">Select an order to process payment</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Choose from the unpaid orders list</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
