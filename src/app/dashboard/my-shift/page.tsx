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
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Shift {
    id: string
    clock_in: string
    clock_out?: string
    break_start?: string
    break_end?: string
    total_hours?: number
}

export default function MyShiftPage() {
    const { restaurant, staff } = useAuthStore()
    const { success, error: showError } = useToast()
    const supabase = createClient()

    const [currentShift, setCurrentShift] = useState<Shift | null>(null)
    const [shiftHistory, setShiftHistory] = useState<Shift[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isClockedIn, setIsClockedIn] = useState(false)
    const [isOnBreak, setIsOnBreak] = useState(false)
    const [elapsedTime, setElapsedTime] = useState(0)

    useEffect(() => {
        if (restaurant?.id && staff?.id) {
            loadShiftData()
        }
    }, [restaurant?.id, staff?.id])

    useEffect(() => {
        let interval: NodeJS.Timeout
        if (isClockedIn && currentShift && !isOnBreak) {
            interval = setInterval(() => {
                const start = new Date(currentShift.clock_in).getTime()
                const now = Date.now()
                setElapsedTime(Math.floor((now - start) / 1000))
            }, 1000)
        }
        return () => clearInterval(interval)
    }, [isClockedIn, currentShift, isOnBreak])

    async function loadShiftData() {
        setIsLoading(true)
        try {
            // Check for active shift
            const { data: activeShift } = await supabase
                .from('staff_shifts')
                .select('*')
                .eq('staff_id', staff!.id)
                .is('clock_out', null)
                .single()

            if (activeShift) {
                setCurrentShift(activeShift)
                setIsClockedIn(true)
                setIsOnBreak(!!activeShift.break_start && !activeShift.break_end)
            }

            // Load shift history
            const { data: history } = await supabase
                .from('staff_shifts')
                .select('*')
                .eq('staff_id', staff!.id)
                .not('clock_out', 'is', null)
                .order('clock_in', { ascending: false })
                .limit(10)

            if (history) {
                setShiftHistory(history)
            }
        } catch (err) {
            console.error('Error loading shift data:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const clockIn = async () => {
        try {
            const { data, error } = await supabase
                .from('staff_shifts')
                .insert({
                    staff_id: staff!.id,
                    restaurant_id: restaurant!.id,
                    clock_in: new Date().toISOString()
                })
                .select()
                .single()

            if (error) throw error

            setCurrentShift(data)
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

            const { error } = await supabase
                .from('staff_shifts')
                .update({
                    clock_out: clockOut.toISOString(),
                    total_hours: Math.round(totalHours * 100) / 100
                })
                .eq('id', currentShift.id)

            if (error) throw error

            setCurrentShift(null)
            setIsClockedIn(false)
            setElapsedTime(0)
            success('Clocked Out!', `Shift complete: ${totalHours.toFixed(1)} hours`)
            loadShiftData()
        } catch (err: any) {
            showError('Error', err.message || 'Failed to clock out')
        }
    }

    const startBreak = async () => {
        if (!currentShift) return

        try {
            const { error } = await supabase
                .from('staff_shifts')
                .update({ break_start: new Date().toISOString() })
                .eq('id', currentShift.id)

            if (error) throw error

            setIsOnBreak(true)
            success('Break Started', 'Enjoy your break!')
        } catch (err: any) {
            showError('Error', err.message || 'Failed to start break')
        }
    }

    const endBreak = async () => {
        if (!currentShift) return

        try {
            const { error } = await supabase
                .from('staff_shifts')
                .update({ break_end: new Date().toISOString() })
                .eq('id', currentShift.id)

            if (error) throw error

            setIsOnBreak(false)
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
                <div className="flex items-center gap-3 text-neutral-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Loading shift data...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#030303] text-white p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-black">
                    My <span className="text-orange-500">Shift</span>
                </h1>
                <p className="text-sm text-neutral-500">Track your working hours</p>
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
                            : "bg-neutral-900/50 border-white/10"
                    )}
                >
                    <div className={cn(
                        "w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6",
                        isClockedIn
                            ? isOnBreak ? "bg-amber-500/20" : "bg-emerald-500/20"
                            : "bg-neutral-800"
                    )}>
                        {isClockedIn ? (
                            isOnBreak ? (
                                <Coffee className="w-12 h-12 text-amber-400" />
                            ) : (
                                <Timer className="w-12 h-12 text-emerald-400" />
                            )
                        ) : (
                            <Clock className="w-12 h-12 text-neutral-500" />
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
                            <p className="text-sm text-neutral-500">
                                Started at {new Date(currentShift!.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </>
                    ) : (
                        <>
                            <h2 className="text-xl font-bold mb-2">Not Clocked In</h2>
                            <p className="text-neutral-500 text-sm">Tap below to start your shift</p>
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
                        <History className="w-5 h-5 text-neutral-500" />
                        <h3 className="font-bold">Recent Shifts</h3>
                    </div>
                    <div className="space-y-2">
                        {shiftHistory.map(shift => (
                            <div key={shift.id} className="p-4 bg-neutral-900/50 border border-white/10 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-neutral-800 rounded-lg flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-neutral-500" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">
                                            {new Date(shift.clock_in).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </p>
                                        <p className="text-xs text-neutral-500">
                                            {new Date(shift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.clock_out!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <Badge className="bg-neutral-800 text-neutral-300 border-neutral-700">
                                    {formatDuration(shift.total_hours || 0)}
                                </Badge>
                            </div>
                        ))}
                        {shiftHistory.length === 0 && (
                            <p className="text-center text-neutral-500 py-4">No previous shifts</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
