'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Store,
  DollarSign,
  ShoppingBag,
  Users,
  MapPin,
  ArrowUpRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface LocationStats {
  id: string
  name: string
  slug: string
  address: string | null
  isActive: boolean
  todayRevenue: number
  todayOrders: number
  activeStaff: number
  status: 'open' | 'closed' | 'busy'
}

interface FranchiseLocation {
  id: string
  name: string
  slug: string
  address: string | null
  isActive: boolean
  operatingHours: unknown
}

export default function FranchiseDashboardPage() {
  const [locations, setLocations] = useState<LocationStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totals, setTotals] = useState({ revenue: 0, orders: 0, staff: 0 })
  const { user, setRestaurant, setUserRole } = useAuthStore()
  const router = useRouter()

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
          slug,
          address,
          is_active,
          operating_hours
        )
      `)
      .eq('user_id', user.id)
      .in('role', ['owner', 'manager'])

    if (!staffRecords) {
      setIsLoading(false)
      return
    }

    const restaurants = staffRecords
      .filter((s: any) => s.restaurants)
      .map((s: any) => ({
        id: s.restaurants.id as string,
        name: s.restaurants.name as string,
        slug: s.restaurants.slug as string,
        address: s.restaurants.address as string | null,
        isActive: s.restaurants.is_active as boolean,
        operatingHours: s.restaurants.operating_hours,
      }))
      .filter((r: FranchiseLocation, i: number, arr: FranchiseLocation[]) => arr.findIndex((x: FranchiseLocation) => x.id === r.id) === i)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayStartIso = todayStart.toISOString()

    // Fetch real per-location stats in parallel
    const locationData: LocationStats[] = await Promise.all(
      restaurants.map(async (r: FranchiseLocation) => {
        const [ordersRes, staffRes, activeOrdersRes] = await Promise.all([
          supabase
            .from('orders')
            .select('total, status')
            .eq('restaurant_id', r.id)
            .gte('created_at', todayStartIso)
            .neq('status', 'cancelled'),
          supabase
            .from('staff')
            .select('id', { count: 'exact', head: true })
            .eq('restaurant_id', r.id)
            .eq('is_active', true),
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('restaurant_id', r.id)
            .in('status', ['pending', 'preparing', 'ready']),
        ])

        const orders = ordersRes.data || []
        const paidRevenue = orders
          .filter((o: { status?: string }) => o.status === 'paid' || o.status === 'served')
          .reduce((sum: number, o: { total?: number | null }) => sum + (o.total || 0), 0)
        const activeOrderCount = activeOrdersRes.count || 0

        return {
          id: r.id,
          name: r.name,
          slug: r.slug,
          address: r.address,
          isActive: r.isActive,
          todayRevenue: paidRevenue,
          todayOrders: orders.length,
          activeStaff: staffRes.count || 0,
          status: !r.isActive ? 'closed' : activeOrderCount >= 10 ? 'busy' : 'open',
        }
      })
    )

    setLocations(locationData)
    setTotals({
      revenue: locationData.reduce((sum, l) => sum + l.todayRevenue, 0),
      orders: locationData.reduce((sum, l) => sum + l.todayOrders, 0),
      staff: locationData.reduce((sum, l) => sum + l.activeStaff, 0),
    })
    setIsLoading(false)
  }

  function viewLocation(location: LocationStats) {
    setRestaurant({
      id: location.id,
      name: location.name,
      slug: location.slug,
      address: location.address,
      is_active: location.isActive,
    } as any)
    setUserRole('owner')
    router.push('/dashboard')
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
        <div className="w-8 h-8 border-4 border-brand/20 border-t-purple-500 rounded-full animate-spin" />
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
          <Badge variant="outline" className="bg-brand-subtle text-brand border-brand/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
            Franchise Overview
          </Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] uppercase">
          All <span className="text-brand">Locations</span>
        </h1>
        <p className="text-[var(--text-muted)] mt-2">
          Managing <span className="text-[var(--text-primary)] font-bold">{locations.length} restaurants</span> across your franchise
        </p>
      </div>

      {/* Total Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Revenue Today', value: `Rs.${Math.round(totals.revenue).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
          { label: 'Total Orders', value: totals.orders.toString(), icon: ShoppingBag, color: 'text-brand', bgColor: 'bg-brand-subtle' },
          { label: 'Active Staff', value: totals.staff.toString(), icon: Users, color: 'text-brand', bgColor: 'bg-brand-subtle' },
        ].map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Card className={cn("p-6 border-[var(--border)]", stat.bgColor, "bg-opacity-50")}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">{stat.label}</p>
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
            <Card className="p-6 bg-[var(--surface-raised)] border-[var(--border)] hover:border-[var(--border-strong)] transition-all group cursor-pointer">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Store className="w-6 h-6 text-brand" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)] text-lg">{location.name}</h3>
                    {location.address && (
                      <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {location.address}
                      </p>
                    )}
                  </div>
                </div>
                <Badge className={cn(
                  "font-bold text-[10px] px-2 py-1",
                  location.status === 'open' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                  location.status === 'busy' && "bg-brand-subtle text-brand border-brand/20",
                  location.status === 'closed' && "bg-[var(--surface-hover)]0/10 text-[var(--text-muted)] border-[var(--border)]"
                )}>
                  {location.status.charAt(0).toUpperCase() + location.status.slice(1)}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-[var(--surface)]/30 rounded-xl">
                  <DollarSign className="w-4 h-4 text-emerald-500 mx-auto mb-2" />
                  <p className="text-lg font-bold text-[var(--text-primary)]">Rs.{Math.round(location.todayRevenue / 1000)}K</p>
                  <p className="text-[9px] text-[var(--text-muted)] uppercase">Revenue</p>
                </div>
                <div className="text-center p-3 bg-[var(--surface)]/30 rounded-xl">
                  <ShoppingBag className="w-4 h-4 text-brand mx-auto mb-2" />
                  <p className="text-lg font-bold text-[var(--text-primary)]">{location.todayOrders}</p>
                  <p className="text-[9px] text-[var(--text-muted)] uppercase">Orders</p>
                </div>
                <div className="text-center p-3 bg-[var(--surface)]/30 rounded-xl">
                  <Users className="w-4 h-4 text-brand mx-auto mb-2" />
                  <p className="text-lg font-bold text-[var(--text-primary)]">{location.activeStaff}</p>
                  <p className="text-[9px] text-[var(--text-muted)] uppercase">Staff</p>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => viewLocation(location)}
                className="w-full h-12 border-[var(--border)] text-[var(--text-muted)] hover:border-brand hover:text-brand transition-all group-hover:border-brand/50"
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
