'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Store,
    TrendingUp,
    DollarSign,
    ShoppingBag,
    Users,
    BarChart3,
    MapPin,
    Clock,
    ArrowUpRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface LocationStats {
    id: string
    name: string
    address: string | null
    todayRevenue: number
    todayOrders: number
    activeStaff: number
    status: 'open' | 'closed' | 'busy'
}

export default function FranchiseDashboardPage() {
    const [locations, setLocations] = useState<LocationStats[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [totals, setTotals] = useState({ revenue: 0, orders: 0, staff: 0 })
    const { user } = useAuthStore()

    useEffect(() => {
        loadFranchiseData()
    }, [user])

    async function loadFranchiseData() {
        if (!user) return

        const supabase = createClient()

        // Get all restaurants user owns/manages
        const { data: staffRecords } = await supabase
            .from('staff')
            .select(`
                restaurant_id,
                role,
                restaurants (
                    id,
                    name,
                    address
                )
            `)
            .eq('user_id', user.id)
            .in('role', ['owner', 'manager'])

        if (!staffRecords) {
            setIsLoading(false)
            return
        }

        // Mock stats for now (real implementation would aggregate from orders)
        const locationData: LocationStats[] = staffRecords
            .filter((s: any) => s.restaurants)
            .map((s: any, i: number) => ({
                id: (s.restaurants as any).id,
                name: (s.restaurants as any).name,
                address: (s.restaurants as any).address,
                todayRevenue: 25000 + Math.random() * 50000,
                todayOrders: 45 + Math.floor(Math.random() * 100),
                activeStaff: 3 + Math.floor(Math.random() * 5),
                status: ['open', 'open', 'busy'][i % 3] as 'open' | 'closed' | 'busy',
            }))

        setLocations(locationData)
        setTotals({
            revenue: locationData.reduce((sum, l) => sum + l.todayRevenue, 0),
            orders: locationData.reduce((sum, l) => sum + l.todayOrders, 0),
            staff: locationData.reduce((sum, l) => sum + l.activeStaff, 0),
        })
        setIsLoading(false)
    }

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-10"
        >
            {/* Header */}
            <div>
                <div className="flex items-center gap-4 mb-3">
                    <Badge variant="outline" className="bg-purple-600/10 text-purple-500 border-purple-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                        Franchise Overview
                    </Badge>
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-white uppercase">
                    All <span className="text-purple-500">Locations</span>
                </h1>
                <p className="text-neutral-500 mt-2">
                    Managing <span className="text-white font-bold">{locations.length} restaurants</span> across your franchise
                </p>
            </div>

            {/* Total Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Revenue Today', value: `Rs.${Math.round(totals.revenue).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
                    { label: 'Total Orders', value: totals.orders.toString(), icon: ShoppingBag, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
                    { label: 'Active Staff', value: totals.staff.toString(), icon: Users, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
                ].map((stat) => (
                    <motion.div key={stat.label} variants={item}>
                        <Card className={cn("p-6 border-neutral-800", stat.bgColor, "bg-opacity-50")}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">{stat.label}</p>
                                    <p className={cn("text-4xl font-bold", stat.color)}>{stat.value}</p>
                                </div>
                                <stat.icon className={cn("w-12 h-12", stat.color, "opacity-20")} />
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Location Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {locations.map((location) => (
                    <motion.div key={location.id} variants={item}>
                        <Card className="p-6 bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-all group cursor-pointer">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                        <Store className="w-6 h-6 text-purple-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg">{location.name}</h3>
                                        {location.address && (
                                            <p className="text-[10px] text-neutral-500 flex items-center gap-1 mt-1">
                                                <MapPin className="w-3 h-3" />
                                                {location.address}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Badge className={cn(
                                    "font-bold text-[10px] px-2 py-1",
                                    location.status === 'open' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                                    location.status === 'busy' && "bg-orange-500/10 text-orange-500 border-orange-500/20",
                                    location.status === 'closed' && "bg-neutral-500/10 text-neutral-500 border-neutral-500/20"
                                )}>
                                    {location.status.charAt(0).toUpperCase() + location.status.slice(1)}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="text-center p-3 bg-black/30 rounded-xl">
                                    <DollarSign className="w-4 h-4 text-emerald-500 mx-auto mb-2" />
                                    <p className="text-lg font-bold text-white">Rs.{Math.round(location.todayRevenue / 1000)}K</p>
                                    <p className="text-[9px] text-neutral-500 uppercase">Revenue</p>
                                </div>
                                <div className="text-center p-3 bg-black/30 rounded-xl">
                                    <ShoppingBag className="w-4 h-4 text-purple-500 mx-auto mb-2" />
                                    <p className="text-lg font-bold text-white">{location.todayOrders}</p>
                                    <p className="text-[9px] text-neutral-500 uppercase">Orders</p>
                                </div>
                                <div className="text-center p-3 bg-black/30 rounded-xl">
                                    <Users className="w-4 h-4 text-orange-500 mx-auto mb-2" />
                                    <p className="text-lg font-bold text-white">{location.activeStaff}</p>
                                    <p className="text-[9px] text-neutral-500 uppercase">Staff</p>
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                className="w-full h-12 border-neutral-800 text-neutral-400 hover:border-purple-500 hover:text-purple-500 transition-all group-hover:border-purple-500/50"
                            >
                                View Dashboard <ArrowUpRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Card>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    )
}
