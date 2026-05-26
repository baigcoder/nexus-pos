'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  Clock,
  TrendingUp,
  User
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { Card, Badge, Button } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import type { Order } from '@/types'
import { useToast } from '@/components/ui/toast'

type CashierStats = {
  totalSales: number
  transactions: number
  cashPayments: number
  cardPayments: number
  mobilePayments: number
  avgTransaction: number
}

export default function CashierDashboard() {
  const { restaurant, staff } = useAuthStore()
  const { success, error: showError } = useToast()
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [dailyStats, setDailyStats] = useState<CashierStats>({
    totalSales: 0,
    transactions: 0,
    cashPayments: 0,
    cardPayments: 0,
    mobilePayments: 0,
    avgTransaction: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    async function loadCashierData() {
      if (!restaurant?.id) return

      setIsLoading(true)
      const supabase = createClient()
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const [ordersResult, paymentsResult] = await Promise.all([
        supabase
          .from('orders')
          .select('*, table:tables(id, table_number), items:order_items(*, menu_item:menu_items(name))')
          .eq('restaurant_id', restaurant.id)
          .in('status', ['served', 'billing', 'ready'])
          .order('created_at', { ascending: true }),
        supabase
          .from('payments')
          .select('amount, method, status, created_at, order:orders!inner(restaurant_id)')
          .eq('order.restaurant_id', restaurant.id)
          .eq('status', 'completed')
          .gte('created_at', startOfDay.toISOString()),
      ])

      if (ordersResult.error) showError('Cashier Error', ordersResult.error.message)
      if (paymentsResult.error) showError('Payment Stats Error', paymentsResult.error.message)

      const payments = (paymentsResult.data || []) as { amount: number | string | null; method: string | null }[]
      const totalSales = payments.reduce((sum: number, payment) => sum + Number(payment.amount || 0), 0)

      setPendingOrders((ordersResult.data || []) as Order[])
      setDailyStats({
        totalSales,
        transactions: payments.length,
        cashPayments: payments.filter(payment => payment.method === 'cash').length,
        cardPayments: payments.filter(payment => payment.method === 'card').length,
        mobilePayments: payments.filter(payment => payment.method === 'mobile').length,
        avgTransaction: payments.length > 0 ? Math.round(totalSales / payments.length) : 0,
      })
      setIsLoading(false)
    }

    loadCashierData()
  }, [restaurant?.id, showError])

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
  }

  const handleProcessPayment = async (method: 'cash' | 'card' | 'mobile') => {
    if (!selectedOrder) return
    const supabase = createClient()

    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: selectedOrder.id,
        amount: selectedOrder.total,
        method,
        status: 'completed',
      })

    if (paymentError) {
      showError('Payment Failed', paymentError.message)
      return
    }

    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', selectedOrder.id)

    if (orderError) {
      showError('Order Update Failed', orderError.message)
      return
    }

    if (selectedOrder.table_id) {
      await supabase
        .from('tables')
        .update({ status: 'available' })
        .eq('id', selectedOrder.table_id)
    }

    setPendingOrders(prev => prev.filter(order => order.id !== selectedOrder.id))
    setDailyStats(prev => {
      const totalSales = prev.totalSales + Number(selectedOrder.total || 0)
      const transactions = prev.transactions + 1
      return {
        ...prev,
        totalSales,
        transactions,
        cashPayments: prev.cashPayments + (method === 'cash' ? 1 : 0),
        cardPayments: prev.cardPayments + (method === 'card' ? 1 : 0),
        mobilePayments: prev.mobilePayments + (method === 'mobile' ? 1 : 0),
        avgTransaction: Math.round(totalSales / transactions),
      }
    })
    success('Payment Complete', `Order #${selectedOrder.order_number} marked as paid`)
    setSelectedOrder(null)
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-10 pb-24"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-brand-subtle text-brand border-brand/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
              ● Cashier Station
            </Badge>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{currentTime}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Checkout <span className="text-brand">& Billing</span>
          </h1>
          <p className="text-[var(--text-muted)] text-lg font-medium">
            Welcome, <span className="text-[var(--text-primary)] font-bold">{staff?.name || 'Cashier'}</span>
          </p>
        </div>
      </div>

      {/* Daily Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales', value: `Rs.${(dailyStats.totalSales / 1000).toFixed(1)}k`, icon: DollarSign, color: 'text-emerald-500' },
          { label: 'Transactions', value: dailyStats.transactions.toString(), icon: Receipt, color: 'text-brand' },
          { label: 'Avg. Bill', value: `Rs.${dailyStats.avgTransaction}`, icon: TrendingUp, color: 'text-blue-500' },
          { label: 'Completed', value: dailyStats.transactions.toString(), icon: CheckCircle2, color: 'text-brand' },
        ].map((stat, idx) => (
          <motion.div key={idx} variants={item}>
            <Card className="p-5 bg-[var(--surface-raised)] border-[var(--border)] relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">{stat.label}</p>
                  <h3 className={cn("text-2xl font-bold tracking-tight", stat.color)}>{stat.value}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-brand group-hover:border-brand transition-all">
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Payment Methods Summary */}
      <motion.div variants={item}>
        <Card className="p-6 bg-[var(--surface-raised)] border-[var(--border)] ">
          <h2 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-tight mb-6">Payment <span className="text-brand">Breakdown</span></h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { method: 'Cash', count: dailyStats.cashPayments, icon: Banknote, color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
              { method: 'Card', count: dailyStats.cardPayments, icon: CreditCard, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
              { method: 'Mobile', count: dailyStats.mobilePayments, icon: Smartphone, color: 'bg-brand-subtle text-brand border-brand/20' },
            ].map((pm, idx) => (
              <div key={idx} className={cn("p-5 rounded-xl border text-center", pm.color)}>
                <pm.icon className="w-8 h-8 mx-auto mb-3" />
                <p className="text-2xl font-bold">{pm.count}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">{pm.method} Payments</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Pending Checkout Queue */}
      <motion.div variants={item}>
        <Card className="p-6 bg-[var(--surface-raised)] border-[var(--border)] ">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-tight">Checkout <span className="text-brand">Queue</span></h2>
              <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Orders ready for payment</p>
            </div>
            <Badge className="bg-brand-subtle text-brand border-none font-bold">{pendingOrders.length} Pending</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={cn(
                  "p-5 bg-[var(--surface)] border-2 rounded-xl cursor-pointer transition-all hover:border-brand",
                  selectedOrder?.id === order.id ? 'border-purple-500 shadow-purple-500/10' : 'border-[var(--border)]'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center font-bold text-brand">
                      {order.table?.table_number || '-'}
                    </div>
                    <div>
                      <span className="font-bold text-[var(--text-primary)]">Order #{order.order_number}</span>
                      <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
                        {order.items?.length || 0} items
                      </p>
                    </div>
                  </div>
                  <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[var(--surface-raised)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Total</span>
                  <span className="text-xl font-bold text-[var(--text-primary)]">Rs.{Number(order.total || 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Payment Buttons */}
          {selectedOrder && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-6 bg-[var(--surface)] border border-purple-500/30 rounded-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="font-bold text-[var(--text-primary)]">Process Payment for Order #{selectedOrder.order_number}</span>
                  <p className="text-brand font-bold text-2xl mt-1">Rs.{Number(selectedOrder.total || 0).toLocaleString()}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={() => handleProcessPayment('cash')}
                  className="h-14 bg-emerald-600 hover:bg-emerald-500 text-[var(--text-primary)] font-bold text-xs uppercase tracking-widest"
                  icon={Banknote}
                >
                  Cash
                </Button>
                <Button
                  onClick={() => handleProcessPayment('card')}
                  className="h-14 bg-blue-600 hover:bg-blue-500 text-[var(--text-primary)] font-bold text-xs uppercase tracking-widest"
                  icon={CreditCard}
                >
                  Card
                </Button>
                <Button
                  onClick={() => handleProcessPayment('mobile')}
                  className="h-14 bg-brand hover:bg-brand-hover text-[var(--text-primary)] font-bold text-xs uppercase tracking-widest"
                  icon={Smartphone}
                >
                  Mobile
                </Button>
              </div>
            </motion.div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  )
}
