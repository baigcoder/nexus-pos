'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Clock,
  Play,
  Square,
  Coffee,
  Calendar,
  Timer,
  Loader2,
  CheckCircle2,
  PauseCircle,
  History
} from 'lucide-react'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { withStaffAuthHeaders } from '@/lib/staff-api'

interface Shift {
  id: string
  clock_in: string
  clock_out: string | null
  break_minutes: number
  total_hours: number | null
  status: string
  notes?: string | null
}

export default function MyShiftPage() {
  const { restaurant, staff } = useAuthStore()
  const { success, error: showError } = useToast()

  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [isOnBreak, setIsOnBreak] = useState(false)
  const [breakStartedAt, setBreakStartedAt] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    if (restaurant?.id && staff?.id) {
      loadShiftData()
    }
  }, [restaurant?.id, staff?.id])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isClockedIn && currentShift) {
      interval = setInterval(() => {
        const start = new Date(currentShift.clock_in).getTime()
        const now = Date.now()
        const persistedBreakSeconds = Number(currentShift.break_minutes || 0) * 60
        const activeBreakSeconds = isOnBreak && breakStartedAt ? Math.floor((now - breakStartedAt) / 1000) : 0
        setElapsedTime(Math.max(0, Math.floor((now - start) / 1000) - persistedBreakSeconds - activeBreakSeconds))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isClockedIn, currentShift, isOnBreak, breakStartedAt])

  async function loadShiftData() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/staff/my-shift', {
        headers: withStaffAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load shift data')
      }
      setCurrentShift(data.currentShift)
      setIsClockedIn(!!data.currentShift)
      setIsOnBreak(false)
      setBreakStartedAt(null)
      setShiftHistory(data.history || [])
    } catch (err) {
      console.error('Error loading shift data:', err)
      showError('Shift Error', err instanceof Error ? err.message : 'Failed to load shift data')
    } finally {
      setIsLoading(false)
    }
  }

  const clockIn = async () => {
    try {
      const res = await fetch('/api/staff/my-shift', {
        method: 'POST',
        headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'clock_in' }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to clock in')

      setCurrentShift(data.currentShift)
      setIsClockedIn(true)
      success('Clocked In!', 'Your shift has started')
    } catch (err: any) {
      showError('Error', err.message || 'Failed to clock in')
    }
  }

  const clockOut = async () => {
    if (!currentShift) return

    try {
      const clockOut = new Date()
      const clockIn = new Date(currentShift.clock_in)
      const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)

      const res = await fetch('/api/staff/my-shift', {
        method: 'POST',
        headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'clock_out' }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to clock out')

      setCurrentShift(null)
      setIsClockedIn(false)
      setIsOnBreak(false)
      setBreakStartedAt(null)
      setElapsedTime(0)
      success('Clocked Out!', `Shift complete: ${(data.completedShift?.total_hours || totalHours).toFixed(1)} hours`)
      setShiftHistory(data.history || [])
    } catch (err: any) {
      showError('Error', err.message || 'Failed to clock out')
    }
  }

  const startBreak = async () => {
    if (!currentShift) return

    try {
      setIsOnBreak(true)
      setBreakStartedAt(Date.now())
      success('Break Started', 'Enjoy your break!')
    } catch (err: any) {
      showError('Error', err.message || 'Failed to start break')
    }
  }

  const endBreak = async () => {
    if (!currentShift) return

    try {
      const minutes = Math.max(1, Math.round((Date.now() - (breakStartedAt || Date.now())) / 60000))
      const res = await fetch('/api/staff/my-shift', {
        method: 'POST',
        headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'add_break_minutes', minutes }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to end break')

      setIsOnBreak(false)
      setBreakStartedAt(null)
      setCurrentShift(data.currentShift)
      success('Break Ended', 'Back to work!')
    } catch (err: any) {
      showError('Error', err.message || 'Failed to end break')
    }
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}m`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading shift data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030303] text-[var(--text-primary)] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black">
          My <span className="text-brand">Shift</span>
        </h1>
        <p className="text-sm text-[var(--text-muted)]">Track your working hours</p>
      </div>

      {/* Current Shift */}
      <div className="max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "p-8 rounded-3xl border text-center",
            isClockedIn
              ? isOnBreak
                ? "bg-amber-500/5 border-amber-500/20"
                : "bg-emerald-500/5 border-emerald-500/20"
              : "bg-[var(--surface-raised)]/50 border-white/10"
          )}
        >
          <div className={cn(
            "w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6",
            isClockedIn
              ? isOnBreak ? "bg-amber-500/20" : "bg-emerald-500/20"
              : "bg-[var(--surface-active)]"
          )}>
            {isClockedIn ? (
              isOnBreak ? (
                <Coffee className="w-12 h-12 text-amber-400" />
              ) : (
                <Timer className="w-12 h-12 text-emerald-400" />
              )
            ) : (
              <Clock className="w-12 h-12 text-[var(--text-muted)]" />
            )}
          </div>

          {isClockedIn ? (
            <>
              <Badge className={cn(
                "mb-4",
                isOnBreak
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              )}>
                {isOnBreak ? 'On Break' : 'Working'}
              </Badge>
              <p className="text-5xl font-black tabular-nums mb-2">
                {formatTime(elapsedTime)}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Started at {new Date(currentShift!.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-2">Not Clocked In</h2>
              <p className="text-[var(--text-muted)] text-sm">Tap below to start your shift</p>
            </>
          )}

          {/* Actions */}
          <div className="mt-8 space-y-3">
            {!isClockedIn ? (
              <button
                onClick={clockIn}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl font-bold flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Clock In
              </button>
            ) : (
              <>
                {!isOnBreak ? (
                  <button
                    onClick={startBreak}
                    className="w-full py-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-colors"
                  >
                    <Coffee className="w-5 h-5" />
                    Take Break
                  </button>
                ) : (
                  <button
                    onClick={endBreak}
                    className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-colors"
                  >
                    <Play className="w-5 h-5" />
                    End Break
                  </button>
                )}
                <button
                  onClick={clockOut}
                  className="w-full py-4 bg-gradient-to-r from-rose-500 to-red-600 rounded-2xl font-bold flex items-center justify-center gap-2"
                >
                  <Square className="w-5 h-5" />
                  Clock Out
                </button>
              </>
            )}
          </div>
        </motion.div>

        {/* Shift History */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-[var(--text-muted)]" />
            <h3 className="font-bold">Recent Shifts</h3>
          </div>
          <div className="space-y-2">
            {shiftHistory.map(shift => (
              <div key={shift.id} className="p-4 bg-[var(--surface-raised)]/50 border border-white/10 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--surface-active)] rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {new Date(shift.clock_in).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(shift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.clock_out!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <Badge className="bg-[var(--surface-active)] text-[var(--text-secondary)] border-[var(--border-strong)]">
                  {formatDuration(shift.total_hours || 0)}
                </Badge>
              </div>
            ))}
            {shiftHistory.length === 0 && (
              <p className="text-center text-[var(--text-muted)] py-4">No previous shifts</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
