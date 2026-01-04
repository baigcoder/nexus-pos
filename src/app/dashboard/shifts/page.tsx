'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Clock,
    Calendar,
    Users,
    Play,
    Square,
    Coffee,
    ChevronLeft,
    ChevronRight,
    Plus,
    CheckCircle2,
    AlertCircle,
    Timer
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
    role?: string
    shift_date: string
    clock_in: string | null
    clock_out: string | null
    scheduled_start: string | null
    scheduled_end: string | null
    status: 'scheduled' | 'active' | 'completed' | 'absent'
    break_minutes: number
    notes: string | null
}

const today = new Date().toISOString().split('T')[0]

export default function ShiftsPage() {
    const { restaurant } = useAuthStore()
    const { success, error: showError } = useToast()
    const [shifts, setShifts] = useState<Shift[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(today)
    const [showAddModal, setShowAddModal] = useState(false)

    // Fetch from Supabase
    useEffect(() => {
        async function loadShifts() {
            if (!restaurant?.id) return
            setIsLoading(true)
            try {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from('shifts')
                    .select('*, staff:staff_id(name, role)')
                    .eq('restaurant_id', restaurant.id)
                    .eq('shift_date', selectedDate)
                    .order('scheduled_start')

                if (error) throw error
                setShifts((data || []).map((s: any) => ({
                    ...s,
                    staff_name: s.staff?.name || 'Unknown',
                    role: s.staff?.role || 'Staff'
                })))
            } catch (err) {
                showError('Error', 'Failed to load shifts')
            } finally {
                setIsLoading(false)
            }
        }
        loadShifts()
    }, [restaurant?.id, selectedDate])

    const activeShifts = shifts.filter(s => s.status === 'active').length
    const completedShifts = shifts.filter(s => s.status === 'completed').length
    const scheduledShifts = shifts.filter(s => s.status === 'scheduled').length
    const totalHours = shifts.reduce((sum, s) => {
        if (s.clock_out && s.clock_in) {
            const start = parseInt(s.clock_in.split(':')[0])
            const end = parseInt(s.clock_out.split(':')[0])
            return sum + (end - start)
        }
        return sum
    }, 0)

    const handleClockIn = async (id: string) => {
        try {
            const supabase = createClient()
            const now = new Date().toTimeString().slice(0, 5)
            const { error } = await supabase
                .from('shifts')
                .update({ status: 'active', clock_in: now })
                .eq('id', id)

            if (error) throw error
            setShifts(shifts.map(s => s.id === id ? { ...s, status: 'active' as const, clock_in: now } : s))
            success('Clocked In', 'Shift started')
        } catch (err) {
            showError('Error', 'Failed to clock in')
        }
    }

    const handleClockOut = async (id: string) => {
        try {
            const supabase = createClient()
            const now = new Date().toTimeString().slice(0, 5)
            const { error } = await supabase
                .from('shifts')
                .update({ status: 'completed', clock_out: now })
                .eq('id', id)

            if (error) throw error
            setShifts(shifts.map(s => s.id === id ? { ...s, status: 'completed' as const, clock_out: now } : s))
            success('Clocked Out', 'Shift ended')
        } catch (err) {
            showError('Error', 'Failed to clock out')
        }
    }

    const handleBreak = async (id: string) => {
        try {
            const shift = shifts.find(s => s.id === id)
            if (!shift) return

            const supabase = createClient()
            const { error } = await supabase
                .from('shifts')
                .update({ break_minutes: shift.break_minutes + 15 })
                .eq('id', id)

            if (error) throw error
            setShifts(shifts.map(s => s.id === id ? { ...s, break_minutes: s.break_minutes + 15 } : s))
            success('Break Added', '15 min break logged')
        } catch (err) {
            showError('Error', 'Failed to add break')
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
            case 'completed': return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30'
            case 'scheduled': return 'bg-blue-500/20 text-blue-500 border-blue-500/30'
            case 'absent': return 'bg-rose-500/20 text-rose-500 border-rose-500/30'
            default: return 'bg-neutral-800 text-neutral-500'
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
                        <Badge variant="outline" className="bg-cyan-600/10 text-cyan-500 border-cyan-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            <Clock className="w-3 h-3 mr-1" /> Shift Management
                        </Badge>
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white uppercase">
                        Staff <span className="text-cyan-500">Shifts</span>
                    </h1>
                    <p className="text-neutral-400 text-lg font-medium">
                        <span className="text-white font-bold">{activeShifts} active</span> • {completedShifts} completed • {scheduledShifts} scheduled
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2 px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                        <button className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-neutral-500 hover:text-white transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="font-bold text-white px-4">
                            {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <button className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-neutral-500 hover:text-white transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <Button onClick={() => setShowAddModal(true)} icon={Plus} className="h-14 px-10 bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase tracking-widest text-xs">
                        Add Shift
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Active Now', value: activeShifts, icon: Play, color: 'text-emerald-500' },
                    { label: 'Completed', value: completedShifts, icon: CheckCircle2, color: 'text-neutral-400' },
                    { label: 'Scheduled', value: scheduledShifts, icon: Calendar, color: 'text-blue-500' },
                    { label: 'Total Hours', value: totalHours, icon: Timer, color: 'text-cyan-500' },
                ].map((stat, idx) => (
                    <motion.div key={idx} variants={item}>
                        <Card className="p-5 bg-neutral-900 border-neutral-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">{stat.label}</p>
                                    <h3 className={cn("text-2xl font-bold", stat.color)}>{stat.value}</h3>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-neutral-600">
                                    <stat.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Shifts List */}
            <div className="space-y-4">
                {shifts.map((shift) => (
                    <motion.div key={shift.id} variants={item}>
                        <Card className="p-6 bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-all">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="flex items-center gap-6">
                                    <div className={cn(
                                        "w-14 h-14 rounded-xl flex items-center justify-center",
                                        shift.status === 'active' ? 'bg-emerald-500/20' : 'bg-neutral-800'
                                    )}>
                                        <span className={cn(
                                            "text-lg font-bold",
                                            shift.status === 'active' ? 'text-emerald-500' : 'text-neutral-500'
                                        )}>
                                            {(shift.staff_name || 'Unknown').split(' ').map(n => n[0]).join('')}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-bold text-white">{shift.staff_name || 'Unknown'}</h3>
                                            <Badge className={cn("font-bold text-[10px] uppercase tracking-widest border", getStatusColor(shift.status))}>
                                                {shift.status}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                                            <span>{shift.role}</span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {shift.scheduled_start || shift.clock_in || '--:--'} - {shift.clock_out || 'Now'}
                                            </span>
                                            {shift.break_minutes > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <Coffee className="w-3 h-3" />
                                                    {shift.break_minutes}min break
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {shift.status === 'scheduled' && (
                                        <Button
                                            size="sm"
                                            icon={Play}
                                            onClick={() => handleClockIn(shift.id)}
                                            className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-widest"
                                        >
                                            Clock In
                                        </Button>
                                    )}
                                    {shift.status === 'active' && (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                icon={Coffee}
                                                onClick={() => handleBreak(shift.id)}
                                                className="h-10 px-4 border-neutral-800 text-neutral-500 font-bold text-[10px] uppercase tracking-widest"
                                            >
                                                Break
                                            </Button>
                                            <Button
                                                size="sm"
                                                icon={Square}
                                                onClick={() => handleClockOut(shift.id)}
                                                className="h-10 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] uppercase tracking-widest"
                                            >
                                                Clock Out
                                            </Button>
                                        </>
                                    )}
                                    {shift.status === 'completed' && (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-neutral-800 rounded-lg">
                                            <CheckCircle2 className="w-4 h-4 text-neutral-500" />
                                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                                {shift.clock_out && shift.clock_in ? (parseInt(shift.clock_out.split(':')[0]) - parseInt(shift.clock_in.split(':')[0])) : 0}h worked
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Add Shift Modal */}
            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Schedule Shift" size="md">
                <AddShiftForm onSuccess={() => { setShowAddModal(false); success('Scheduled', 'Shift added') }} onCancel={() => setShowAddModal(false)} />
            </Modal>
        </motion.div>
    )
}

function AddShiftForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
    const [form, setForm] = useState({ staff: '', date: today, startTime: '09:00', endTime: '17:00' })

    const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm({ ...form, [field]: e.target.value })
    }

    return (
        <div className="space-y-6 py-4">
            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Staff Member</label>
                    <select
                        value={form.staff}
                        onChange={handleChange('staff')}
                        className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white focus:border-cyan-600 outline-none appearance-none"
                    >
                        <option value="">Select staff...</option>
                        <option value="1">Ahmed Khan - Waiter</option>
                        <option value="2">Sara Ali - Cashier</option>
                        <option value="3">Bilal Hassan - Kitchen</option>
                        <option value="4">Fatima Zahra - Waiter</option>
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Date</label>
                    <input
                        type="date"
                        value={form.date}
                        onChange={handleChange('date')}
                        className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white focus:border-cyan-600 outline-none"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Start Time</label>
                        <input
                            type="time"
                            value={form.startTime}
                            onChange={handleChange('startTime')}
                            className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white focus:border-cyan-600 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">End Time</label>
                        <input
                            type="time"
                            value={form.endTime}
                            onChange={handleChange('endTime')}
                            className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white focus:border-cyan-600 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <Button variant="outline" onClick={onCancel} className="flex-1 h-14 border-neutral-800 text-neutral-500">
                    Cancel
                </Button>
                <Button
                    onClick={onSuccess}
                    disabled={!form.staff}
                    className="flex-1 h-14 bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase tracking-widest text-xs"
                >
                    Schedule Shift
                </Button>
            </div>
        </div>
    )
}
