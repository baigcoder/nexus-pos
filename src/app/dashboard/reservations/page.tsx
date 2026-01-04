'use client'

import { useState, useEffect } from 'react'
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
    MapPin
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
    pending: { label: 'Pending', color: 'text-orange-500', bg: 'bg-orange-500/10' },
    confirmed: { label: 'Confirmed', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    seated: { label: 'Seated', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    completed: { label: 'Completed', color: 'text-neutral-500', bg: 'bg-neutral-500/10' },
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

    const today = new Date().toISOString().split('T')[0]

    // Fetch from Supabase
    useEffect(() => {
        async function loadReservations() {
            if (!restaurant?.id) return
            setIsLoading(true)
            try {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from('reservations')
                    .select('*, table:tables(table_number)')
                    .eq('restaurant_id', restaurant.id)
                    .order('reservation_date')
                    .order('reservation_time')

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
        }
        loadReservations()
    }, [restaurant?.id])

    const todayReservations = reservations.filter(r => r.reservation_date === today)
    const confirmedCount = reservations.filter(r => r.status === 'confirmed').length

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
                        <Badge variant="outline" className="bg-purple-600/10 text-purple-500 border-purple-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            ● Bookings
                        </Badge>
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white uppercase">
                        Table <span className="text-purple-500">Reservations</span>
                    </h1>
                    <p className="text-neutral-400 text-lg font-medium">
                        <span className="text-white font-bold">{todayReservations.length} reservations</span> for today
                    </p>
                </div>
                <Button onClick={() => setShowModal(true)} icon={Plus} className="h-14 px-10 bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest text-xs">
                    New Reservation
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Today', value: todayReservations.length, icon: CalendarDays, color: 'text-purple-500' },
                    { label: 'Confirmed', value: confirmedCount, icon: CheckCircle2, color: 'text-emerald-500' },
                    { label: 'Total Guests', value: todayReservations.reduce((s, r) => s + r.party_size, 0), icon: Users, color: 'text-blue-500' },
                    { label: 'Pending', value: reservations.filter(r => r.status === 'pending').length, icon: Clock, color: 'text-orange-500' },
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

            {/* Filters */}
            <div className="flex gap-2">
                {(['today', 'upcoming', 'all'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            'h-12 px-6 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all',
                            filter === f ? 'bg-purple-600 text-white border-purple-600' : 'bg-black text-neutral-500 border-neutral-800 hover:border-neutral-700'
                        )}
                    >
                        {f === 'today' ? "Today's" : f === 'upcoming' ? 'Upcoming' : 'All'}
                    </button>
                ))}
            </div>

            {/* Reservations List */}
            <div className="space-y-4">
                {reservations.map((res) => (
                    <motion.div key={res.id} variants={item}>
                        <Card className="p-6 bg-neutral-900 border-neutral-800 hover:border-purple-500/30 transition-all">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 rounded-2xl bg-purple-600/20 text-purple-500 flex items-center justify-center font-bold text-xl">
                                        {res.party_size}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{res.customer_name}</h3>
                                        <div className="flex items-center gap-4 mt-1 text-neutral-500 text-sm">
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
                                            <p className="text-[10px] text-orange-500 font-bold mt-2 uppercase tracking-widest">
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
                                        <Button onClick={() => handleStatusChange(res.id, 'seated')} className="h-10 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase">
                                            Seat Guest
                                        </Button>
                                    )}
                                    {res.status === 'pending' && (
                                        <Button onClick={() => handleStatusChange(res.id, 'confirmed')} className="h-10 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase">
                                            Confirm
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    )
}
