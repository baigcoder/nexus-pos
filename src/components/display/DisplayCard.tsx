'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ChefHat, Wine, Monitor, Users, QrCode, Edit, Copy, Trash2,
  ExternalLink, Activity, Clock, Eye, MoreVertical, Columns,
  List, Grid3X3, Minimize2, Megaphone, Presentation, CreditCard, ShieldCheck
} from 'lucide-react'
import type { DisplayType, DisplayTemplate, Display, DisplayAnalytics } from '@/types/display'
import { getDisplayRoleLabels, getDisplaySyncRule } from '@/lib/display-access'

interface DisplayCardProps {
  display: Display
  analytics?: DisplayAnalytics
  onEdit: (display: Display) => void
  onDuplicate: (display: Display) => void
  onDelete: (display: Display) => void
}

const TYPE_ICONS = {
  kitchen: ChefHat,
  bar: Wine,
  counter: Monitor,
  cashier: CreditCard,
  waiting: Users,
  qr: QrCode,
  advertisement: Megaphone,
}

const TYPE_COLORS = {
  kitchen: { bg: 'from-orange-600 to-red-600', text: 'text-orange-500', badge: 'bg-orange-500/20 text-orange-400' },
  bar: { bg: 'from-purple-600 to-pink-600', text: 'text-purple-500', badge: 'bg-purple-500/20 text-purple-400' },
  counter: { bg: 'from-cyan-600 to-blue-600', text: 'text-cyan-500', badge: 'bg-cyan-500/20 text-cyan-400' },
  cashier: { bg: 'from-sky-600 to-indigo-600', text: 'text-sky-500', badge: 'bg-sky-500/20 text-sky-400' },
  waiting: { bg: 'from-emerald-600 to-green-600', text: 'text-emerald-500', badge: 'bg-emerald-500/20 text-emerald-400' },
  qr: { bg: 'from-amber-600 to-orange-600', text: 'text-amber-500', badge: 'bg-amber-500/20 text-amber-400' },
  advertisement: { bg: 'from-pink-600 to-purple-600', text: 'text-pink-500', badge: 'bg-pink-500/20 text-pink-400' },
}

const TEMPLATE_ICONS = {
  list: List,
  kanban: Columns,
  grid: Grid3X3,
  compact: Minimize2,
  slideshow: Presentation,
}

export function DisplayCard({ display, analytics, onEdit, onDuplicate, onDelete }: DisplayCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const TypeIcon = TYPE_ICONS[display.type]
  const colors = TYPE_COLORS[display.type]
  const TemplateIcon = TEMPLATE_ICONS[display.template]
  const syncRule = getDisplaySyncRule(display.type)
  const roleLabels = getDisplayRoleLabels(display.type)

  const handleDelete = async () => {
    if (!confirm(`Delete "${display.name}"? This cannot be undone.`)) return
    setIsDeleting(true)
    await onDelete(display)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative rounded-2xl border-2 overflow-hidden transition-all duration-300",
        "bg-neutral-900/50 border-neutral-800 hover:border-neutral-700",
        display.is_active ? "" : "opacity-50"
      )}
    >
      {/* Preview Banner */}
      <div className="relative h-32 bg-gradient-to-br from-neutral-900 to-black overflow-hidden">
        {/* Simulated preview */}
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <TypeIcon className="w-20 h-20" />
        </div>

        {/* Type Badge */}
        <div className={cn(
          "absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-xl",
          colors.badge
        )}>
          <TypeIcon className="w-3 h-3" />
          {display.type.toUpperCase()}
        </div>

        {/* Status Indicator */}
        <div className="absolute top-3 right-3">
          <div className={cn(
            "w-3 h-3 rounded-full",
            display.is_active ? "bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" : "bg-neutral-600"
          )} />
        </div>

        {/* Template Badge */}
        <div className="absolute bottom-3 left-3">
          <div className="flex items-center gap-1 px-2 py-1 bg-black/50 backdrop-blur-xl rounded-lg text-xs text-neutral-400">
            <TemplateIcon className="w-3 h-3" />
            {display.template}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-black text-lg">{display.name}</h3>
            <p className="text-xs text-neutral-500 font-mono">/{display.slug}</p>
          </div>

          {/* Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-500 hover:text-white"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute right-0 top-full mt-1 z-50 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-1 min-w-[160px]"
                >
                  <Link
                    href={`/display/${display.slug}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-800 text-sm transition-colors"
                    onClick={() => setShowMenu(false)}
                  >
                    <Eye className="w-4 h-4 text-cyan-500" />
                    View Display
                  </Link>
                  <button
                    onClick={() => { onEdit(display); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-800 text-sm transition-colors"
                  >
                    <Edit className="w-4 h-4 text-orange-500" />
                    Edit Settings
                  </button>
                  <button
                    onClick={() => { onDuplicate(display); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-800 text-sm transition-colors"
                  >
                    <Copy className="w-4 h-4 text-purple-500" />
                    Duplicate
                  </button>
                  <hr className="my-1 border-neutral-800" />
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 text-sm transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </motion.div>
              </>
            )}
          </div>
        </div>

        {/* Settings Summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center px-2 py-2 bg-neutral-800/50 rounded-lg">
            <Clock className="w-4 h-4 mx-auto mb-1 text-neutral-500" />
            <p className="text-xs font-bold text-neutral-400">{display.settings.refresh_interval}s</p>
          </div>
          <div className="text-center px-2 py-2 bg-neutral-800/50 rounded-lg">
            <Activity className="w-4 h-4 mx-auto mb-1 text-neutral-500" />
            <p className="text-xs font-bold text-neutral-400">{display.settings.show_timer ? 'On' : 'Off'}</p>
          </div>
          <div className="text-center px-2 py-2 bg-neutral-800/50 rounded-lg">
            <span className="text-xs font-bold text-neutral-400">
              {display.settings.sound_enabled ? 'Sound' : 'Muted'}
            </span>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            {syncRule.label}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{syncRule.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {roleLabels.map(role => (
              <span key={role} className="rounded-md bg-neutral-800 px-2 py-1 text-[10px] font-bold text-neutral-300">
                {role}
              </span>
            ))}
          </div>
        </div>

        {/* Analytics */}
        {analytics && (
          <div className="flex items-center gap-4 text-xs text-neutral-500 border-t border-neutral-800 pt-3">
            <span>{analytics.total_orders} orders</span>
            {analytics.last_active && (
              <span>Active {formatTimeAgo(analytics.last_active)}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Link
            href={`/display/${display.slug}`}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all",
              "bg-orange-600 hover:bg-orange-700 text-white"
            )}
          >
            <ExternalLink className="w-4 h-4" />
            Open
          </Link>
          <button
            onClick={() => onEdit(display)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all",
              "bg-neutral-800 hover:bg-neutral-700 text-white"
            )}
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function formatTimeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function DisplayCardSkeleton() {
  return (
    <div className="rounded-2xl border-2 border-neutral-800 overflow-hidden animate-pulse">
      <div className="h-32 bg-neutral-900" />
      <div className="p-4 space-y-4">
        <div className="h-6 bg-neutral-800 rounded w-3/4" />
        <div className="h-4 bg-neutral-800 rounded w-1/2" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-12 bg-neutral-800 rounded-lg" />
          <div className="h-12 bg-neutral-800 rounded-lg" />
          <div className="h-12 bg-neutral-800 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1 h-10 bg-neutral-800 rounded-xl" />
          <div className="flex-1 h-10 bg-neutral-800 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
