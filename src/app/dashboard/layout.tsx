'use client'

import { useState, ReactNode, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    LayoutDashboard, UtensilsCrossed, Grid3X3, ClipboardList, ChefHat,
    Receipt, BarChart3, Users, Settings, LogOut, Menu, Bell, ChevronDown,
    Shield, Activity, TrendingUp, Star, Truck, Award, QrCode,
    Clock, DollarSign, Tv, ChevronRight, LifeBuoy, MessageCircle,
    UserCircle, Store, CalendarClock, BadgeCheck, UserCog, Sparkles, Gift,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore, hasPermission } from '@/stores'
import { isTrialExpired, trialDaysRemaining } from '@/lib/plan'
import { useToast } from '@/components/ui/toast'
import { ChatWidget } from '@/components/chat/ChatWidget'
import { AuthGuard } from '@/components/AuthGuard'
import { AppearanceControl } from '@/components/AppearanceControl'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useUnreadNotifications } from '@/hooks/use-unread-notifications'
import { cn } from '@/lib/utils'
import { AccessDeniedPage } from '@/components/AccessDeniedPage'
import type { UserRole } from '@/types'
import type { Permission } from '@/stores'
import {
    Avatar, AvatarFallback, AvatarImage,
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
    Badge,
} from '@/components/ui'

interface DashboardLayoutProps { children: ReactNode }

/* ============================================
   NAVIGATION CONFIG
   ============================================ */

interface NavItem {
    href: string
    label: string
    icon: React.ElementType
    permission: Permission
}

interface NavSection {
    title: string
    items: NavItem[]
}

const navSections: NavSection[] = [
    {
        title: 'Operations',
        items: [
            { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, permission: 'page:dashboard' },
            { href: '/dashboard/orders', label: 'Orders', icon: ClipboardList, permission: 'page:orders' },
            { href: '/dashboard/order-desk', label: 'Order desk', icon: ClipboardList, permission: 'page:order_desk' },
            { href: '/dashboard/tables', label: 'Tables', icon: Grid3X3, permission: 'page:tables' },
            { href: '/dashboard/menu', label: 'Menu', icon: UtensilsCrossed, permission: 'page:menu' },
            { href: '/dashboard/kitchen', label: 'Kitchen', icon: ChefHat, permission: 'page:kitchen' },
            { href: '/dashboard/billing', label: 'Billing', icon: Receipt, permission: 'page:billing' },
            { href: '/dashboard/cashier', label: 'Cashier', icon: DollarSign, permission: 'page:cashier' },
        ]
    },
    {
        title: 'Staff & Shifts',
        items: [
            { href: '/dashboard/staff', label: 'Staff', icon: Users, permission: 'page:staff' },
            { href: '/dashboard/messages', label: 'Messages', icon: MessageCircle, permission: 'page:messages' },
            { href: '/dashboard/shifts', label: 'Shifts', icon: Clock, permission: 'page:shifts' },
            { href: '/dashboard/staff-performance', label: 'Performance', icon: TrendingUp, permission: 'page:staff_performance' },
            { href: '/dashboard/my-shift', label: 'My Shift', icon: Activity, permission: 'page:my_shift' },
            { href: '/dashboard/tips', label: 'Tips', icon: DollarSign, permission: 'page:tips' },
        ]
    },
    {
        title: 'Management',
        items: [
            { href: '/dashboard/inventory', label: 'Inventory', icon: ClipboardList, permission: 'page:inventory' },
            { href: '/dashboard/reservations', label: 'Reservations', icon: Users, permission: 'page:reservations' },
            { href: '/dashboard/discounts', label: 'Discounts', icon: Award, permission: 'page:discounts' },
            { href: '/dashboard/specials', label: 'Specials', icon: Sparkles, permission: 'page:specials' },
            { href: '/dashboard/loyalty', label: 'Loyalty', icon: Gift, permission: 'page:loyalty' },
            { href: '/dashboard/franchise', label: 'Locations', icon: Store, permission: 'page:franchise' },
            { href: '/dashboard/delivery-monitor', label: 'Delivery', icon: Truck, permission: 'page:delivery_monitor' },
            { href: '/dashboard/riders', label: 'Riders', icon: Truck, permission: 'page:riders' },
        ]
    },
    {
        title: 'Insights',
        items: [
            { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, permission: 'page:analytics' },
            { href: '/dashboard/reports', label: 'Reports', icon: ClipboardList, permission: 'page:reports' },
            { href: '/dashboard/expenses', label: 'Expenses', icon: DollarSign, permission: 'page:expenses' },
            { href: '/dashboard/feedback', label: 'Feedback', icon: Star, permission: 'page:feedback' },
        ]
    },
    {
        title: 'Setup',
        items: [
            { href: '/dashboard/qr-ordering', label: 'QR Codes', icon: QrCode, permission: 'page:qr_ordering' },
            { href: '/dashboard/display-manager', label: 'Display', icon: Tv, permission: 'page:display_manager' },
            { href: '/dashboard/settings', label: 'Settings', icon: Settings, permission: 'page:settings' },
        ]
    },
]

// Flat map for route guarding
const routePermissionMap: Record<string, Permission> = {
    '/dashboard': 'page:dashboard',
    '/dashboard/orders': 'page:orders',
    '/dashboard/my-orders': 'page:my_orders',
    '/dashboard/take-order': 'page:take_order',
    '/dashboard/tables': 'page:tables',
    '/dashboard/menu': 'page:menu',
    '/dashboard/kitchen': 'page:kitchen',
    '/dashboard/kitchen-view': 'page:kitchen_view',
    '/dashboard/cashier': 'page:cashier',
    '/dashboard/billing': 'page:billing',
    '/dashboard/delivery-boy': 'page:delivery_boy',
    '/dashboard/delivery-monitor': 'page:delivery_monitor',
    '/dashboard/riders': 'page:riders',
    '/dashboard/staff': 'page:staff',
    '/dashboard/staff-performance': 'page:staff_performance',
    '/dashboard/shifts': 'page:shifts',
    '/dashboard/my-shift': 'page:my_shift',
    '/dashboard/tips': 'page:tips',
    '/dashboard/inventory': 'page:inventory',
    '/dashboard/reservations': 'page:reservations',
    '/dashboard/discounts': 'page:discounts',
    '/dashboard/specials': 'page:specials',
    '/dashboard/reports': 'page:reports',
    '/dashboard/analytics': 'page:analytics',
    '/dashboard/expenses': 'page:expenses',
    '/dashboard/feedback': 'page:feedback',
    '/dashboard/loyalty': 'page:loyalty',
    '/dashboard/qr-ordering': 'page:qr_ordering',
    '/dashboard/display-manager': 'page:display_manager',
    '/dashboard/settings': 'page:settings',
    '/dashboard/messages': 'page:messages',
    '/dashboard/order-desk': 'page:order_desk',
    '/dashboard/franchise': 'page:franchise',
}

const roleHomeRoutes: Record<UserRole, string> = {
    owner: '/dashboard',
    manager: '/dashboard',
    waiter: '/dashboard/waiter',
    kitchen: '/dashboard/kitchen',
    cashier: '/dashboard/cashier',
    delivery: '/dashboard/delivery-boy',
    rider: '/dashboard/delivery-boy',
}

const roleColors: Record<UserRole, { bg: string; text: string; dot: string }> = {
    owner:   { bg: 'bg-orange-500/10', text: 'text-orange-500', dot: 'bg-orange-500' },
    manager: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', dot: 'bg-emerald-500' },
    waiter:  { bg: 'bg-sky-500/10', text: 'text-sky-500', dot: 'bg-sky-500' },
    kitchen: { bg: 'bg-rose-500/10', text: 'text-rose-500', dot: 'bg-rose-500' },
    cashier: { bg: 'bg-violet-500/10', text: 'text-violet-500', dot: 'bg-violet-500' },
    delivery:{ bg: 'bg-amber-500/10', text: 'text-amber-500', dot: 'bg-amber-500' },
    rider:   { bg: 'bg-amber-500/10', text: 'text-amber-500', dot: 'bg-amber-500' },
}

/* ============================================
   LAYOUT COMPONENT
   ============================================ */

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { success } = useToast()
    const { user, restaurant, userRole, staff, logout: logoutStore, setRestaurant, setUser, setUserRole } = useAuthStore()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Operations']))
    const unreadCount = useUnreadNotifications()

    const effectiveRole: UserRole | null = userRole || staff?.role || null
    const rc = effectiveRole
        ? roleColors[effectiveRole]
        : { bg: 'bg-white/5', text: 'text-slate-400', dot: 'bg-slate-500' }

    /* ---- Load context ---- */
    useEffect(() => {
        let cancelled = false
        const load = async () => {
            if ((restaurant?.id || staff?.id) && userRole) return
            const supabase = createClient()
            const { data: { user: au } } = await supabase.auth.getUser()
            if (!au || cancelled) return

            if (!user && !cancelled) {
                setUser({
                    id: au.id,
                    email: au.email!,
                    full_name: au.user_metadata?.full_name || au.user_metadata?.name || au.email?.split('@')[0],
                })
            }
            if (restaurant?.id && !userRole && !cancelled) {
                const { data: owned } = await supabase.from('restaurants').select('id').eq('owner_id', au.id).eq('id', restaurant.id).maybeSingle()
                if (cancelled) return
                if (owned) { setUserRole('owner'); return }
                const { data: sr } = await supabase.from('staff').select('role').eq('user_id', au.id).maybeSingle()
                if (!cancelled && sr) setUserRole(sr.role as UserRole)
                return
            }
            if (!cancelled) {
                const { data: r } = await supabase.from('restaurants').select('*').eq('owner_id', au.id).single()
                if (cancelled) return
                if (r) { setRestaurant(r); setUserRole('owner') }
                else {
                    const { data: sr } = await supabase.from('staff').select('id, role, restaurants(*)').eq('user_id', au.id).maybeSingle()
                    if (!cancelled && !sr) router.push('/setup')
                    else if (sr && sr.restaurants) { setRestaurant(sr.restaurants); setUserRole(sr.role as UserRole) }
                }
            }
        }
        load()
        return () => { cancelled = true }
    }, [restaurant?.id, user?.id, staff?.id, userRole, router, setRestaurant, setUser, setUserRole])

    /* ---- RBAC route guard ---- */
    useEffect(() => {
        if (!userRole) return
        const perm = routePermissionMap[pathname]
        if (perm && !hasPermission(userRole, perm)) {
            router.push(roleHomeRoutes[userRole] || '/staff-login')
        }
    }, [pathname, userRole, router])

    const toggleSection = useCallback((title: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev)
            if (next.has(title)) next.delete(title)
            else next.add(title)
            return next
        })
    }, [])

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/staff-logout', { method: 'POST' })
        } catch {
            // cookie clear is best-effort
        }
        const supabase = createClient()
        await supabase.auth.signOut()
        logoutStore()
        success('Logged Out', 'You have been successfully logged out.')
        router.push(staff ? '/staff-login' : '/login')
    }

    const displayName = staff?.name || user?.full_name || user?.email?.split('@')[0] || 'User'
    const initial = displayName[0]?.toUpperCase() || 'U'
    const avatarUrl = staff?.avatar_url || user?.avatar_url || ''
    const accountEmail = staff?.email || user?.email || ''
    const accountPhone = staff?.phone || restaurant?.phone || ''
    const isOwnerAccount = effectiveRole === 'owner'
    const primaryAccountAction = isOwnerAccount
        ? { label: 'Owner Profile', href: '/dashboard/profile', icon: UserCircle }
        : { label: 'Staff Profile', href: '/dashboard/profile', icon: UserCircle }
    const secondaryAccountAction = isOwnerAccount
        ? { label: 'Restaurant Settings', href: '/dashboard/settings', icon: Settings }
        : { label: 'My Shift', href: '/dashboard/my-shift', icon: CalendarClock }
    const PrimaryAccountIcon = primaryAccountAction.icon
    const SecondaryAccountIcon = secondaryAccountAction.icon

    /* ---- Filtered nav ---- */
    const filteredSections = navSections.map(sec => ({
        ...sec,
        items: sec.items.filter(i => hasPermission(effectiveRole, i.permission))
    })).filter(sec => sec.items.length > 0)

    return (
        <div className="flex min-h-screen bg-[var(--background)] overflow-hidden">
            <a href="#main-content" className="skip-link">Skip to main content</a>

            {/* Mobile overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
                        aria-hidden="true"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed top-0 left-0 bottom-0 w-[260px] z-[70] bg-[var(--surface)] border-r border-[var(--border)]",
                    "flex flex-col transition-transform duration-300 ease-out lg:translate-x-0",
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {/* Logo */}
                <div className="px-5 pt-6 pb-4">
                    <Link href="/dashboard" className="flex items-center gap-3 group">
                        <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center shadow-glow">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-display font-bold text-lg tracking-tight text-[var(--text-primary)]">
                            Nexus<span className="text-brand">POS</span>
                        </span>
                    </Link>
                </div>

                {/* Role badge */}
                <div className="px-5 pb-4">
                    <div className={cn("inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide border border-white/5", rc.bg, rc.text)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", rc.dot)} />
                        {effectiveRole}
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-1" aria-label="Main navigation">
                    {filteredSections.map(section => {
                        const isExpanded = expandedSections.has(section.title)
                        const hasActive = section.items.some(i => pathname === i.href)
                        return (
                            <div key={section.title} className="mb-2">
                                <button
                                    onClick={() => toggleSection(section.title)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                                    aria-expanded={isExpanded}
                                >
                                    {section.title}
                                    <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-200", isExpanded && "rotate-90")} />
                                </button>
                                <AnimatePresence initial={false}>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <ul className="space-y-0.5 mt-1">
                                                {section.items.map(item => {
                                                    const isActive = pathname === item.href
                                                    return (
                                                        <li key={item.href}>
                                                            <Link
                                                                href={item.href}
                                                                onClick={() => setIsSidebarOpen(false)}
                                                                className={cn(
                                                                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all relative",
                                                                    isActive
                                                                        ? "bg-brand-subtle text-brand"
                                                                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                                                                )}
                                                                aria-current={isActive ? 'page' : undefined}
                                                            >
                                                                {isActive && (
                                                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand rounded-r-full" />
                                                                )}
                                                                <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-brand")} />
                                                                <span>{item.label}</span>
                                                            </Link>
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </nav>

                {/* Profile */}
                <div className="p-3 border-t border-[var(--border)] space-y-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--surface-hover)] transition-colors text-left group cursor-pointer">
                            <Avatar className="w-8 h-8 border border-[var(--border)]">
                                <AvatarFallback className="bg-[var(--surface-active)] text-[var(--text-primary)] text-xs font-semibold">
                                    {initial}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{displayName}</p>
                                <p className="text-xs text-[var(--text-muted)] capitalize">{effectiveRole}</p>
                            </div>
                            <ChevronDown className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-[var(--surface-raised)] border-[var(--border)]">
                            <div className="px-3 py-2">
                                <p className="text-sm font-medium text-[var(--text-primary)]">{displayName}</p>
                                <p className="text-xs text-[var(--text-muted)]">{user?.email || staff?.email}</p>
                            </div>
                            <DropdownMenuSeparator className="bg-[var(--border)]" />
                            <DropdownMenuItem className="text-[var(--text-secondary)] focus:bg-[var(--surface-hover)] focus:text-[var(--text-primary)] cursor-pointer" onClick={() => router.push('/dashboard/profile')}>
                                <Users className="w-4 h-4 mr-2" />
                                Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[var(--text-secondary)] focus:bg-[var(--surface-hover)] focus:text-[var(--text-primary)] cursor-pointer" onClick={() => router.push('/dashboard/settings')}>
                                <Settings className="w-4 h-4 mr-2" />
                                Settings
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Content */}
            <div className="flex-1 lg:ml-[260px] min-h-screen flex flex-col">
                {/* Header */}
                <header className="sticky top-0 z-40 h-16 px-4 lg:px-6 flex items-center justify-between glass border-b border-[var(--border)]">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                            aria-label="Open sidebar"
                        >
                            <Menu className="w-5 h-5 text-[var(--text-secondary)]" />
                        </button>

                        {/* Breadcrumb */}
                        <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 text-sm text-[var(--text-muted)]">
                            <span className="text-[var(--text-secondary)]">NexusPOS</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                            <span className="text-[var(--text-primary)] font-medium capitalize">{pathname.split('/').pop()?.replace(/-/g, ' ') || 'Dashboard'}</span>
                        </nav>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Restaurant indicator */}
                        {restaurant?.name && (
                            <Badge variant="outline" className="hidden md:inline-flex h-9 gap-2 border-[var(--border)] text-[var(--text-secondary)] bg-[var(--surface-raised)] px-3">
                                <Store className="w-3.5 h-3.5 text-brand" />
                                <span className="max-w-[160px] truncate">{restaurant.name}</span>
                            </Badge>
                        )}

                        <AppearanceControl />

                        {/* Notifications */}
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                            >
                                <Bell className="w-5 h-5 text-[var(--text-secondary)]" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand rounded-full ring-2 ring-[var(--background)]" />
                                )}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-80 bg-[var(--surface-raised)] border-[var(--border)]">
                                <div className="px-4 py-3 border-b border-[var(--border)]">
                                    <p className="text-sm font-semibold text-[var(--text-primary)]">Notifications</p>
                                </div>
                                <div className="px-4 py-6 text-center">
                                    <LifeBuoy className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                                    <p className="text-sm text-[var(--text-muted)]">No new notifications</p>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Account */}
                        <DropdownMenu>
                            <DropdownMenuTrigger className="group flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-2 pr-3 transition-all hover:border-brand/30 hover:bg-[var(--surface-hover)]">
                                <Avatar className="w-7 h-7 border border-[var(--border)]">
                                    {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                                    <AvatarFallback className={cn("text-xs font-bold text-[var(--text-primary)]", rc.bg, rc.text)}>
                                        {initial}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="hidden sm:block min-w-0 text-left">
                                    <p className="max-w-[110px] truncate text-xs font-bold text-[var(--text-primary)]">{displayName}</p>
                                    <p className={cn("text-[10px] font-semibold capitalize", rc.text)}>{effectiveRole}</p>
                                </div>
                                <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-[var(--text-muted)] transition-transform group-data-[state=open]:rotate-180" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-80 overflow-hidden bg-[var(--surface-raised)] border-[var(--border)] p-0">
                                <div className="p-4 bg-[var(--surface)] border-b border-[var(--border)]">
                                    <div className="flex items-start gap-3">
                                        <Avatar className="w-14 h-14 border border-[var(--border)]">
                                            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                                            <AvatarFallback className={cn("text-lg font-black text-[var(--text-primary)]", rc.bg, rc.text)}>
                                                {initial}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate text-base font-black text-[var(--text-primary)]">{displayName}</p>
                                                {isOwnerAccount && <BadgeCheck className="h-4 w-4 shrink-0 text-brand" />}
                                            </div>
                                            <p className="truncate text-xs text-[var(--text-muted)]">{accountEmail || 'No email on file'}</p>
                                            <div className={cn("mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider", rc.bg, rc.text)}>
                                                <span className={cn("h-1.5 w-1.5 rounded-full", rc.dot)} />
                                                {isOwnerAccount ? 'Owner Account' : 'Staff Account'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 p-3 border-b border-[var(--border)]">
                                    <AccountInfoTile icon={Store} label="Restaurant" value={restaurant?.name || 'Not linked'} />
                                    <AccountInfoTile icon={UserCog} label="Role" value={effectiveRole || '…'} />
                                    <AccountInfoTile icon={Shield} label="Account" value={isOwnerAccount ? 'Owner' : 'Staff'} />
                                    <AccountInfoTile icon={Bell} label="Alerts" value={unreadCount > 0 ? `${unreadCount} unread` : 'Clear'} />
                                </div>

                                <div className="p-2">
                                    <DropdownMenuItem
                                        className="text-[var(--text-secondary)] focus:bg-[var(--surface-hover)] focus:text-[var(--text-primary)] cursor-pointer"
                                        onClick={() => router.push(primaryAccountAction.href)}
                                    >
                                        <PrimaryAccountIcon className="w-4 h-4 mr-2" />
                                        {primaryAccountAction.label}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-[var(--text-secondary)] focus:bg-[var(--surface-hover)] focus:text-[var(--text-primary)] cursor-pointer"
                                        onClick={() => router.push(secondaryAccountAction.href)}
                                    >
                                        <SecondaryAccountIcon className="w-4 h-4 mr-2" />
                                        {secondaryAccountAction.label}
                                    </DropdownMenuItem>
                                    {!isOwnerAccount && accountPhone && (
                                        <div className="px-2 py-2 text-xs text-[var(--text-muted)]">
                                            Phone: <span className="text-[var(--text-secondary)]">{accountPhone}</span>
                                        </div>
                                    )}
                                </div>
                                <DropdownMenuSeparator className="bg-[var(--border)]" />
                                <div className="p-2">
                                    <DropdownMenuItem
                                        className="text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer"
                                        onClick={handleLogout}
                                    >
                                        <LogOut className="w-4 h-4 mr-2" />
                                        Logout
                                    </DropdownMenuItem>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                {/* Main */}
                <main id="main-content" className="flex-1 w-full overflow-x-hidden">
                    {isTrialExpired(restaurant) && (
                        <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-200 text-sm">
                            Your 14-day trial has ended. Existing data stays readable. New orders are paused until the owner upgrades the plan in Settings.
                        </div>
                    )}
                    {!isTrialExpired(restaurant) && trialDaysRemaining(restaurant) !== null && trialDaysRemaining(restaurant)! <= 3 && (
                        <div className="px-4 py-3 bg-brand/10 border-b border-brand/20 text-[var(--text-secondary)] text-sm">
                            Trial: {trialDaysRemaining(restaurant)} day{trialDaysRemaining(restaurant) === 1 ? '' : 's'} remaining.
                        </div>
                    )}
                    <div className={cn(
                        "w-full",
                        ['/dashboard/order-desk', '/dashboard/orders', '/dashboard/billing', '/dashboard/tables', '/dashboard/menu', '/dashboard/kitchen', '/dashboard/messages'].includes(pathname)
                            ? "p-0"
                            : "p-4 lg:p-6 max-w-[1400px] mx-auto"
                    )}>
                        <ErrorBoundary>
                            <AuthGuard>
                                {userRole && routePermissionMap[pathname] && !hasPermission(userRole, routePermissionMap[pathname])
                                    ? <AccessDeniedPage />
                                    : children
                                }
                            </AuthGuard>
                        </ErrorBoundary>
                    </div>
                </main>
            </div>

            <ChatWidget />
        </div>
    )
}

function AccountInfoTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[var(--text-muted)]">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <p className="truncate text-xs font-bold capitalize text-[var(--text-primary)]">{value}</p>
        </div>
    )
}
