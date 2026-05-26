'use client'

import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useRef } from 'react'
import type { Order, OrderItem } from '@/types/database'
import { cn } from '@/lib/utils'
import {
  Clock, AlertTriangle, ChefHat, Check, ArrowLeft,
  Star, Volume2, VolumeX, Flame
} from 'lucide-react'

interface OrderTicketProps {
  order: Order
  currency: string
  variant?: 'list' | 'grid' | 'compact' | 'kanban'
  showTimer?: boolean
  priorityEnabled?: boolean
  onStatusChange?: (status: 'preparing' | 'ready' | 'served') => void
}

export function OrderTicket({
  order,
  currency,
  variant = 'list',
  showTimer = true,
  priorityEnabled = true,
  onStatusChange
}: OrderTicketProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const created = new Date(order.created_at).getTime()
    const update = () => {
      const now = Date.now()
      setElapsedMinutes(Math.floor((now - created) / 60000))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [order.created_at])

  useEffect(() => {
    if (audioEnabled && elapsedMinutes === 0 && order.status === 'pending') {
      // Play notification sound on new order
      const audio = new Audio('/sounds/new-order.mp3')
      audio.volume = 0.5
      audio.play().catch(() => {})
    }
  }, [order.status, elapsedMinutes, audioEnabled])

  const timerStatus = getTimerStatus(elapsedMinutes)

  const variants = {
    list: <ListTicket />,
    grid: <GridTicket />,
    compact: <CompactTicket />,
    kanban: <KanbanTicket />,
  }

  return (
    <>
      {variants[variant]}
      <audio ref={audioRef} />
    </>
  )

  function ListTicket() {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className={cn(
          "rounded-2xl p-5 transition-all",
          timerStatus === 'danger' && "bg-red-950/50 border-2 border-red-500/50",
          timerStatus === 'warning' && "bg-yellow-950/50 border-2 border-yellow-500/50",
          timerStatus === 'normal' && "bg-neutral-900 border-2 border-neutral-800",
          order.is_priority && priorityEnabled && "border-2 border-orange-500 shadow-lg shadow-orange-500/20"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black text-orange-400">#{order.order_number}</span>
            {order.is_priority && priorityEnabled && (
              <span className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded-lg text-xs font-bold">
                <Flame className="w-3 h-3" />
                PRIORITY
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showTimer && <TimerBadge minutes={elapsedMinutes} status={timerStatus} />}
            <span className={cn(
              "px-3 py-1 rounded-lg text-xs font-bold uppercase",
              order.status === 'pending' ? "bg-yellow-500/20 text-yellow-400" :
              order.status === 'preparing' ? "bg-orange-500/20 text-orange-400" :
              "bg-emerald-500/20 text-emerald-400"
            )}>
              {order.status}
            </span>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 mb-4 text-sm text-neutral-500">
          {order.table && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              Table {order.table.table_number}
            </span>
          )}
          <span>{new Date(order.created_at).toLocaleTimeString()}</span>
        </div>

        {/* Items */}
        <div className="space-y-2 mb-4">
          {(order.items as OrderItem[])?.map((item, i) => (
            <div key={i} className="flex items-start gap-3 bg-black/30 rounded-xl p-3">
              <span className="text-lg font-black text-orange-400 shrink-0">{item.quantity}x</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{item.menu_item?.name || 'Item'}</p>
                {item.special_instructions && (
                  <p className="text-xs text-yellow-500 mt-1">{item.special_instructions}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {onStatusChange && (
          <div className="flex gap-2">
            {order.status === 'pending' && (
              <button
                onClick={() => onStatusChange('preparing')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 rounded-xl font-bold transition-all"
              >
                <ChefHat className="w-4 h-4" />
                Start Preparing
              </button>
            )}
            {order.status === 'preparing' && (
              <button
                onClick={() => onStatusChange('ready')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold transition-all"
              >
                <Check className="w-4 h-4" />
                Mark Ready
              </button>
            )}
          </div>
        )}
      </motion.div>
    )
  }

  function GridTicket() {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={cn(
          "rounded-2xl p-4 flex flex-col h-full",
          timerStatus === 'danger' && "bg-red-950/50 border-2 border-red-500/50",
          timerStatus === 'warning' && "bg-yellow-950/50 border-2 border-yellow-500/50",
          timerStatus === 'normal' && "bg-neutral-900 border-2 border-neutral-800",
          order.is_priority && priorityEnabled && "border-orange-500 shadow-lg shadow-orange-500/20"
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-black text-orange-400">#{order.order_number}</span>
          {showTimer && <TimerBadge minutes={elapsedMinutes} status={timerStatus} size="sm" />}
        </div>
        <div className="text-xs text-neutral-500 mb-2">
          {order.table?.table_number ? `T${order.table.table_number}` : ''} {new Date(order.created_at).toLocaleTimeString()}
        </div>
        <div className="flex-1 space-y-1 min-h-0 overflow-hidden">
          {(order.items as OrderItem[])?.slice(0, 4).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="font-bold text-orange-400 text-sm">{item.quantity}x</span>
              <span className="text-sm truncate">{item.menu_item?.name || 'Item'}</span>
            </div>
          ))}
          {(order.items?.length || 0) > 4 && (
            <p className="text-xs text-neutral-500">+{(order.items?.length || 0) - 4} more</p>
          )}
        </div>
        {onStatusChange && (
          <button
            onClick={() => order.status === 'pending' ? onStatusChange('preparing') : onStatusChange('ready')}
            className={cn(
              "w-full mt-3 px-3 py-2 rounded-lg font-bold text-sm transition-all",
              order.status === 'pending' ? "bg-orange-600 hover:bg-orange-700" : "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            {order.status === 'pending' ? 'Start' : 'Ready'}
          </button>
        )}
      </motion.div>
    )
  }

  function CompactTicket() {
    return (
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "flex items-center gap-4 px-4 py-3 rounded-xl",
          timerStatus === 'danger' && "bg-red-950/50 border border-red-500/50",
          timerStatus === 'warning' && "bg-yellow-950/50 border border-yellow-500/50",
          timerStatus === 'normal' && "bg-neutral-900 border border-neutral-800",
          order.is_priority && priorityEnabled && "border-l-4 border-orange-500"
        )}
      >
        <span className="text-xl font-black text-orange-400">#{order.order_number}</span>
        {showTimer && <TimerBadge minutes={elapsedMinutes} status={timerStatus} size="sm" />}
        <div className="flex-1 flex items-center gap-2 overflow-hidden">
          {(order.items as OrderItem[])?.slice(0, 3).map((item, i) => (
            <span key={i} className="text-sm truncate">
              <span className="font-bold text-orange-400">{item.quantity}x</span> {item.menu_item?.name || 'Item'}
            </span>
          ))}
          {(order.items?.length || 0) > 3 && (
            <span className="text-xs text-neutral-500">+{(order.items?.length || 0) - 3}</span>
          )}
        </div>
        {order.table && (
          <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs font-bold">
            T{order.table.table_number}
          </span>
        )}
        {onStatusChange && (
          <button
            onClick={() => order.status === 'pending' ? onStatusChange('preparing') : onStatusChange('ready')}
            className={cn(
              "px-4 py-2 rounded-lg font-bold text-sm",
              order.status === 'pending' ? "bg-orange-600 hover:bg-orange-700" : "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            {order.status === 'pending' ? 'Prep' : 'Ready'}
          </button>
        )}
      </motion.div>
    )
  }

  function KanbanTicket() {
    return (
      <div className="bg-neutral-900 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-black text-orange-400">#{order.order_number}</span>
          {showTimer && <TimerBadge minutes={elapsedMinutes} status={timerStatus} size="sm" />}
        </div>
        <div className="space-y-1 text-sm">
          {(order.items as OrderItem[])?.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="font-bold text-orange-400">{item.quantity}x</span>
              <span className="truncate">{item.menu_item?.name || 'Item'}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
}

export function TimerBadge({
  minutes,
  status,
  size = 'md'
}: {
  minutes: number
  status: 'normal' | 'warning' | 'danger'
  size?: 'sm' | 'md'
}) {
  const styles = {
    normal: 'bg-neutral-800 text-neutral-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    danger: 'bg-red-500/20 text-red-400 animate-pulse',
  }

  const Icon = status === 'danger' ? AlertTriangle : Clock

  return (
    <div className={cn(
      "flex items-center gap-1 rounded-lg font-mono font-bold",
      styles[status],
      size === 'sm' ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
    )}>
      <Icon className={cn("w-3 h-3", status === 'danger' && "animate-ping")} />
      {minutes}m
    </div>
  )
}

function getTimerStatus(minutes: number): 'normal' | 'warning' | 'danger' {
  if (minutes >= 20) return 'danger'
  if (minutes >= 10) return 'warning'
  return 'normal'
}