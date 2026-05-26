'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Edit2, Trash2, User, Shield, ChefHat, Utensils, Mail, Lock,
  Check, UserPlus, Phone, Calendar, Clock, AlertCircle, Send, RefreshCw,
  X, Building2, UserCheck, MessageSquare, ChevronLeft, ChevronRight,
  Download, Filter, Archive, ArchiveRestore, Eye, Square, CheckSquare,
  RotateCcw, StickyNote, Briefcase, Moon, Sun, Sunset, Timer, LogIn,
  MoreHorizontal, FileDown
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore, useIsOwner } from '@/stores'
import { Button, Badge, Input, Modal } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import { exportStaffToCSV } from '@/lib/csv-export'
import { withStaffAuthHeaders } from '@/lib/staff-api'

type StaffRole = 'owner' | 'manager' | 'waiter' | 'kitchen' | 'cashier' | 'delivery' | 'rider'
type StaffShift = 'morning' | 'evening' | 'night' | 'full_time' | 'part_time'
type TabFilter = 'active' | 'archived' | 'all'
type SortKey = 'name' | 'role' | 'invited_at' | 'last_login_at' | 'hire_date'

interface StaffMember {
  id: string
  user_id: string | null
  name: string
  email: string | null
  phone: string | null
  role: StaffRole
  pin: string | null
  is_active: boolean
  is_archived: boolean
  needs_setup: boolean
  invited_at: string | null
  setup_completed_at: string | null
  last_login_at: string | null
  shift: StaffShift | null
  emergency_contact: string | null
  hire_date: string | null
  admin_notes: string | null
  avatar_url: string | null
  created_at: string
}

interface RestaurantInfo {
  id: string
  name: string
  owner_id: string
  owner_name?: string
  manager_name?: string
}

const roleConfig: Record<StaffRole, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  owner:  { label: 'Owner',  color: 'text-brand', bgColor: 'bg-brand-subtle', icon: <Shield className="w-3 h-3" /> },
  manager: { label: 'Manager', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', icon: <Shield className="w-3 h-3" /> },
  waiter: { label: 'Waiter',  color: 'text-blue-500',  bgColor: 'bg-blue-500/10',  icon: <Utensils className="w-3 h-3" /> },
  kitchen: { label: 'Kitchen', color: 'text-rose-500',  bgColor: 'bg-rose-500/10',  icon: <ChefHat className="w-3 h-3" /> },
  cashier: { label: 'Cashier', color: 'text-brand', bgColor: 'bg-brand-subtle', icon: <Lock className="w-3 h-3" /> },
  delivery:{ label: 'Delivery', color: 'text-brand',  bgColor: 'bg-brand-subtle',  icon: <User className="w-3 h-3" /> },
  rider:  { label: 'Rider',  color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', icon: <User className="w-3 h-3" /> },
}

const shiftConfig: Record<StaffShift, { label: string; icon: React.ReactNode }> = {
  morning:  { label: 'Morning',  icon: <Sun className="w-3 h-3" /> },
  evening:  { label: 'Evening',  icon: <Sunset className="w-3 h-3" /> },
  night:   { label: 'Night',   icon: <Moon className="w-3 h-3" /> },
  full_time: { label: 'Full Time', icon: <Briefcase className="w-3 h-3" /> },
  part_time: { label: 'Part Time', icon: <Timer className="w-3 h-3" /> },
}

const ROLE_COLORS: Record<StaffRole, string> = {
  owner: '#f97316',
  manager: '#10b981',
  waiter: '#3b82f6',
  kitchen: '#f43f5e',
  cashier: '#a855f7',
  delivery: '#06b6d4',
  rider: '#eab308',
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString()
}

function validatePhone(phone: string): boolean {
  if (!phone) return true
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '')
  return /^[0-9]{7,15}$/.test(cleaned)
}

const PAGE_SIZES = [12, 24, 48]

export default function StaffPage() {
  const { restaurant } = useAuthStore()
  const isOwner = useIsOwner()
  const { success, error: showError } = useToast()

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all')
  const [tabFilter, setTabFilter] = useState<TabFilter>('active')
  const [sortKey, setSortKey] = useState<SortKey>('invited_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [detailStaff, setDetailStaff] = useState<StaffMember | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const loadStaff = useCallback(async () => {
    if (!restaurant?.id) return
    setIsLoading(true)
    try {
      const response = await fetch(`/api/staff?restaurantId=${restaurant.id}`, {
        headers: withStaffAuthHeaders(),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load staff')
      }

      const data = result.staff || []
      setStaff(data)
      setSelectedIds(new Set())

      const restData = result.restaurant

      const owner = data?.find((s: StaffMember) => s.role === 'owner')
      const manager = data?.find((s: StaffMember) => s.role === 'manager')

      setRestaurantInfo({
        id: restaurant.id,
        name: restData?.name || restaurant.name,
        owner_id: restData?.owner_id || '',
        owner_name: owner?.name || 'Owner',
        manager_name: manager?.name || undefined,
      })
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Failed to load staff')
    } finally {
      setIsLoading(false)
    }
  }, [restaurant?.id, showError])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  const filteredStaff = useMemo(() => {
    let result = staff.filter((member) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        q === '' ||
        member.name.toLowerCase().includes(q) ||
        (member.email || '').toLowerCase().includes(q) ||
        (member.phone || '').includes(q)
      const matchesRole = roleFilter === 'all' || member.role === roleFilter
      const matchesTab =
        tabFilter === 'all'
          ? true
          : tabFilter === 'active'
            ? !member.is_archived
            : member.is_archived
      return matchesSearch && matchesRole && matchesTab
    })

    result.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      if (sortKey === 'role') return a.role.localeCompare(b.role) * dir
      const aVal = a[sortKey] || '1970-01-01'
      const bVal = b[sortKey] || '1970-01-01'
      return aVal.localeCompare(bVal) * dir
    })

    return result
  }, [staff, searchQuery, roleFilter, tabFilter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / pageSize))
  const paginatedStaff = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredStaff.slice(start, start + pageSize)
  }, [filteredStaff, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, roleFilter, tabFilter, pageSize])

  const stats = useMemo(() => {
    const active = staff.filter((s) => !s.is_archived)
    return {
      total: active.length,
      archived: staff.filter((s) => s.is_archived).length,
      activeNow: active.filter((s) => s.is_active).length,
      inactive: active.filter((s) => !s.is_active).length,
      pendingSetup: active.filter((s) => s.needs_setup).length,
      roleData: (Object.keys(roleConfig) as StaffRole[])
        .map((role) => ({
          name: roleConfig[role].label,
          value: active.filter((s) => s.role === role).length,
          color: ROLE_COLORS[role],
        }))
        .filter((d) => d.value > 0),
    }
  }, [staff])

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const pageIds = paginatedStaff.map((s) => s.id)
    const allSelected = pageIds.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      pageIds.forEach((id) => {
        if (allSelected) next.delete(id)
        else next.add(id)
      })
      return next
    })
  }

  const handleBulkAction = async (action: 'archive' | 'restore' | 'activate' | 'deactivate' | 'delete') => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (action === 'delete' && !confirm(`Permanently delete ${ids.length} staff member(s)? This cannot be undone.`)) return

    try {
      const supabase = createClient()
      let updateData: Record<string, unknown> = {}
      if (action === 'archive') updateData = { is_archived: true }
      else if (action === 'restore') updateData = { is_archived: false }
      else if (action === 'activate') updateData = { is_active: true }
      else if (action === 'deactivate') updateData = { is_active: false }

      if (action === 'delete') {
        const { error } = await supabase.from('staff').delete().in('id', ids)
        if (error) throw error
      } else {
        const { error } = await supabase.from('staff').update(updateData).in('id', ids)
        if (error) throw error
      }

      setSelectedIds(new Set())
      loadStaff()
      success('Bulk Action', `${ids.length} staff member(s) updated.`)
    } catch (err) {
      showError('Error', 'Bulk action failed')
    }
  }

  const handleToggleActive = async (id: string) => {
    const member = staff.find((s) => s.id === id)
    if (!member) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('staff').update({ is_active: !member.is_active }).eq('id', id)
      if (error) throw error
      setStaff(staff.map((s) => (s.id === id ? { ...s, is_active: !s.is_active } : s)))
      success(member.is_active ? 'Staff Disabled' : 'Staff Enabled', `Status updated for ${member.name}.`)
    } catch (err) {
      showError('Error', 'Failed to update status')
    }
  }

  const handleArchive = async (id: string) => {
    const member = staff.find((s) => s.id === id)
    if (!member) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('staff').update({ is_archived: !member.is_archived }).eq('id', id)
      if (error) throw error
      setStaff(staff.map((s) => (s.id === id ? { ...s, is_archived: !s.is_archived } : s)))
      success(member.is_archived ? 'Staff Restored' : 'Staff Archived', `${member.name} ${member.is_archived ? 'restored' : 'archived'}.`)
    } catch (err) {
      showError('Error', 'Failed to archive staff')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this staff record? This cannot be undone.')) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('staff').delete().eq('id', id)
      if (error) throw error
      setStaff(staff.filter((s) => s.id !== id))
      success('Staff Deleted', 'Staff member has been removed.')
    } catch (err) {
      showError('Error', 'Failed to delete staff')
    }
  }

  const handleResendInvite = async (id: string) => {
    try {
      const response = await fetch('/api/staff/resend-invite', {
        method: 'POST',
        headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ staffId: id, restaurantId: restaurant?.id }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to resend invite')
      success('Invite Resent', result.message)
    } catch (err: any) {
      showError('Error', err.message || 'Failed to resend invite')
    }
  }

  const handleExport = () => {
    const rows = filteredStaff.map((s) => ({
      name: s.name,
      email: s.email || '',
      phone: s.phone || '',
      role: roleConfig[s.role]?.label || s.role,
      shift: s.shift ? shiftConfig[s.shift]?.label || s.shift : '',
      status: s.is_active ? (s.is_archived ? 'Archived' : 'Active') : 'Inactive',
      setup: s.needs_setup ? 'Pending' : 'Complete',
      hire_date: formatDate(s.hire_date),
      invited_at: formatDate(s.invited_at),
      last_login: formatRelativeTime(s.last_login_at),
      emergency_contact: s.emergency_contact || '',
    }))
    exportStaffToCSV(rows)
    success('Export Complete', `${rows.length} rows exported to CSV.`)
  }

  const openDetail = (member: StaffMember) => {
    setDetailStaff(member)
    setShowDetail(true)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          {restaurantInfo && (
            <div className="flex items-center gap-4 mb-4 p-3 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-xl w-fit">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand" />
                <span className="text-sm font-medium text-[var(--text-primary)]">{restaurantInfo.name}</span>
              </div>
              <div className="w-px h-4 bg-[var(--surface-active)]" />
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-[var(--text-muted)]">
                  Owner: <span className="text-[var(--text-primary)] font-medium">{restaurantInfo.owner_name}</span>
                </span>
                {restaurantInfo.manager_name && (
                  <>
                    <div className="w-px h-4 bg-[var(--surface-active)]" />
                    <span className="text-xs text-[var(--text-muted)]">
                      Manager: <span className="text-[var(--text-primary)] font-medium">{restaurantInfo.manager_name}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="bg-brand-subtle text-brand border-brand/20 px-3 py-1">
              Team Management
            </Badge>
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">
            Restaurant <span className="text-brand">Staff</span>
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            Manage your team of <span className="text-[var(--text-primary)] font-semibold">{stats.total} active members</span>
            {stats.archived > 0 && <span className="text-[var(--text-muted)]"> · {stats.archived} archived</span>}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {isOwner && (
            <button
              onClick={handleExport}
              className="h-12 px-5 rounded-xl bg-[var(--surface-active)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--surface-active)] flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Export CSV</span>
            </button>
          )}
          <button
            onClick={loadStaff}
            disabled={isLoading}
            className="h-12 px-5 rounded-xl bg-[var(--surface-active)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--surface-active)] flex items-center gap-2 transition-all"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            <span className="text-sm font-medium">Refresh</span>
          </button>
          {isOwner && (
            <button
              onClick={() => { setEditingStaff(null); setShowModal(true) }}
              className="h-12 px-6 rounded-xl bg-brand hover:bg-brand-hover text-[var(--text-primary)] flex items-center gap-2 transition-all font-medium"
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-medium">Add Staff</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide">Total Active</span>
            <User className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <p className="text-3xl font-bold text-[var(--text-primary)]">{stats.total}</p>
        </div>
        <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide">Online</span>
            <Check className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-emerald-500">{stats.activeNow}</p>
        </div>
        <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide">Inactive</span>
            <X className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-3xl font-bold text-rose-500">{stats.inactive}</p>
        </div>
        <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide">Pending Setup</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-amber-500">{stats.pendingSetup}</p>
        </div>
        <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl flex flex-col justify-center">
          {stats.roleData.length > 0 ? (
            <ResponsiveContainer width="100%" height={80}>
              <PieChart>
                <Pie
                  data={stats.roleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={22}
                  outerRadius={36}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.roleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-[var(--text-muted)] text-center">No data</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-1">
        {(['active', 'archived', 'all'] as TabFilter[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setTabFilter(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium capitalize transition-colors rounded-t-lg',
              tabFilter === tab
                ? 'text-brand border-b-2 border-brand'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            )}
          >
            {tab}
            <span className={cn('ml-2 text-xs px-1.5 py-0.5 rounded-full', tabFilter === tab ? 'bg-brand-subtle text-brand' : 'bg-[var(--surface-active)] text-[var(--text-muted)]')}>
              {tab === 'active' ? stats.total : tab === 'archived' ? stats.archived : staff.length}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full h-12 pl-12 pr-4 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-brand focus:outline-none transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-12 pl-3 pr-8 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] focus:border-brand focus:outline-none appearance-none cursor-pointer"
            >
              <option value="name">Sort by Name</option>
              <option value="role">Sort by Role</option>
              <option value="invited_at">Sort by Invited</option>
              <option value="last_login_at">Sort by Last Active</option>
              <option value="hire_date">Sort by Hire Date</option>
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
          </div>
          <button
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="h-12 px-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Toggle sort direction"
          >
            {sortDir === 'asc' ? <ChevronLeft className="w-4 h-4 rotate-90" /> : <ChevronLeft className="w-4 h-4 -rotate-90" />}
          </button>
          <div className="flex gap-1">
            {(['all', 'manager', 'waiter', 'kitchen', 'cashier', 'delivery', 'rider'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={cn(
                  'h-12 px-3 rounded-xl text-xs font-medium uppercase tracking-wide transition-all',
                  roleFilter === role
                    ? 'bg-brand text-[var(--text-primary)]'
                    : 'bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
                )}
              >
                {role === 'all' ? 'All' : roleConfig[role]?.label || role}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOwner && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-3 bg-brand-subtle border border-brand/20 rounded-xl"
          >
            <CheckSquare className="w-4 h-4 text-brand" />
            <span className="text-sm text-orange-400 font-medium">{selectedIds.size} selected</span>
            <div className="flex-1" />
            <button onClick={() => handleBulkAction('activate')} className="px-3 py-1.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors">Enable</button>
            <button onClick={() => handleBulkAction('deactivate')} className="px-3 py-1.5 text-xs font-medium bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-colors">Disable</button>
            <button onClick={() => handleBulkAction('archive')} className="px-3 py-1.5 text-xs font-medium bg-[var(--surface-active)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--surface-active)] transition-colors">Archive</button>
            <button onClick={() => handleBulkAction('restore')} className="px-3 py-1.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors">Restore</button>
            <button onClick={() => handleBulkAction('delete')} className="px-3 py-1.5 text-xs font-medium bg-rose-600 text-[var(--text-primary)] rounded-lg hover:bg-rose-700 transition-colors">Delete</button>
            <button onClick={() => setSelectedIds(new Set())} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {filteredStaff.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-[var(--border)] rounded-2xl">
          <User className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Staff Found</h3>
          <p className="text-[var(--text-muted)] text-sm">Add your first staff member to get started</p>
        </div>
      ) : (
        <>
          {isOwner && (
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {paginatedStaff.every((s) => selectedIds.has(s.id)) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                Select all on page
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {paginatedStaff.map((member) => (
              <StaffCard
                key={member.id}
                member={member}
                selected={selectedIds.has(member.id)}
                onSelect={() => toggleSelection(member.id)}
                onEdit={() => { setEditingStaff(member); setShowModal(true) }}
                onToggleActive={() => handleToggleActive(member.id)}
                onArchive={() => handleArchive(member.id)}
                onDelete={() => handleDelete(member.id)}
                onResend={() => handleResendInvite(member.id)}
                onView={() => openDetail(member)}
                isOwner={isOwner}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 px-2 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-secondary)] focus:outline-none"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span className="text-xs text-[var(--text-muted)]">
                {filteredStaff.length > 0 ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filteredStaff.length)} of ${filteredStaff.length}` : '0 results'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 px-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors text-xs"
              >
                Previous
              </button>
              <span className="text-xs text-[var(--text-muted)] px-2">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 px-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors text-xs"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingStaff(null) }} title={editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'} size="md">
        <StaffForm
          staff={editingStaff}
          restaurantId={restaurant?.id || ''}
          onSuccess={() => { setShowModal(false); setEditingStaff(null); loadStaff() }}
          onCancel={() => { setShowModal(false); setEditingStaff(null) }}
        />
      </Modal>

      <AnimatePresence>
        {showDetail && detailStaff && (
          <StaffDetailDrawer
            member={detailStaff}
            onClose={() => setShowDetail(false)}
            onEdit={() => { setShowDetail(false); setEditingStaff(detailStaff); setShowModal(true) }}
            onToggleActive={() => handleToggleActive(detailStaff.id)}
            onArchive={() => { setShowDetail(false); handleArchive(detailStaff.id) }}
            onResend={() => handleResendInvite(detailStaff.id)}
            isOwner={isOwner}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function StaffCard({
  member,
  selected,
  onSelect,
  onEdit,
  onToggleActive,
  onArchive,
  onDelete,
  onResend,
  onView,
  isOwner,
}: {
  member: StaffMember
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onToggleActive: () => void
  onArchive: () => void
  onDelete: () => void
  onResend: () => void
  onView: () => void
  isOwner: boolean
}) {
  const cfg = roleConfig[member.role]
  const initials = member.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className={cn(
      'bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--border-strong)] transition-all group relative',
      !member.is_active && 'opacity-60',
      member.is_archived && 'opacity-40 grayscale'
    )}>
      {isOwner && (
        <button
          onClick={(e) => { e.stopPropagation(); onSelect() }}
          className="absolute top-4 left-4 z-10"
        >
          {selected ? <CheckSquare className="w-4 h-4 text-brand" /> : <Square className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--text-muted)]" />}
        </button>
      )}

      <div className={`flex items-center justify-between mb-4 ${isOwner ? 'pl-7' : ''}`}>
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', member.is_active ? 'bg-emerald-500' : 'bg-[var(--surface-active)]')} />
          <span className={cn('text-xs font-medium uppercase', member.is_active ? 'text-emerald-500' : 'text-[var(--text-muted)]')}>
            {member.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5', cfg.bgColor, cfg.color)}>
          {cfg.icon}
          {cfg.label}
        </span>
      </div>

      <div className="text-center mb-5">
        <div className={cn(
          'w-16 h-16 rounded-2xl bg-[var(--surface)] border flex items-center justify-center text-xl font-bold mx-auto mb-3 transition-colors overflow-hidden',
          member.is_active ? `border-emerald-500/30 ${cfg.color}` : 'border-[var(--border)] text-[var(--text-muted)]'
        )}>
          {member.avatar_url ? (
            <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{member.name}</h3>
        <p className="text-sm text-[var(--text-muted)]">{member.email || 'No email'}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {member.phone && (
          <div className="p-2 bg-[var(--surface)]/50 rounded-xl text-center">
            <Phone className="w-3.5 h-3.5 text-[var(--text-muted)] mx-auto mb-1" />
            <p className="text-xs text-[var(--text-primary)] font-medium">{member.phone}</p>
          </div>
        )}
        <div className="p-2 bg-[var(--surface)]/50 rounded-xl text-center">
          <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] mx-auto mb-1" />
          <p className="text-xs text-[var(--text-primary)] font-medium">{formatDate(member.hire_date)}</p>
        </div>
        {member.shift && (
          <div className="p-2 bg-[var(--surface)]/50 rounded-xl text-center">
            {shiftConfig[member.shift]?.icon}
            <p className="text-xs text-[var(--text-primary)] font-medium mt-1">{shiftConfig[member.shift]?.label}</p>
          </div>
        )}
        <div className="p-2 bg-[var(--surface)]/50 rounded-xl text-center">
          <Clock className="w-3.5 h-3.5 text-[var(--text-muted)] mx-auto mb-1" />
          <p className="text-xs text-[var(--text-primary)] font-medium">{formatRelativeTime(member.last_login_at)}</p>
        </div>
      </div>

      <div className={cn(
        'p-2.5 rounded-xl mb-4 flex items-center gap-2 justify-center',
        member.needs_setup ? 'bg-amber-500/10' : 'bg-emerald-500/10'
      )}>
        {member.needs_setup ? (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-medium text-amber-500">Setup Pending</span>
          </>
        ) : (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-500">Setup Complete</span>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onView} className="flex-1 h-9 rounded-xl bg-[var(--surface-active)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-active)] text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> View
        </button>
        {isOwner && member.needs_setup && (
          <button onClick={onResend} className="flex-1 h-9 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Resend
          </button>
        )}
        {isOwner && (
          <button onClick={onToggleActive} className={cn(
            'h-9 px-3 rounded-xl text-xs font-medium transition-colors',
            member.is_active ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
          )}>
            {member.is_active ? 'Disable' : 'Enable'}
          </button>
        )}
        <button onClick={onEdit} className="h-9 w-9 rounded-xl bg-[var(--surface-active)] text-[var(--text-muted)] hover:text-brand-hover flex items-center justify-center transition-colors">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        {isOwner && (
          <>
            <button onClick={onArchive} className="h-9 w-9 rounded-xl bg-[var(--surface-active)] text-[var(--text-muted)] hover:text-amber-500 flex items-center justify-center transition-colors">
              {member.is_archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onDelete} className="h-9 w-9 rounded-xl bg-[var(--surface-active)] text-[var(--text-muted)] hover:text-rose-500 flex items-center justify-center transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function StaffDetailDrawer({
  member,
  onClose,
  onEdit,
  onToggleActive,
  onArchive,
  onResend,
  isOwner,
}: {
  member: StaffMember
  onClose: () => void
  onEdit: () => void
  onToggleActive: () => void
  onArchive: () => void
  onResend: () => void
  isOwner: boolean
}) {
  const [notes, setNotes] = useState(member.admin_notes || '')
  const { success, error: showError } = useToast()
  const cfg = roleConfig[member.role]
  const initials = member.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  const saveNotes = async () => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('staff').update({ admin_notes: notes }).eq('id', member.id)
      if (error) throw error
      success('Notes Saved', 'Admin notes updated.')
    } catch (err) {
      showError('Error', 'Failed to save notes')
    }
  }

  const steps = [
    { label: 'Invited', done: !!member.invited_at, date: member.invited_at },
    { label: 'Email Sent', done: !!member.invited_at, date: member.invited_at },
    { label: 'PIN Entered', done: !member.needs_setup || !!member.setup_completed_at, date: member.setup_completed_at },
    { label: 'Setup Complete', done: !member.needs_setup, date: member.setup_completed_at },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[var(--surface)]/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-lg bg-[var(--background)] border-l border-[var(--border)] h-full overflow-y-auto"
      >
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--surface-active)] text-[var(--text-muted)] transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              {isOwner && member.needs_setup && (
                <button onClick={onResend} className="px-3 py-1.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Resend Invite
                </button>
              )}
              <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium bg-[var(--surface-active)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--surface-active)] transition-colors flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          </div>

          <div className="text-center">
            <div className={cn(
              'w-24 h-24 rounded-3xl bg-[var(--surface)] border-2 flex items-center justify-center text-3xl font-bold mx-auto mb-4 overflow-hidden',
              member.is_active ? `border-emerald-500/30 ${cfg.color}` : 'border-[var(--border)] text-[var(--text-muted)]'
            )}>
              {member.avatar_url ? (
                <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{member.name}</h2>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5', cfg.bgColor, cfg.color)}>
                {cfg.icon} {cfg.label}
              </span>
              {member.shift && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--surface-active)] text-[var(--text-muted)] flex items-center gap-1.5">
                  {shiftConfig[member.shift]?.icon} {shiftConfig[member.shift]?.label}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl">
              <p className="text-xs text-[var(--text-muted)] mb-1">Status</p>
              <p className={cn('text-sm font-semibold', member.is_active ? 'text-emerald-500' : 'text-rose-500')}>
                {member.is_active ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className="p-4 bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl">
              <p className="text-xs text-[var(--text-muted)] mb-1">Setup</p>
              <p className={cn('text-sm font-semibold', member.needs_setup ? 'text-amber-500' : 'text-emerald-500')}>
                {member.needs_setup ? 'Pending' : 'Complete'}
              </p>
            </div>
            <div className="p-4 bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl">
              <p className="text-xs text-[var(--text-muted)] mb-1">Hire Date</p>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{formatDate(member.hire_date)}</p>
            </div>
            <div className="p-4 bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl">
              <p className="text-xs text-[var(--text-muted)] mb-1">Last Active</p>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{formatRelativeTime(member.last_login_at)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">Contact</h3>
            <div className="space-y-2">
              {member.email && (
                <div className="flex items-center gap-3 p-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl">
                  <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-sm text-[var(--text-primary)]">{member.email}</span>
                </div>
              )}
              {member.phone && (
                <div className="flex items-center gap-3 p-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl">
                  <Phone className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-sm text-[var(--text-primary)]">{member.phone}</span>
                </div>
              )}
              {member.emergency_contact && (
                <div className="flex items-center gap-3 p-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <div>
                    <p className="text-xs text-rose-400 font-medium">Emergency Contact</p>
                    <p className="text-sm text-[var(--text-primary)]">{member.emergency_contact}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">Onboarding Timeline</h3>
            <div className="relative pl-4">
              <div className="absolute left-1.5 top-0 bottom-0 w-px bg-[var(--surface-active)]" />
              {steps.map((step, i) => (
                <div key={step.label} className="relative mb-4 last:mb-0">
                  <div className={cn(
                    'absolute -left-2.5 top-0.5 w-3 h-3 rounded-full border-2',
                    step.done ? 'bg-emerald-500 border-emerald-500' : 'bg-[var(--surface-raised)] border-[var(--border-strong)]'
                  )} />
                  <div className="pl-4">
                    <p className={cn('text-sm font-medium', step.done ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]')}>
                      {step.label}
                    </p>
                    {step.date && (
                      <p className="text-xs text-[var(--text-muted)]">{formatDate(step.date)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isOwner && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-[var(--text-muted)]" />
                Admin Notes
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Private notes about this staff member (performance, warnings, etc.)"
                className="w-full h-32 p-4 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-brand focus:outline-none resize-none"
              />
              <button onClick={saveNotes} className="px-4 py-2 bg-[var(--surface-active)] hover:bg-[var(--surface-active)] text-[var(--text-primary)] text-xs font-medium rounded-lg transition-colors">
                Save Notes
              </button>
            </div>
          )}

          {isOwner && (
            <div className="flex gap-2 pt-4 border-t border-[var(--border)]">
              <button onClick={onToggleActive} className={cn(
                'flex-1 h-10 rounded-xl text-xs font-medium transition-colors',
                member.is_active
                  ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              )}>
                {member.is_active ? 'Disable Account' : 'Enable Account'}
              </button>
              <button onClick={onArchive} className="flex-1 h-10 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-medium transition-colors">
                {member.is_archived ? 'Restore Account' : 'Archive Account'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function StaffForm({ staff, restaurantId, onSuccess, onCancel }: { staff: StaffMember | null, restaurantId: string, onSuccess: () => void, onCancel: () => void }) {
  const { success, error: showError } = useToast()
  const isOwner = useIsOwner()
  const [isLoading, setIsLoading] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  const [formData, setFormData] = useState({
    name: staff?.name || '',
    email: staff?.email || '',
    phone: staff?.phone || '',
    role: staff?.role || 'waiter',
    shift: staff?.shift || 'full_time',
    emergency_contact: staff?.emergency_contact || '',
    hire_date: staff?.hire_date ? staff.hire_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    admin_notes: staff?.admin_notes || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!restaurantId) {
      showError('Error', 'Restaurant context not found')
      return
    }
    if (formData.phone && !validatePhone(formData.phone)) {
      setPhoneError('Enter a valid phone number (7-15 digits)')
      return
    }
    setPhoneError('')

    setIsLoading(true)
    try {
      if (staff) {
        const updateData: any = {
          staffId: staff.id,
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          restaurantId,
          shift: formData.shift,
          emergency_contact: formData.emergency_contact || null,
          hire_date: formData.hire_date || null,
        }
        if (isOwner) {
          updateData.role = formData.role
          updateData.admin_notes = formData.admin_notes || null
        }
        const response = await fetch('/api/staff', {
          method: 'PUT',
          headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updateData),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to update staff')
        success('Staff Updated', `${formData.name} has been updated.`)
        onSuccess()
      } else {
        const response = await fetch('/api/staff/invite', {
          method: 'POST',
          headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            role: formData.role,
            restaurantId,
          }),
        })

        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to invite staff')
        success('Staff Invited!', `${formData.name} has been invited successfully.`)
        onSuccess()
      }
    } catch (err: any) {
      showError('Error', err.message || 'Failed to save staff member')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Full Name"
        value={formData.name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
        placeholder="e.g. John Doe"
        required
        icon={User}
        className="h-12 bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-primary)]"
      />
      <Input
        label="Email Address"
        type="email"
        value={formData.email}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
        placeholder="john@restaurant.com"
        required={!staff}
        icon={Mail}
        className="h-12 bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-primary)]"
      />
      <Input
        label="Phone"
        type="tel"
        value={formData.phone}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setFormData({ ...formData, phone: e.target.value })
          setPhoneError('')
        }}
        placeholder="+92 300 1234567"
        error={phoneError}
        icon={Phone}
        className="h-12 bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-primary)]"
      />
      <Input
        label="Emergency Contact"
        value={formData.emergency_contact}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, emergency_contact: e.target.value })}
        placeholder="Name + phone (e.g. Ali - 03001234567)"
        icon={AlertCircle}
        className="h-12 bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-primary)]"
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-foreground/80">Hire Date</label>
          <input
            type="date"
            value={formData.hire_date}
            onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
            className="w-full h-12 px-4 bg-surface border border-border rounded-xl outline-none transition-all text-sm text-[var(--text-primary)] focus:border-brand focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-bold text-foreground/80">Shift</label>
          <select
            value={formData.shift}
            onChange={(e) => setFormData({ ...formData, shift: e.target.value as StaffShift })}
            className="w-full h-12 px-4 bg-surface border border-border rounded-xl outline-none transition-all text-sm text-[var(--text-primary)] focus:border-brand focus:ring-4 focus:ring-primary/10 appearance-none"
          >
            {Object.entries(shiftConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {(!staff || isOwner) && (
        <div className="space-y-3">
          <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Role</label>
          <div className={cn("grid grid-cols-3 gap-2", staff && !isOwner && "opacity-50 pointer-events-none")}>
            {(['waiter', 'kitchen', 'cashier', 'delivery', 'manager', 'rider'] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setFormData({ ...formData, role })}
                disabled={!!staff && !isOwner}
                className={cn(
                  'h-12 rounded-xl text-xs font-medium uppercase tracking-wide transition-all flex flex-col items-center justify-center gap-1',
                  formData.role === role
                    ? 'bg-brand text-[var(--text-primary)]'
                    : 'bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
                )}
              >
                {roleConfig[role].icon}
                {roleConfig[role].label}
              </button>
            ))}
          </div>
          {staff && !isOwner && (
            <p className="text-xs text-[var(--text-muted)]">Only the owner can change roles.</p>
          )}
        </div>
      )}

      {isOwner && staff && (
        <div className="space-y-2">
          <label className="block text-sm font-bold text-foreground/80">Admin Notes</label>
          <textarea
            value={formData.admin_notes}
            onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
            placeholder="Private notes about this staff member"
            className="w-full h-24 p-4 bg-surface border border-border rounded-xl outline-none transition-all text-sm text-[var(--text-primary)] placeholder:text-muted-foreground/40 focus:border-brand focus:ring-4 focus:ring-primary/10 resize-none"
          />
        </div>
      )}

      {!staff && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <p className="text-xs text-blue-400 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Staff will receive an email with a 6-digit PIN to complete setup.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-12 rounded-xl border border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 h-12 rounded-xl bg-brand hover:bg-brand-hover text-[var(--text-primary)] transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            staff ? 'Update' : 'Send Invite'
          )}
        </button>
      </div>
    </form>
  )
}
