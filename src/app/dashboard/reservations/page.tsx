'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  Plus,
  Search,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Loader2,
  RefreshCw,
  X,
  AlertCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Modal, Input } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface Reservation {
  id: string
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  party_size: number
  reservation_date: string
  reservation_time: string
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show'
  table_number?: string
  special_requests: string | null
}

const statusConfig = {
  pending: { label: 'Pending', color: 'text-brand', bg: 'bg-brand-subtle' },
  confirmed: { label: 'Confirmed', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  seated: { label: 'Seated', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  completed: { label: 'Completed', color: 'text-[var(--text-muted)]', bg: 'bg-[var(--surface-hover)]0/10' },
  cancelled: { label: 'Cancelled', color: 'text-rose-500', bg: 'bg-rose-500/10' },
  no_show: { label: 'No Show', color: 'text-rose-500', bg: 'bg-rose-500/10' },
}

export default function ReservationsPage() {
  const { restaurant } = useAuthStore()
  const { success, error: showError } = useToast()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'today' | 'upcoming' | 'all'>('today')
  const [searchQuery, setSearchQuery] = useState('')

  const today = new Date().toISOString().split('T')[0]

  // Fetch from Supabase
  const loadReservations = useCallback(async () => {
    if (!restaurant?.id) return
    setIsLoading(true)
    try {
      const supabase = createClient()
      let query = supabase
        .from('reservations')
        .select('*, table:tables(table_number)')
        .eq('restaurant_id', restaurant.id)
        .order('reservation_date')
        .order('reservation_time')

      const { data, error } = await query

      if (error) throw error
      setReservations((data || []).map((r: any) => ({
        ...r,
        table_number: r.table?.table_number
      })))
    } catch (err) {
      showError('Error', 'Failed to load reservations')
    } finally {
      setIsLoading(false)
    }
  }, [restaurant?.id, showError])

  useEffect(() => {
    loadReservations()
  }, [loadReservations])

  const filteredReservations = reservations.filter(r => {
    // Filter by date
    if (filter === 'today' && r.reservation_date !== today) return false
    if (filter === 'upcoming' && r.reservation_date < today) return false

    // Filter by search
    if (searchQuery) {
      const search = searchQuery.toLowerCase()
      const matchesName = r.customer_name.toLowerCase().includes(search)
      const matchesPhone = (r.customer_phone || '').toLowerCase().includes(search)
      if (!matchesName && !matchesPhone) return false
    }

    return true
  })

  const handleStatusChange = async (id: string, newStatus: Reservation['status']) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('reservations')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error
      setReservations(reservations.map(r => r.id === id ? { ...r, status: newStatus } : r))
      success('Status Updated', `Reservation marked as ${newStatus}`)
    } catch (err) {
      showError('Error', 'Failed to update status')
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
            <Badge variant="outline" className="bg-brand-subtle text-brand border-brand/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
              ● Bookings
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Table <span className="text-brand">Reservations</span>
          </h1>
          <p className="text-[var(--text-muted)] text-lg font-medium">
            <span className="text-[var(--text-primary)] font-bold">{filteredReservations.length} reservations</span> for today
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} icon={Plus} className="h-14 px-10 bg-purple-600 hover:bg-purple-500 text-[var(--text-primary)] font-bold uppercase tracking-widest text-xs">
          New Reservation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Today', value: filteredReservations.length, icon: CalendarDays, color: 'text-brand' },
          { label: 'Confirmed', value: reservations.filter(r => r.status === 'confirmed').length, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Total Guests', value: filteredReservations.reduce((s, r) => s + r.party_size, 0), icon: Users, color: 'text-blue-500' },
          { label: 'Pending', value: reservations.filter(r => r.status === 'pending').length, icon: Clock, color: 'text-brand' },
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full h-12 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl pl-12 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-purple-500 outline-none"
          />
        </div>
        <div className="flex gap-2">
          {(['today', 'upcoming', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'h-12 px-6 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all',
                filter === f ? 'bg-purple-600 text-[var(--text-primary)] border-purple-600' : 'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-strong)]'
              )}
            >
              {f === 'today' ? "Today's" : f === 'upcoming' ? 'Upcoming' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Reservations List */}
      <div className="space-y-4">
        {filteredReservations.map((res) => (
          <motion.div key={res.id} variants={item}>
            <Card className="p-6 bg-[var(--surface-raised)] border-[var(--border)] hover:border-brand/30 transition-all">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-purple-600/20 text-brand flex items-center justify-center font-bold text-xl">
                    {res.party_size}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">{res.customer_name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-[var(--text-muted)] text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {res.reservation_time}
                      </span>
                      {res.table_number && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Table {res.table_number}
                        </span>
                      )}
                      {res.customer_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {res.customer_phone}
                        </span>
                      )}
                    </div>
                    {res.special_requests && (
                      <p className="text-[10px] text-brand font-bold mt-2 uppercase tracking-widest">
                        Note: {res.special_requests}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={cn("font-bold text-[10px] px-4 py-2 uppercase", statusConfig[res.status].bg, statusConfig[res.status].color)}>
                    {statusConfig[res.status].label}
                  </Badge>
                  {res.status === 'confirmed' && (
                    <Button onClick={() => handleStatusChange(res.id, 'seated')} className="h-10 px-6 bg-emerald-600 hover:bg-emerald-500 text-[var(--text-primary)] font-bold text-[10px] uppercase">
                      Seat Guest
                    </Button>
                  )}
                  {res.status === 'pending' && (
                    <Button onClick={() => handleStatusChange(res.id, 'confirmed')} className="h-10 px-6 bg-blue-600 hover:bg-blue-500 text-[var(--text-primary)] font-bold text-[10px] uppercase">
                      Confirm
                    </Button>
                  )}
                  <Button onClick={() => handleStatusChange(res.id, 'cancelled')} variant="ghost" className="h-10 px-3 text-[var(--text-muted)] hover:text-rose-500">
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {!isLoading && filteredReservations.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20 border-2 border-dashed border-[var(--border)] rounded-2xl"
        >
          <CalendarDays className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Reservations</h3>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            {filter === 'today'
              ? "No reservations for today"
              : filter === 'upcoming'
                ? "No upcoming reservations"
                : "Add your first reservation to get started"
            }
          </p>
          <Button onClick={() => setShowModal(true)} icon={Plus} className="bg-purple-600 hover:bg-purple-500">
            Add Reservation
          </Button>
        </motion.div>
      )}

      {/* Reservation Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Reservation" size="md">
        <ReservationForm
          restaurantId={restaurant?.id || ''}
          tables={[]}
          onSuccess={() => { setShowModal(false); loadReservations(); }}
          onCancel={() => setShowModal(false)}
        />
      </Modal>
    </motion.div>
  )
}

function ReservationForm({ restaurantId, tables, onSuccess, onCancel }: { restaurantId: string; tables: any[]; onSuccess: () => void; onCancel: () => void }) {
  const { success, error: showError } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    date: new Date().toISOString().split('T')[0],
    time: '19:00',
    partySize: 2,
    notes: '',
  })

  const handleSubmit = async () => {
    if (!form.name || !form.date || !form.time) {
      showError('Error', 'Please fill in required fields')
      return
    }

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('reservations').insert({
        restaurant_id: restaurantId,
        customer_name: form.name,
        customer_phone: form.phone || null,
        customer_email: form.email || null,
        party_size: form.partySize,
        reservation_date: form.date,
        reservation_time: form.time,
        status: 'pending',
        special_requests: form.notes || null,
      })

      if (error) throw error
      success('Created', 'Reservation added successfully')
      onSuccess()
    } catch (err) {
      console.error('Reservation error:', err)
      showError('Error', 'Failed to save reservation')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">Guest Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="John Doe"
            className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">Party Size</label>
          <select
            value={form.partySize}
            onChange={(e) => setForm({ ...form, partySize: parseInt(e.target.value) })}
            className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-[var(--text-primary)]"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+92 300 1234567"
            className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="guest@email.com"
            className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-[var(--text-primary)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">Date *</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">Time *</label>
          <input
            type="time"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
            className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-[var(--text-primary)]"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">Special Requests</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Birthday, dietary restrictions, etc."
          rows={3}
          className="w-full bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 py-3 text-[var(--text-primary)] resize-none"
        />
      </div>

      <div className="flex gap-4 pt-4">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-12 border-[var(--border-strong)] text-[var(--text-muted)]">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={!form.name || !form.date || !form.time}
          className="flex-1 h-12 bg-purple-600 hover:bg-purple-500 text-[var(--text-primary)]"
        >
          Create Reservation
        </Button>
      </div>
    </div>
  )
}
