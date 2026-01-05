'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Truck,
    MapPin,
    Phone,
    User,
    Clock,
    Plus,
    CheckCircle2,
    XCircle,
    Navigation,
    Package,
    Zap,
    Star,
    Activity,
    Search,
    Filter,
    MoreVertical,
    Edit,
    Trash2,
    Power
} from 'lucide-react'
import { Card, Button, Badge, Modal, LoadingSpinner } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'

// Rider status types
type RiderStatus = 'online' | 'offline' | 'busy'

interface Rider {
    id: string
    name: string
    phone: string
    status: RiderStatus
    currentLocation?: { lat: number; lng: number }
    activeDeliveries: number
    totalDeliveries: number
    rating: number
    createdAt: string
}

const statusConfig: Record<RiderStatus, { label: string; color: string; bg: string; dot: string }> = {
    online: { label: 'Available', color: 'text-emerald-500', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
    offline: { label: 'Offline', color: 'text-neutral-500', bg: 'bg-neutral-800', dot: 'bg-neutral-500' },
    busy: { label: 'On Delivery', color: 'text-purple-500', bg: 'bg-purple-500/10', dot: 'bg-purple-500' },
}

export default function RidersPage() {
    const { restaurant } = useAuthStore()
    const { success, error: showError } = useToast()
    const supabase = createClient()

    const [isLoading, setIsLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<RiderStatus | 'all'>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedRider, setSelectedRider] = useState<Rider | null>(null)
    const [riders, setRiders] = useState<Rider[]>([])

    useEffect(() => {
        if (restaurant?.id) {
            fetchRiders()
        }
    }, [restaurant?.id])

    const fetchRiders = async () => {
        setIsLoading(true)
        try {
            // Fetch staff with role 'delivery' from database
            const { data, error } = await supabase
                .from('staff')
                .select('*')
                .eq('restaurant_id', restaurant!.id)
                .eq('role', 'delivery')
                .order('created_at', { ascending: false })

            if (error) throw error

            // Map staff data to Rider interface
            const riderData: Rider[] = (data || []).map((staff: any) => ({
                id: staff.id,
                name: staff.name,
                phone: staff.phone || 'N/A',
                status: staff.is_active ? 'online' : 'offline' as RiderStatus,
                activeDeliveries: 0, // Would come from orders table
                totalDeliveries: 0, // Would come from orders count
                rating: 5.0, // Would come from reviews
                createdAt: staff.created_at,
            }))

            setRiders(riderData)
        } catch (err: any) {
            console.error('Error fetching riders:', err)
            showError('Error', 'Failed to load riders')
        } finally {
            setIsLoading(false)
        }
    }

    const filteredRiders = riders.filter(rider => {
        if (statusFilter !== 'all' && rider.status !== statusFilter) return false
        if (searchQuery && !rider.name.toLowerCase().includes(searchQuery.toLowerCase()) && !rider.phone.includes(searchQuery)) return false
        return true
    })

    const stats = {
        total: riders.length,
        online: riders.filter(r => r.status === 'online').length,
        busy: riders.filter(r => r.status === 'busy').length,
        offline: riders.filter(r => r.status === 'offline').length,
    }

    const toggleRiderStatus = async (riderId: string) => {
        try {
            const rider = riders.find(r => r.id === riderId)
            if (!rider) return

            const newStatus = rider.status === 'online' ? false : true

            const { error } = await supabase
                .from('staff')
                .update({ is_active: newStatus })
                .eq('id', riderId)

            if (error) throw error

            setRiders(prev => prev.map(r => {
                if (r.id === riderId) {
                    return { ...r, status: newStatus ? 'online' : 'offline' as RiderStatus }
                }
                return r
            }))
            success('Status Updated', 'Rider status has been changed')
        } catch (err: any) {
            showError('Error', err.message || 'Failed to update status')
        }
    }

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
    }

    const itemVariant = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
    }

    return (
        <div className="min-h-screen pb-20">
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-10">

                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <motion.div variants={itemVariant} className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-xl shadow-purple-600/30">
                                <Truck className="w-5 h-5 text-white" />
                            </div>
                            <Badge variant="outline" className="border-purple-600/20 text-purple-600 bg-purple-600/5 px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                                DELIVERY FLEET
                            </Badge>
                        </motion.div>
                        <motion.h1 variants={itemVariant} className="text-4xl lg:text-6xl font-display font-bold text-white tracking-tight uppercase">
                            Rider <span className="text-purple-500">Management</span>
                        </motion.h1>
                        <motion.p variants={itemVariant} className="text-neutral-500 text-lg font-medium max-w-xl">
                            Manage your delivery riders, track availability, and monitor performance.
                        </motion.p>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Riders', value: stats.total, icon: User, color: 'text-white', glow: '' },
                        { label: 'Available', value: stats.online, icon: CheckCircle2, color: 'text-emerald-500', glow: 'shadow-emerald-500/10' },
                        { label: 'On Delivery', value: stats.busy, icon: Truck, color: 'text-purple-500', glow: 'shadow-purple-500/10' },
                        { label: 'Offline', value: stats.offline, icon: XCircle, color: 'text-neutral-500', glow: '' },
                    ].map((stat, idx) => (
                        <motion.div key={idx} variants={itemVariant}>
                            <Card className={cn(
                                "group p-5 bg-neutral-950 border-neutral-900 hover:border-neutral-800 transition-all rounded-2xl",
                                stat.glow
                            )}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-black border border-neutral-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <stat.icon className={cn("w-5 h-5", stat.color)} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">{stat.label}</p>
                                        <h3 className="text-2xl font-black text-white">{stat.value}</h3>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Filter Bar */}
                <motion.div variants={itemVariant} className="flex flex-wrap items-center gap-4 p-5 bg-neutral-950/50 backdrop-blur-xl rounded-2xl border border-neutral-900">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-purple-500 transition-colors" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name or phone..."
                            className="w-full bg-black border border-neutral-800 rounded-xl pl-12 pr-4 py-3 text-sm font-medium text-white placeholder:text-neutral-600 focus:border-purple-500/50 focus:outline-none transition-all"
                        />
                    </div>

                    <div className="flex gap-2">
                        {(['all', 'online', 'busy', 'offline'] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={cn(
                                    "px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                    statusFilter === status
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-black border-neutral-800 text-neutral-500 hover:border-neutral-700'
                                )}
                            >
                                {status === 'all' ? 'All' : statusConfig[status].label}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Riders Grid */}
                {isLoading ? (
                    <div className="flex justify-center py-20"><LoadingSpinner /></div>
                ) : filteredRiders.length === 0 ? (
                    <Card className="p-20 bg-neutral-900/30 border-neutral-800/50 text-center rounded-[2rem] border-dashed">
                        <User className="w-16 h-16 text-neutral-800 mx-auto mb-6" />
                        <h3 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">No Riders</h3>
                        <p className="text-neutral-500 text-lg max-w-sm mx-auto leading-relaxed">
                            {searchQuery || statusFilter !== 'all' ? 'No riders match your filter.' : 'Add your first delivery rider to get started.'}
                        </p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredRiders.map((rider) => {
                            const statusCfg = statusConfig[rider.status]

                            return (
                                <motion.div key={rider.id} variants={itemVariant} layout>
                                    <Card className="group p-0 bg-neutral-950 border-neutral-900 hover:border-neutral-800 transition-all rounded-[2rem] overflow-hidden">
                                        {/* Header */}
                                        <div className="p-6 border-b border-neutral-900 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-bold text-xl shadow-xl">
                                                        {rider.name.charAt(0)}
                                                    </div>
                                                    <div className={cn(
                                                        "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-neutral-950",
                                                        statusCfg.dot
                                                    )} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-white text-lg">{rider.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Phone className="w-3 h-3 text-neutral-600" />
                                                        <span className="text-xs text-neutral-500">{rider.phone}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest",
                                                statusCfg.bg, statusCfg.color
                                            )}>
                                                {statusCfg.label}
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="p-6 grid grid-cols-3 gap-4">
                                            <div className="text-center">
                                                <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Active</p>
                                                <p className="text-xl font-black text-white">{rider.activeDeliveries}</p>
                                            </div>
                                            <div className="text-center border-x border-neutral-900">
                                                <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Total</p>
                                                <p className="text-xl font-black text-white">{rider.totalDeliveries}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Rating</p>
                                                <div className="flex items-center justify-center gap-1">
                                                    <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                                                    <span className="text-xl font-black text-white">{rider.rating}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="p-6 bg-black/20 border-t border-neutral-900 flex gap-3">
                                            <Button
                                                variant="outline"
                                                className="flex-1 h-12 rounded-xl border-neutral-800 text-neutral-500 font-bold uppercase tracking-widest text-[10px] hover:text-white"
                                                onClick={() => setSelectedRider(rider)}
                                            >
                                                <MapPin className="w-4 h-4 mr-2" />
                                                Track
                                            </Button>
                                            <Button
                                                className={cn(
                                                    "flex-1 h-12 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all",
                                                    rider.status === 'online'
                                                        ? 'bg-neutral-800 hover:bg-neutral-700 text-white'
                                                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                                )}
                                                onClick={() => toggleRiderStatus(rider.id)}
                                                disabled={rider.status === 'busy'}
                                            >
                                                <Power className="w-4 h-4 mr-2" />
                                                {rider.status === 'online' ? 'Go Offline' : 'Go Online'}
                                            </Button>
                                        </div>
                                    </Card>
                                </motion.div>
                            )
                        })}
                    </div>
                )}

                {/* Rider Detail Modal */}
                <Modal
                    isOpen={!!selectedRider}
                    onClose={() => setSelectedRider(null)}
                    title={`RIDER: ${selectedRider?.name}`}
                    size="lg"
                >
                    {selectedRider && (
                        <div className="space-y-6 p-2">
                            <div className="p-6 bg-black rounded-2xl border border-neutral-900 text-center">
                                <MapPin className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-white mb-2">Live Tracking Coming Soon</h3>
                                <p className="text-neutral-500 text-sm">
                                    Real-time GPS tracking will be available in the next update.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full h-14 rounded-2xl border-neutral-800 text-neutral-400 font-bold uppercase tracking-widest text-xs"
                                onClick={() => setSelectedRider(null)}
                            >
                                Close
                            </Button>
                        </div>
                    )}
                </Modal>
            </motion.div>
        </div>
    )
}
