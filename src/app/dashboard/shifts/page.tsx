'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Clock,
  Users,
  Calendar,
  Play,
  Square,
  Coffee,
  ChefHat,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  DollarSign,
  Plus,
  Edit2,
  Trash2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Modal } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface Shift {
  id: string
  staff_id: string
  staff_name?: string
  role: string
  start_time: string
  end_time: string | null
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  tips_earned: number | null
  orders_served: number | null
  date: string // shift_date in DB
}

interface Staff {
  id: string
  name: string
  role: string
}

function isShiftAssignableStaff(member: Staff) {
  return member.role !== 'owner'
}

const statusConfig = {
  scheduled: { label: 'Scheduled', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  active: { label: 'Active', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  completed: { label: 'Completed', color: 'text-[var(--text-muted)]', bg: 'bg-[var(--surface-hover)]0/10' },
  cancelled: { label: 'Cancelled', color: 'text-rose-500', bg: 'bg-rose-500/10' },
}

const roleConfig: Record<string, { color: string; bg: string; icon: any }> = {
  waiter: { color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Coffee },
  kitchen: { color: 'text-rose-500', bg: 'bg-rose-500/10', icon: ChefHat },
  cashier: { color: 'text-brand', bg: 'bg-brand-subtle', icon: DollarSign },
  delivery: { color: 'text-brand', bg: 'bg-brand-subtle', icon: Users },
  manager: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: Clock },
}

export default function ShiftsPage() {
  const { restaurant, staff: currentStaff } = useAuthStore()
  const { success, error: showError } = useToast()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all'>('today')
  const [statusFilter, setStatusFilter] = useState<Shift['status'] | 'all'>('all')

  const loadData = useCallback(async () => {
    if (!restaurant?.id) return
    setIsLoading(true)

    try {
      const supabase = createClient()

      // Get date range for filter
      const today = new Date().toISOString().split('T')[0]
      let startDate = today
      let endDate = today

      if (dateFilter === 'week') {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        startDate = weekAgo.toISOString().split('T')[0]
      }

      // Fetch shifts
      let query = supabase
        .from('shifts')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('shift_date', { ascending: false })
        .order('start_time', { ascending: false })

      if (dateFilter === 'today') {
        query = query.eq('shift_date', today)
      }

      const { data: shiftsData, error: shiftsError } = await query

      if (shiftsError) throw shiftsError

      // Fetch staff for names
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name, role')
        .eq('restaurant_id', restaurant.id)

      if (staffData) {
        setStaff(staffData.filter(isShiftAssignableStaff))
      }

      // Map staff names to shifts
      const staffMap = new Map<string, any>(staffData?.map((s: any) => [s.id, s]) || [])
      const mappedShifts = (shiftsData || []).map((shift: any) => ({
        ...shift,
        staff_name: staffMap.get(shift.staff_id)?.name || 'Unknown',
        role: staffMap.get(shift.staff_id)?.role || shift.role
      }))

      setShifts(mappedShifts)
    } catch (err) {
      console.error('Error loading shifts:', err)
      showError('Error', 'Failed to load shifts')
    } finally {
      setIsLoading(false)
    }
  }, [restaurant?.id, dateFilter, showError])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredShifts = shifts.filter(shift => {
    if (statusFilter !== 'all' && shift.status !== statusFilter) return false
    return true
  })

  const stats = {
    total: shifts.length,
    active: shifts.filter(s => s.status === 'active').length,
    scheduled: shifts.filter(s => s.status === 'scheduled').length,
    completed: shifts.filter(s => s.status === 'completed').length,
  }

  const handleStatusChange = async (shiftId: string, newStatus: Shift['status']) => {
    try {
      const supabase = createClient()
      const updates: any = { status: newStatus }

      if (newStatus === 'completed') {
        updates.end_time = new Date().toISOString()
      }

      const { error } = await supabase
        .from('shifts')
        .update(updates)
        .eq('id', shiftId)

      if (error) throw error
      setShifts(shifts.map(s => s.id === shiftId ? { ...s, ...updates } : s))
      success('Updated', `Shift marked as ${newStatus}`)
    } catch (err) {
      showError('Error', 'Failed to update shift')
    }
  }

  const handleDelete = async (shiftId: string) => {
    if (!confirm('Delete this shift?')) return

    try {
      const supabase = createClient()
      const { error } = await supabase.from('shifts').delete().eq('id', shiftId)
      if (error) throw error
      setShifts(shifts.filter(s => s.id !== shiftId))
      success('Deleted', 'Shift removed')
    } catch (err) {
      showError('Error', 'Failed to delete shift')
    }
  }

  const handleStartShift = async (shiftId: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('shifts')
        .update({ status: 'active', start_time: new Date().toISOString() })
        .eq('id', shiftId)

      if (error) throw error
      setShifts(shifts.map(s => s.id === shiftId ? { ...s, status: 'active', start_time: new Date().toISOString() } : s))
      success('Shift Started', 'Staff is now on duty')
    } catch (err) {
      showError('Error', 'Failed to start shift')
    }
  }

  const handleEndShift = async (shiftId: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('shifts')
        .update({ status: 'completed', end_time: new Date().toISOString() })
        .eq('id', shiftId)

      if (error) throw error
      setShifts(shifts.map(s => s.id === shiftId ? { ...s, status: 'completed', end_time: new Date().toISOString() } : s))
      success('Shift Ended', 'Staff shift completed')
    } catch (err) {
      showError('Error', 'Failed to end shift')
    }
  }

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } } }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-3">
          <Badge variant="outline" className="bg-blue-600/10 text-blue-500 border-blue-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
            Staff Scheduling
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Shift <span className="text-blue-500">Management</span>
          </h1>
          <p className="text-[var(--text-muted)] text-lg font-medium">
            <span className="text-[var(--text-primary)] font-bold">{stats.active} active</span> shifts today
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={loadData}
            variant="outline"
            icon={RefreshCw}
            isLoading={isLoading}
            className="h-12 px-6 border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Refresh
          </Button>
          <Button
            onClick={() => { setEditingShift(null); setShowModal(true); }}
            icon={Plus}
            className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-[var(--text-primary)]"
          >
            Schedule Shift
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Shifts', value: stats.total, icon: Clock, color: 'text-[var(--text-primary)]' },
          { label: 'Active', value: stats.active, icon: Play, color: 'text-emerald-500' },
          { label: 'Scheduled', value: stats.scheduled, icon: Calendar, color: 'text-blue-500' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-[var(--text-muted)]' },
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
        <div className="flex gap-2">
          {(['today', 'week', 'all'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={cn(
                'h-10 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all',
                dateFilter === filter ? 'bg-blue-600 text-[var(--text-primary)]' : 'bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-muted)]'
              )}
            >
              {filter === 'today' ? 'Today' : filter === 'week' ? 'This Week' : 'All'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'scheduled', 'completed'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={cn(
                'h-10 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all',
                statusFilter === filter ? 'bg-emerald-600 text-[var(--text-primary)]' : 'bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-muted)]'
              )}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Shifts List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filteredShifts.length === 0 ? (
        <Card className="p-20 bg-[var(--surface-raised)]/50 border-[var(--border)] text-center rounded-2xl border-dashed">
          <Calendar className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Shifts Found</h3>
          <p className="text-[var(--text-muted)] mb-6">Schedule your first shift to get started</p>
          <Button
            onClick={() => { setEditingShift(null); setShowModal(true); }}
            icon={Plus}
            className="bg-blue-600 hover:bg-blue-500"
          >
            Schedule Shift
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredShifts.map((shift) => {
            const cfg = statusConfig[shift.status]
            const roleInfo = roleConfig[shift.role] || { color: 'text-[var(--text-muted)]', bg: 'bg-[var(--surface-hover)]0/10', icon: Clock }

            return (
              <motion.div key={shift.id} variants={item}>
                <Card className="p-6 bg-[var(--surface-raised)] border-[var(--border)] hover:border-blue-500/30 transition-all">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center", roleInfo.bg)}>
                        <roleInfo.icon className={cn("w-6 h-6", roleInfo.color)} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">{shift.staff_name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(shift.date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {shift.start_time ? new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            {shift.end_time ? ` - ${new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={cn("font-bold text-[10px] px-4 py-2 uppercase", cfg.bg, cfg.color)}>
                        {cfg.label}
                      </Badge>
                      {shift.status === 'scheduled' && (
                        <Button
                          onClick={() => handleStartShift(shift.id)}
                          className="h-10 px-6 bg-emerald-600 hover:bg-emerald-500 text-[var(--text-primary)] font-bold text-[10px] uppercase"
                          icon={Play}
                        >
                          Start
                        </Button>
                      )}
                      {shift.status === 'active' && (
                        <Button
                          onClick={() => handleEndShift(shift.id)}
                          className="h-10 px-6 bg-rose-600 hover:bg-rose-500 text-[var(--text-primary)] font-bold text-[10px] uppercase"
                          icon={Square}
                        >
                          End
                        </Button>
                      )}
                      <button
                        onClick={() => handleDelete(shift.id)}
                        className="w-10 h-10 rounded-xl bg-[var(--surface-active)] flex items-center justify-center text-[var(--text-muted)] hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Schedule Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingShift(null); }}
        title="Schedule Shift"
        size="md"
      >
        <ShiftForm
          shift={editingShift}
          staff={staff}
          restaurantId={restaurant?.id || ''}
          onSuccess={() => { setShowModal(false); setEditingShift(null); loadData(); }}
          onCancel={() => { setShowModal(false); setEditingShift(null); }}
        />
      </Modal>
    </motion.div>
  )
}

function ShiftForm({ shift, staff, restaurantId, onSuccess, onCancel }: {
  shift: Shift | null
  staff: Staff[]
  restaurantId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const { success, error: showError } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const assignableStaff = staff.filter(isShiftAssignableStaff)
  const [form, setForm] = useState({
    staffId: shift && assignableStaff.some(s => s.id === shift.staff_id) ? shift.staff_id : '',
    date: shift?.date || new Date().toISOString().split('T')[0],
    startTime: shift?.start_time ? String(shift.start_time).substring(0, 5) : '09:00',
    endTime: shift?.end_time ? String(shift.end_time).substring(0, 5) : '17:00',
  })

  const handleSubmit = async () => {
    if (!form.staffId || !form.date) {
      showError('Error', 'Please fill in all required fields')
      return
    }

    setIsLoading(true)
    try {
      const supabase = createClient()
      const payload = {
        restaurant_id: restaurantId,
        staff_id: form.staffId,
        shift_date: form.date,
        start_time: form.startTime,
        end_time: form.endTime || null,
        status: 'scheduled' as const,
      }

      if (shift) {
        const { error } = await supabase.from('shifts').update(payload).eq('id', shift.id)
        if (error) throw error
        success('Updated', 'Shift updated successfully')
      } else {
        const { error } = await supabase.from('shifts').insert(payload)
        if (error) throw error
        success('Created', 'Shift scheduled successfully')
      }
      onSuccess()
    } catch (err) {
      console.error('Shift error:', err)
      showError('Error', 'Failed to save shift')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">Staff Member</label>
        <select
          value={form.staffId}
          onChange={(e) => setForm({ ...form, staffId: e.target.value })}
          className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-[var(--text-primary)]"
        >
          <option value="">Select staff...</option>
          {assignableStaff.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">Date</label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-[var(--text-primary)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">Start Time</label>
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 block">End Time</label>
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-[var(--text-primary)]"
          />
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-12 border-[var(--border-strong)] text-[var(--text-muted)]">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={!form.staffId || !form.date}
          className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-[var(--text-primary)]"
        >
          {shift ? 'Update' : 'Schedule'}
        </Button>
      </div>
    </div>
  )
}
