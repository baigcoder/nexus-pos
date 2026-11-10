'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
 Plus, Tv, ChefHat, Wine, Monitor, Users, QrCode,
 Clock, Eye, RefreshCw, Search, Tv2, Megaphone,
 ExternalLink, Copy, Trash2, Settings2, Power,
 ArrowRight, Zap, Layout, EyeOff, CreditCard, ShieldCheck
} from 'lucide-react'
import { DisplayCard, DisplayCardSkeleton } from '@/components/display/DisplayCard'
import { DisplayModal } from '@/components/display/DisplayModal'
import type { Display, DisplayType } from '@/types/display'
import { useToast } from '@/components/ui/toast'
import { canManageDisplays, getDisplayRoleLabels, getDisplaySyncRule } from '@/lib/display-access'

const TYPE_CONFIG: Record<DisplayType, { icon: any; label: string; gradient: string; ring: string }> = {
 kitchen:       { icon: ChefHat,  label: 'Kitchen',  gradient: 'from-orange-500 to-red-500',    ring: 'ring-orange-500/30' },
 bar:           { icon: Wine,     label: 'Bar',      gradient: 'from-violet-500 to-purple-500', ring: 'ring-violet-500/30' },
 counter:       { icon: Monitor,  label: 'Counter',  gradient: 'from-cyan-500 to-blue-500',     ring: 'ring-cyan-500/30' },
 cashier:       { icon: CreditCard,label: 'Cashier',  gradient: 'from-sky-500 to-indigo-500',    ring: 'ring-sky-500/30' },
 waiting:       { icon: Users,    label: 'Waiting',  gradient: 'from-emerald-500 to-green-500', ring: 'ring-emerald-500/30' },
 qr:            { icon: QrCode,   label: 'QR',       gradient: 'from-amber-500 to-orange-500',  ring: 'ring-amber-500/30' },
 advertisement: { icon: Megaphone,label: 'Ads',      gradient: 'from-pink-500 to-rose-500',     ring: 'ring-pink-500/30' },
}

const ALL_TYPES: DisplayType[] = ['kitchen', 'bar', 'counter', 'cashier', 'waiting', 'qr', 'advertisement']

export default function DisplayManagerPage() {
 const router = useRouter()
 const { restaurant, userRole, staff } = useAuthStore()
 const { success, error: toastError } = useToast()
 const supabase = createClient()

 const [displays, setDisplays] = useState<Display[]>([])
 const [isLoading, setIsLoading] = useState(true)
 const [isRefreshing, setIsRefreshing] = useState(false)
 const [searchQuery, setSearchQuery] = useState('')
 const [filterType, setFilterType] = useState<DisplayType | 'all'>('all')
 const [isModalOpen, setIsModalOpen] = useState(false)
 const [editingDisplay, setEditingDisplay] = useState<Display | null>(null)

 const effectiveRole = userRole || staff?.role

 useEffect(() => {
  if (effectiveRole && !canManageDisplays(effectiveRole)) {
   router.push('/dashboard')
  }
 }, [effectiveRole, router])

 const loadDisplays = useCallback(async () => {
  if (!restaurant?.id) return
  setIsRefreshing(true)
  try {
   const { data } = await supabase
    .from('displays')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: false })

   if (data) {
    setDisplays(data.map((d: any) => ({
     ...d,
     settings: typeof d.settings === 'string' ? JSON.parse(d.settings) : d.settings
    })))
   }
  } catch (err) {
   console.error('Failed to load displays:', err)
  } finally {
   setIsLoading(false)
   setIsRefreshing(false)
  }
 }, [restaurant?.id, supabase])

 useEffect(() => { loadDisplays() }, [loadDisplays])

 // Real-time sync
 useEffect(() => {
  if (!restaurant?.id) return
  const channel = supabase
   .channel('displays_changes')
   .on('postgres_changes', {
    event: '*', schema: 'public', table: 'displays',
    filter: `restaurant_id=eq.${restaurant.id}`
   }, () => loadDisplays())
   .subscribe()
  return () => { supabase.removeChannel(channel) }
 }, [restaurant?.id, loadDisplays, supabase])

 const handleSaveDisplay = async (displayData: Partial<Display>) => {
  const syncRule = displayData.type ? getDisplaySyncRule(displayData.type) : null
  const payload = {
   ...displayData,
   settings: syncRule
    ? JSON.stringify({
      ...(typeof displayData.settings === 'string' ? JSON.parse(displayData.settings) : displayData.settings),
      allowed_roles: syncRule.roles,
      sync_target: syncRule.label,
     })
    : typeof displayData.settings === 'string'
      ? displayData.settings
      : JSON.stringify(displayData.settings),
  }
  if (displayData.id) {
   const { error } = await supabase.from('displays').update(payload).eq('id', displayData.id)
   if (error) throw error
   success('Display Updated', `${displayData.name} has been updated.`)
  } else {
   const { error } = await supabase.from('displays').insert(payload)
   if (error) throw error
   success('Display Created', `${displayData.name} is ready to use.`)
  }
  await loadDisplays()
 }

 const handleToggleActive = async (display: Display) => {
  try {
   await supabase.from('displays').update({ is_active: !display.is_active }).eq('id', display.id)
   success(display.is_active ? 'Display Paused' : 'Display Activated', `${display.name} ${display.is_active ? 'paused' : 'activated'}.`)
   await loadDisplays()
  } catch { toastError('Error', 'Failed to toggle display') }
 }

 const handleDuplicate = async (display: Display) => {
  let slug = display.slug + '-copy'
  let c = 1
  while (displays.some(d => d.slug === slug)) { slug = `${display.slug}-copy-${c}`; c++ }
  await handleSaveDisplay({
   name: `${display.name} (Copy)`, slug, type: display.type,
   template: display.template, settings: display.settings, restaurant_id: display.restaurant_id,
  })
 }

 const handleDelete = async (display: Display) => {
  if (!confirm(`Delete "${display.name}"? This cannot be undone.`)) return
  try {
   await supabase.from('displays').delete().eq('id', display.id)
   success('Deleted', `${display.name} has been removed.`)
   await loadDisplays()
  } catch { toastError('Error', 'Failed to delete display') }
 }

 const filteredDisplays = displays.filter(d => {
  const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
   d.slug.toLowerCase().includes(searchQuery.toLowerCase())
  return matchesSearch && (filterType === 'all' || d.type === filterType)
 })

 const activeCount = displays.filter(d => d.is_active).length
 const totalCount = displays.length
 const typeCounts = ALL_TYPES.reduce((acc, t) => ({ ...acc, [t]: displays.filter(d => d.type === t).length }), {} as Record<string, number>)

 return (
  <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-6 min-w-0">
   {/* Header */}
   <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div className="flex items-center gap-4">
     <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand to-red-500 flex items-center justify-center shadow-glow shrink-0">
      <Tv className="w-6 h-6 text-white" />
     </div>
     <div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Display Manager</h1>
      <p className="text-xs text-[var(--text-muted)] mt-0.5">
       {totalCount} display{totalCount !== 1 ? 's' : ''} · {activeCount} active
      </p>
     </div>
    </div>
    <button
     onClick={() => { setEditingDisplay(null); setIsModalOpen(true) }}
     className="h-10 px-5 bg-gradient-to-r from-brand to-orange-600 hover:from-brand-hover hover:to-orange-700 text-white rounded-xl flex items-center gap-2 font-semibold text-sm shadow-glow hover:shadow-glow-lg transition-all shrink-0"
    >
     <Plus className="w-4 h-4" /> New Display
    </button>
   </motion.div>

   {/* Stats Row */}
   <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
    className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    {[
     { label: 'Total', value: totalCount, icon: Layout, color: 'text-brand', bg: 'bg-brand/10', ring: 'ring-brand/20' },
     { label: 'Active', value: activeCount, icon: Eye, color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
     { label: 'Inactive', value: totalCount - activeCount, icon: EyeOff, color: 'text-zinc-400', bg: 'bg-zinc-500/10', ring: 'ring-zinc-500/20' },
     { label: 'Types Used', value: `${new Set(displays.map(d => d.type)).size}/${ALL_TYPES.length}`, icon: Zap, color: 'text-violet-400', bg: 'bg-violet-500/10', ring: 'ring-violet-500/20' },
  ].map((s, i) => (
     <div key={s.label} className={cn("flex items-center gap-3 p-4 rounded-2xl ring-1", s.bg, s.ring)}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg)}>
       <s.icon className={cn("w-5 h-5", s.color)} />
      </div>
      <div>
       <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
       <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{s.label}</p>
      </div>
     </div>
    ))}
   </motion.div>

   {/* Role Sync Matrix */}
   <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
    className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
    {(['kitchen', 'counter', 'cashier', 'advertisement'] as DisplayType[]).map(type => {
     const cfg = TYPE_CONFIG[type]
     const Icon = cfg.icon
     const syncRule = getDisplaySyncRule(type)
     const count = typeCounts[type] || 0
     return (
      <div key={type} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
       <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
         <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center", cfg.gradient)}>
          <Icon className="w-5 h-5 text-white" />
         </div>
         <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">{syncRule.label}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{count} configured</p>
         </div>
        </div>
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
       </div>
       <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">{syncRule.description}</p>
       <div className="mt-3 flex flex-wrap gap-1.5">
        {getDisplayRoleLabels(type).map(role => (
         <span key={role} className="rounded-md bg-[var(--surface-active)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
          {role}
         </span>
        ))}
       </div>
      </div>
     )
    })}
   </motion.div>

   {/* Ad Content Banner */}
   <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
    <a href="/dashboard/display-manager/ad-content"
     className="group flex items-center justify-between p-4 rounded-2xl bg-brand/10 ring-1 ring-brand/30 hover:ring-brand/60 transition-all">
     <div className="flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center shadow-sm">
       <Megaphone className="w-5 h-5 text-white" />
      </div>
      <div>
       <p className="font-bold text-sm text-[var(--text-primary)]">Signage Studio</p>
       <p className="text-xs text-[var(--text-muted)]">Send images and videos to your storefront and waiting-area screens</p>
      </div>
     </div>
     <div className="flex items-center gap-2 text-brand text-sm font-semibold group-hover:gap-3 transition-all">
      Manage <ArrowRight className="w-4 h-4" />
     </div>
    </a>
   </motion.div>

   {/* Type Filter Tabs + Search */}
   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-4">
    {/* Type tabs */}
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
     <button
      onClick={() => setFilterType('all')}
      className={cn(
       "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ring-1",
       filterType === 'all'
        ? "bg-brand/10 text-brand ring-brand/30"
        : "text-[var(--text-muted)] ring-transparent hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
      )}
     >
      <Layout className="w-3.5 h-3.5" /> All ({totalCount})
     </button>
     {ALL_TYPES.map(type => {
      const cfg = TYPE_CONFIG[type]
      const count = typeCounts[type] || 0
      const Icon = cfg.icon
      return (
       <button
        key={type}
        onClick={() => setFilterType(filterType === type ? 'all' : type)}
        className={cn(
         "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ring-1",
         filterType === type
          ? cn("bg-gradient-to-r text-white", cfg.gradient, cfg.ring)
          : "text-[var(--text-muted)] ring-transparent hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]",
         count === 0 && filterType !== type && "opacity-40"
        )}
       >
        <Icon className="w-3.5 h-3.5" /> {cfg.label}
        {count > 0 && <span className={cn("ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold",
         filterType === type ? "bg-white/20" : "bg-[var(--surface-active)]"
        )}>{count}</span>}
       </button>
      )
     })}
    </div>

    {/* Search + refresh */}
    <div className="flex gap-3">
     <div className="relative flex-1">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
      <input
       type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
       placeholder="Search by name or slug..."
       className="w-full pl-10 pr-4 h-10 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
      />
     </div>
     <button
      onClick={loadDisplays}
      disabled={isRefreshing}
      className="h-10 w-10 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50 shrink-0"
      aria-label="Refresh"
     >
      <RefreshCw className={cn("w-4 h-4 text-[var(--text-muted)]", isRefreshing && "animate-spin")} />
     </button>
    </div>
   </motion.div>

   {/* Display Grid */}
   {isLoading ? (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
     {[...Array(6)].map((_, i) => <DisplayCardSkeleton key={i} />)}
    </div>
   ) : filteredDisplays.length === 0 ? (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
     className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-raised)] relative overflow-hidden">
     <div className="absolute inset-0 bg-gradient-to-br from-brand/[0.02] via-transparent to-transparent pointer-events-none" />
     <div className="relative z-10 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-4">
       <Tv className="w-8 h-8 text-brand/50" />
      </div>
      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">
       {searchQuery || filterType !== 'all' ? 'No displays found' : 'No displays yet'}
      </h2>
      <p className="text-sm text-[var(--text-muted)] max-w-xs mx-auto">
       {searchQuery || filterType !== 'all' ? 'Try adjusting your search or filter' : 'Create your first digital display to get started'}
      </p>
      {!searchQuery && filterType === 'all' && (
       <button
        onClick={() => { setEditingDisplay(null); setIsModalOpen(true) }}
        className="mt-5 h-10 px-5 bg-gradient-to-r from-brand to-orange-600 text-white rounded-xl flex items-center gap-2 font-semibold text-sm shadow-glow mx-auto"
       >
        <Plus className="w-4 h-4" /> Create Display
       </button>
      )}
     </div>
    </motion.div>
   ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
     <AnimatePresence mode="popLayout">
      {filteredDisplays.map((display) => (
       <DisplayCard
        key={display.id}
        display={display}
        onEdit={(d) => { setEditingDisplay(d); setIsModalOpen(true) }}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
       />
      ))}
     </AnimatePresence>
    </div>
   )}

   {/* Quick Access Links */}
   {totalCount > 0 && (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
     className="p-5 bg-[var(--surface-raised)] rounded-2xl border border-[var(--border)]">
     <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
      <ExternalLink className="w-4 h-4 text-brand" /> Quick Access URLs
     </h3>
     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {displays.map(d => {
       const cfg = TYPE_CONFIG[d.type]
       const Icon = cfg.icon
       return (
        <a key={d.id} href={`/display/${d.slug}?preview=1`} target="_blank" rel="noopener noreferrer"
         className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--surface-hover)] transition-all">
         <div className={cn("w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0", cfg.gradient)}>
          <Icon className="w-3.5 h-3.5 text-white" />
         </div>
         <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--text-primary)] truncate group-hover:text-brand transition-colors">{d.name}</p>
          <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">/display/{d.slug}</p>
         </div>
         <div className={cn("w-2 h-2 rounded-full shrink-0", d.is_active ? "bg-emerald-400" : "bg-zinc-600")} />
        </a>
       )
      })}
     </div>
    </motion.div>
   )}

   {/* How-to Guide */}
   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
    className="p-5 rounded-2xl bg-gradient-to-r from-brand/[0.06] via-orange-500/[0.03] to-transparent ring-1 ring-brand/10">
    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
     <Tv2 className="w-4 h-4 text-brand" /> Getting Started
    </h3>
    <div className="grid md:grid-cols-3 gap-4">
     {[
      { step: '1', title: 'Create Display', desc: 'Configure type, template, refresh interval, and theme settings.' },
      { step: '2', title: 'Open on Device', desc: 'Use the URL on tablets, TVs, or any browser. Displays auto-refresh.' },
      { step: '3', title: 'Live Updates', desc: 'Orders appear in real-time. Staff can update status directly.' },
     ].map(s => (
      <div key={s.step} className="flex gap-3">
       <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center shrink-0 text-brand text-xs font-bold">{s.step}</div>
       <div>
        <p className="text-xs font-bold text-[var(--text-primary)] mb-0.5">{s.title}</p>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{s.desc}</p>
       </div>
      </div>
     ))}
    </div>
   </motion.div>

   {/* Modal */}
   <DisplayModal
    isOpen={isModalOpen}
    onClose={() => { setIsModalOpen(false); setEditingDisplay(null) }}
    onSave={handleSaveDisplay}
    display={editingDisplay}
    restaurantId={restaurant?.id || ''}
    existingSlugs={displays.map(d => d.slug)}
   />
  </div>
 )
}
