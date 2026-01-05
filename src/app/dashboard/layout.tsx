'use client'

import { useState, ReactNode, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    LayoutDashboard,
    UtensilsCrossed,
    Grid3X3,
    ClipboardList,
    ChefHat,
    Receipt,
    BarChart3,
    Users,
    Settings,
    LogOut,
    Menu,
    Bell,
    ChevronDown,
    Shield,
    Activity,
    Search,
    TrendingUp,
    Star,
    Truck,
    Award,
    QrCode,
    Clock,
    DollarSign,
    Tv,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { Button, PremiumLayout } from '@/components/ui/common'
import { ChatWidget } from '@/components/chat/ChatWidget'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

interface DashboardLayoutProps {
    children: ReactNode
}

const sidebarLinks: Array<{
    href: string
    label: string
    icon: any
    roles: UserRole[] | 'all'
    section?: string
}> = [
        // Owner/Manager Overview
        { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'manager'], section: 'main' },

        // Waiter Features
        { href: '/dashboard/waiter', label: 'Waiter Station', icon: Activity, roles: ['waiter'], section: 'main' },
        { href: '/dashboard/menu', label: 'Menu', icon: UtensilsCrossed, roles: ['owner', 'manager', 'waiter', 'cashier'], section: 'main' },
        { href: '/dashboard/take-order', label: 'Take Order', icon: ClipboardList, roles: ['waiter'], section: 'orders' },
        { href: '/dashboard/my-orders', label: 'My Orders', icon: ClipboardList, roles: ['waiter', 'kitchen'], section: 'orders' },
        { href: '/dashboard/tables', label: 'Tables', icon: Grid3X3, roles: ['owner', 'manager', 'waiter', 'cashier'], section: 'main' },
        { href: '/dashboard/kitchen-view', label: 'Kitchen View', icon: ChefHat, roles: ['waiter'], section: 'orders' },

        // Cashier Features
        { href: '/dashboard/cashier', label: 'Cashier Station', icon: Receipt, roles: ['cashier'], section: 'main' },
        { href: '/dashboard/billing', label: 'Billing', icon: Receipt, roles: ['owner', 'manager', 'cashier'], section: 'billing' },

        // Kitchen Features
        { href: '/dashboard/kitchen', label: 'Kitchen', icon: ChefHat, roles: ['owner', 'manager', 'kitchen'], section: 'main' },

        // Orders & Operations
        { href: '/dashboard/orders', label: 'Orders', icon: ClipboardList, roles: ['owner', 'manager', 'waiter', 'cashier'], section: 'orders' },
        { href: '/dashboard/order-desk', label: 'Order Desk', icon: Activity, roles: ['owner', 'manager'], section: 'orders' },
        { href: '/dashboard/specials', label: 'Specials', icon: Activity, roles: ['owner', 'manager'], section: 'menu' },

        // Delivery
        { href: '/dashboard/riders', label: 'Riders', icon: Truck, roles: ['owner', 'manager'], section: 'delivery' },
        { href: '/dashboard/delivery-monitor', label: 'Delivery Monitor', icon: Activity, roles: ['owner', 'manager'], section: 'delivery' },
        { href: '/dashboard/delivery-boy', label: 'My Deliveries', icon: Truck, roles: ['delivery'], section: 'main' },

        // Staff Tools (All Roles)
        { href: '/dashboard/my-shift', label: 'My Shift', icon: Clock, roles: ['waiter', 'cashier', 'kitchen', 'delivery'], section: 'staff' },
        { href: '/dashboard/tips', label: 'Tips', icon: DollarSign, roles: ['waiter', 'delivery', 'cashier'], section: 'staff' },


        // Management
        { href: '/dashboard/inventory', label: 'Inventory', icon: ClipboardList, roles: ['owner', 'manager'], section: 'management' },
        { href: '/dashboard/reservations', label: 'Reservations', icon: Users, roles: ['owner', 'manager'], section: 'management' },
        { href: '/dashboard/discounts', label: 'Discounts', icon: Receipt, roles: ['owner', 'manager'], section: 'management' },

        // Analytics & Reports
        { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, roles: ['owner', 'manager'], section: 'analytics' },
        { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, roles: ['owner', 'manager'], section: 'analytics' },

        // Staff Management
        { href: '/dashboard/staff', label: 'Staff', icon: Users, roles: ['owner', 'manager'], section: 'staff' },
        { href: '/dashboard/staff-performance', label: 'Performance', icon: TrendingUp, roles: ['owner', 'manager'], section: 'staff' },
        { href: '/dashboard/shifts', label: 'Shifts', icon: Clock, roles: ['owner', 'manager'], section: 'staff' },

        // Customer
        { href: '/dashboard/feedback', label: 'Feedback', icon: Star, roles: ['owner', 'manager'], section: 'customer' },
        { href: '/dashboard/loyalty', label: 'Loyalty', icon: Award, roles: ['owner', 'manager'], section: 'customer' },
        { href: '/dashboard/qr-ordering', label: 'QR Codes', icon: QrCode, roles: ['owner', 'manager'], section: 'customer' },

        // Finance
        { href: '/dashboard/expenses', label: 'Expenses', icon: DollarSign, roles: ['owner', 'manager'], section: 'finance' },

        // Settings
        { href: '/dashboard/display-manager', label: 'Display', icon: Tv, roles: ['owner', 'manager'], section: 'settings' },
        { href: '/dashboard/settings', label: 'Settings', icon: Settings, roles: ['owner', 'manager'], section: 'settings' },
    ]

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { success } = useToast()
    const { user, restaurant, userRole, staff, logout: logoutStore, setRestaurant, setUser, setUserRole } = useAuthStore()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isProfileOpen, setIsProfileOpen] = useState(false)

    const effectiveRole: UserRole = userRole || staff?.role || 'owner'

    // Auto-load restaurant if user is logged in but restaurant is not loaded
    useEffect(() => {
        const loadRestaurantContext = async () => {
            // Skip if already loaded or no user
            if (restaurant || staff) return

            const supabase = createClient()
            const { data: { user: authUser } } = await supabase.auth.getUser()

            if (!authUser) {
                router.push('/login')
                return
            }

            // Set user if missing
            if (!user) {
                // Google Auth stores name in different metadata fields
                const displayName = authUser.user_metadata?.full_name
                    || authUser.user_metadata?.name
                    || authUser.email?.split('@')[0]
                setUser({
                    id: authUser.id,
                    email: authUser.email!,
                    full_name: displayName,
                })
            }

            // Load restaurant for owner
            const { data: rest } = await supabase
                .from('restaurants')
                .select('*')
                .eq('owner_id', authUser.id)
                .single()

            if (rest) {
                setRestaurant(rest)
                setUserRole('owner')
            } else {
                router.push('/setup')
            }
        }

        loadRestaurantContext()
    }, [restaurant, user, staff, router, setRestaurant, setUser, setUserRole])

    const filteredLinks = sidebarLinks.filter(link => {
        if (link.roles === 'all') return true
        return link.roles.includes(effectiveRole)
    })

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        logoutStore()
        success('Logged Out', 'You have been successfully logged out.')
        router.push('/login')
    }


    return (
        <PremiumLayout fullWidth className="flex min-h-screen bg-black overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[60] lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <aside className={cn(`
                fixed top-0 left-0 bottom-0 w-72 z-[70]
                bg-neutral-950 border-r border-neutral-900
                transition-transform duration-500 ease-[0.16,1,0.3,1]
                flex flex-col overflow-hidden
                lg:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `)}>
                <div className="flex flex-col h-full p-8">
                    {/* Logo Section */}
                    <div className="mb-10 px-4">
                        <Link href="/dashboard" className="flex items-center gap-3 group">
                            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-xl shadow-orange-600/30 transition-transform duration-500 group-hover:scale-105">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <span className="font-display font-bold text-xl tracking-tight text-white uppercase">
                                Nexus <span className="text-orange-600">POS</span>
                            </span>
                        </Link>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
                        {/* Role Badge */}
                        <div className="mb-6 px-5">
                            <div className={cn(
                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border",
                                effectiveRole === 'owner' && 'bg-orange-600/10 text-orange-600 border-orange-600/20',
                                effectiveRole === 'manager' && 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                                effectiveRole === 'waiter' && 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                                effectiveRole === 'cashier' && 'bg-purple-500/10 text-purple-500 border-purple-500/20',
                                effectiveRole === 'kitchen' && 'bg-rose-500/10 text-rose-500 border-rose-500/20',
                            )}>
                                <div className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    effectiveRole === 'owner' && 'bg-orange-600',
                                    effectiveRole === 'manager' && 'bg-emerald-500',
                                    effectiveRole === 'waiter' && 'bg-blue-500',
                                    effectiveRole === 'cashier' && 'bg-purple-500',
                                    effectiveRole === 'kitchen' && 'bg-rose-500',
                                )} />
                                {effectiveRole}
                            </div>
                        </div>
                        <div className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-6 px-5">Main Navigation</div>
                        {filteredLinks.map((link) => {
                            const isActive = pathname === link.href
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setIsSidebarOpen(false)}
                                    className={cn(
                                        'flex items-center gap-3 px-5 py-3 rounded-xl transition-all font-bold text-xs tracking-wider group relative overflow-hidden',
                                        isActive
                                            ? 'bg-white text-neutral-900 shadow-lg'
                                            : 'text-neutral-500 hover:text-white hover:bg-neutral-900/50'
                                    )}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="sidebar-active"
                                            className="absolute left-0 w-1 h-5 bg-orange-600 rounded-r-full"
                                        />
                                    )}
                                    <link.icon className={cn('w-4 h-4 transition-colors', isActive ? 'text-orange-600' : 'group-hover:text-orange-600')} />
                                    <span className="uppercase">{link.label}</span>
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Profile */}
                    <div className="mt-8 pt-8 border-t border-neutral-900">
                        <div className="relative">
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-900 transition-all group border border-transparent hover:border-neutral-800"
                            >
                                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-neutral-900 font-bold text-xs shadow-lg">
                                    {(staff?.name?.[0] || user?.full_name?.[0] || user?.email?.[0])?.toUpperCase()}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <p className="text-xs font-bold text-white truncate uppercase tracking-tight">
                                        {staff?.name || user?.full_name || user?.email?.split('@')[0] || 'Admin'}
                                    </p>
                                    <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">{effectiveRole}</p>
                                </div>
                                <ChevronDown className={cn('w-3 h-3 text-neutral-500 transition-transform group-hover:text-orange-600', isProfileOpen && 'rotate-180')} />
                            </button>

                            <AnimatePresence>
                                {isProfileOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        className="absolute bottom-full left-0 right-0 mb-4 bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden z-50 p-2"
                                    >
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-6 py-5 text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all text-[10px] font-bold uppercase tracking-widest"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Logout
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Content Plane */}
            <div className="flex-1 lg:pl-72 transition-all duration-500 min-h-screen flex flex-col bg-black">
                {/* Header - Show on all pages */}
                {pathname && (
                    <header className="sticky top-0 z-40 px-2 lg:px-4 py-6 flex items-center justify-between bg-black/80 backdrop-blur-3xl border-b border-neutral-900/50">
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="lg:hidden w-12 h-12 flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 rounded-2xl transition-colors border border-neutral-800"
                            >
                                <Menu className="w-6 h-6 text-white" />
                            </button>

                            <div className="hidden sm:flex items-center gap-3 px-6 h-14 bg-neutral-950 rounded-2xl border border-neutral-900 shadow-inner group">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-glow shadow-emerald-500/50" />
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">System Online</span>
                            </div>
                        </div>

                        {/* Centered Search */}
                        <div className="hidden lg:flex flex-1 max-w-2xl px-12">
                            <div className="relative w-full group">
                                <Search className="w-4 h-4 absolute left-6 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-orange-600 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search everything..."
                                    className="h-14 w-full bg-neutral-950 rounded-2xl pl-16 pr-6 text-[10px] font-bold uppercase tracking-widest outline-none border border-neutral-900 focus:border-orange-600/30 focus:bg-black transition-all text-white placeholder:text-neutral-800 shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-4 lg:gap-6">
                            <Link href="/dashboard/kitchen">
                                <Button
                                    className="bg-white text-neutral-950 hover:bg-orange-600 hover:text-white rounded-2xl h-14 px-8 lg:px-10 font-bold uppercase tracking-widest text-[10px] shadow-lg transition-all border-none"
                                    icon={ChefHat}
                                >
                                    Kitchen
                                </Button>
                            </Link>

                            <button className="relative w-14 h-14 flex items-center justify-center bg-neutral-950 hover:bg-neutral-900 rounded-2xl transition-all border border-neutral-900 group shadow-lg">
                                <Bell className="w-5 h-5 text-neutral-500 group-hover:text-orange-600 transition-colors" />
                                <span className="absolute top-4 right-4 w-2 h-2 bg-orange-600 rounded-full border-2 border-black shadow-glow shadow-orange-600/50" />
                            </button>
                        </div>
                    </header>
                )}

                {/* Mobile menu button for non-overview pages */}
                {pathname !== '/dashboard' && (
                    <div className="lg:hidden fixed top-4 left-4 z-50">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="w-12 h-12 flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 rounded-2xl transition-colors border border-neutral-800 shadow-lg"
                        >
                            <Menu className="w-6 h-6 text-white" />
                        </button>
                    </div>
                )}

                <main className="flex-1 w-full overflow-x-hidden">
                    <div className={cn(
                        "w-full pb-20",
                        ['/dashboard', '/dashboard/order-desk', '/dashboard/orders', '/dashboard/billing', '/dashboard/tables', '/dashboard/menu'].includes(pathname)
                            ? "pt-0 px-0"
                            : "pt-12 lg:pt-16 px-2 lg:px-4"
                    )}>
                        {children}
                    </div>
                </main>
            </div>

            <ChatWidget />
        </PremiumLayout>
    )
}
