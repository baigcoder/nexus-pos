'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    User,
    Mail,
    Phone,
    MapPin,
    Building,
    Shield,
    Key,
    Bell,
    Moon,
    Sun,
    Globe,
    Camera,
    Edit3,
    Save,
    X,
    Check,
    ChevronRight,
    Clock,
    Calendar,
    Award,
    Activity,
    LogOut,
    Trash2,
    Download,
    Upload,
    Eye,
    EyeOff,
    Lock,
    Smartphone,
    QrCode,
    CreditCard,
    FileText
} from 'lucide-react'
import { Card, Button, Badge, Modal } from '@/components/ui/common'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface ProfileStats {
    ordersHandled: number
    shiftsCompleted: number
    avgRating: number
    daysActive: number
}

export default function ProfilePage() {
    const { user, staff, restaurant, logout, userRole } = useAuthStore()
    const { success, error: showError } = useToast()
    const supabase = createClient()

    const [isLoading, setIsLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [showLogoutModal, setShowLogoutModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)

    // Profile form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        avatar_url: '',
    })

    // Settings state
    const [settings, setSettings] = useState({
        notifications: true,
        emailAlerts: true,
        darkMode: true,
        language: 'en',
        timezone: 'Asia/Karachi',
    })

    // Stats
    const [stats, setStats] = useState<ProfileStats>({
        ordersHandled: 0,
        shiftsCompleted: 0,
        avgRating: 5.0,
        daysActive: 0,
    })

    useEffect(() => {
        // Load profile data based on userRole
        const isOwner = userRole === 'owner'

        if (isOwner && user) {
            // Owner login - use auth user data
            setFormData({
                name: (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || user?.email?.split('@')[0] || '',
                email: user?.email || '',
                phone: (user as any)?.user_metadata?.phone || '',
                avatar_url: (user as any)?.user_metadata?.avatar_url || '',
            })
        } else if (staff) {
            // Staff login - use staff data
            setFormData({
                name: staff?.name || '',
                email: staff?.email || '',
                phone: (staff as any)?.phone || '',
                avatar_url: (staff as any)?.avatar_url || '',
            })

            // Calculate stats for staff
            if (staff?.created_at) {
                const daysActive = Math.floor((Date.now() - new Date(staff.created_at).getTime()) / (1000 * 60 * 60 * 24))
                setStats(prev => ({ ...prev, daysActive }))
            }

            fetchStats()
        }

        setIsLoading(false)
    }, [staff, user, userRole])

    const fetchStats = async () => {
        if (!staff?.id) return

        try {
            // Fetch orders count
            const { count: ordersCount } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('staff_id', staff.id)

            // Fetch shifts count
            const { count: shiftsCount } = await supabase
                .from('shifts')
                .select('*', { count: 'exact', head: true })
                .eq('staff_id', staff.id)
                .not('end_time', 'is', null)

            setStats(prev => ({
                ...prev,
                ordersHandled: ordersCount || 0,
                shiftsCompleted: shiftsCount || 0,
            }))
        } catch (error) {
            console.error('Failed to fetch stats:', error)
        }
    }

    const handleSaveProfile = async () => {
        try {
            const isOwner = userRole === 'owner'

            if (isOwner && user) {
                // Owner - update auth user metadata
                const { error } = await supabase.auth.updateUser({
                    data: {
                        full_name: formData.name,
                        phone: formData.phone,
                    }
                })
                if (error) throw error
            } else if (staff?.id) {
                // Staff - update staff table
                const { error } = await supabase
                    .from('staff')
                    .update({
                        name: formData.name,
                        phone: formData.phone,
                    })
                    .eq('id', staff.id)

                if (error) throw error
            }

            success('Success', 'Profile updated successfully')
            setIsEditing(false)
        } catch (error) {
            showError('Error', 'Failed to update profile')
        }
    }

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut()
            logout()
            window.location.href = '/login'
        } catch (error) {
            showError('Error', 'Failed to logout')
        }
    }

    const getRoleBadgeColor = (role: string) => {
        const colors: Record<string, string> = {
            owner: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
            manager: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white',
            chef: 'bg-gradient-to-r from-orange-500 to-red-600 text-white',
            waiter: 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white',
            cashier: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white',
            delivery: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white',
        }
        return colors[role] || 'bg-neutral-700 text-white'
    }

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
    }

    const itemVariant = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen pb-20">
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">

                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div className="space-y-3">
                        <motion.div variants={itemVariant} className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-xl shadow-amber-500/30">
                                <User className="w-5 h-5 text-white" />
                            </div>
                            <Badge variant="outline" className="border-amber-500/20 text-amber-500 bg-amber-500/5 px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                                MY PROFILE
                            </Badge>
                        </motion.div>
                        <motion.h1 variants={itemVariant} className="text-4xl lg:text-6xl font-display font-bold text-white tracking-tight uppercase">
                            Profile <span className="text-amber-500">Settings</span>
                        </motion.h1>
                        <motion.p variants={itemVariant} className="text-neutral-500 text-lg font-medium">
                            Manage your account details and preferences
                        </motion.p>
                    </div>

                    <motion.div variants={itemVariant} className="flex gap-3">
                        {isEditing ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsEditing(false)}
                                    className="h-12 px-6 rounded-xl border-neutral-800"
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveProfile}
                                    className="h-12 px-6 bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Changes
                                </Button>
                            </>
                        ) : (
                            <Button
                                onClick={() => setIsEditing(true)}
                                className="h-12 px-6 bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
                            >
                                <Edit3 className="w-4 h-4 mr-2" />
                                Edit Profile
                            </Button>
                        )}
                    </motion.div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                    {/* Left Column - Profile Card */}
                    <motion.div variants={itemVariant} className="xl:col-span-1 space-y-6">

                        {/* Profile Photo Card */}
                        <Card className="p-8 bg-gradient-to-br from-neutral-950 to-neutral-900 border-neutral-800 rounded-[2rem] text-center">
                            <div className="relative inline-block mb-6">
                                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-amber-500/30">
                                    {formData.avatar_url ? (
                                        <img
                                            src={formData.avatar_url}
                                            alt="Profile"
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        formData.name?.charAt(0)?.toUpperCase() || 'U'
                                    )}
                                </div>
                                {isEditing && (
                                    <button className="absolute bottom-0 right-0 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-amber-600 transition-colors">
                                        <Camera className="w-5 h-5" />
                                    </button>
                                )}
                            </div>

                            <h2 className="text-2xl font-bold text-white mb-2">{formData.name || 'User'}</h2>
                            <p className="text-neutral-400 mb-4">{formData.email}</p>

                            {userRole && (
                                <div className={cn(
                                    "inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm uppercase tracking-widest",
                                    getRoleBadgeColor(userRole)
                                )}>
                                    <Shield className="w-4 h-4" />
                                    {userRole}
                                </div>
                            )}
                        </Card>

                        {/* Stats Card */}
                        <Card className="p-6 bg-neutral-950 border-neutral-800 rounded-[2rem]">
                            <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4">Statistics</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Orders', value: stats.ordersHandled, icon: Activity },
                                    { label: 'Shifts', value: stats.shiftsCompleted, icon: Clock },
                                    { label: 'Rating', value: stats.avgRating.toFixed(1), icon: Award },
                                    { label: 'Days', value: stats.daysActive, icon: Calendar },
                                ].map((stat, idx) => (
                                    <div key={idx} className="p-4 bg-neutral-900/50 rounded-xl text-center">
                                        <stat.icon className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                                        <p className="text-2xl font-black text-white">{stat.value}</p>
                                        <p className="text-xs text-neutral-500 uppercase tracking-widest">{stat.label}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Restaurant Info */}
                        {restaurant && (
                            <Card className="p-6 bg-neutral-950 border-neutral-800 rounded-[2rem]">
                                <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4">Restaurant</h3>
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                                        <Building className="w-7 h-7 text-amber-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">{restaurant.name}</h4>
                                        <p className="text-sm text-neutral-500">{restaurant.address || 'No address set'}</p>
                                    </div>
                                </div>
                            </Card>
                        )}
                    </motion.div>

                    {/* Right Column - Details & Settings */}
                    <motion.div variants={itemVariant} className="xl:col-span-2 space-y-6">

                        {/* Personal Information */}
                        <Card className="p-6 bg-neutral-950 border-neutral-800 rounded-[2rem]">
                            <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-3">
                                <User className="w-5 h-5 text-amber-500" />
                                Personal Information
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-neutral-500 uppercase tracking-widest mb-2">
                                        Full Name
                                    </label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-amber-500 outline-none transition-colors"
                                        />
                                    ) : (
                                        <p className="text-white text-lg">{formData.name || '-'}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-neutral-500 uppercase tracking-widest mb-2">
                                        Email Address
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-neutral-600" />
                                        <p className="text-white text-lg">{formData.email || '-'}</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-neutral-500 uppercase tracking-widest mb-2">
                                        Phone Number
                                    </label>
                                    {isEditing ? (
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                            placeholder="+92 300 1234567"
                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-amber-500 outline-none transition-colors"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-neutral-600" />
                                            <p className="text-white text-lg">{formData.phone || 'Not set'}</p>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-neutral-500 uppercase tracking-widest mb-2">
                                        Role
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-neutral-600" />
                                        <p className="text-white text-lg capitalize">{userRole || 'User'}</p>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Preferences */}
                        <Card className="p-6 bg-neutral-950 border-neutral-800 rounded-[2rem]">
                            <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-3">
                                <Bell className="w-5 h-5 text-amber-500" />
                                Preferences
                            </h3>

                            <div className="space-y-4">
                                {[
                                    { key: 'notifications', label: 'Push Notifications', desc: 'Get notified about new orders', icon: Bell },
                                    { key: 'emailAlerts', label: 'Email Alerts', desc: 'Receive daily summary emails', icon: Mail },
                                    { key: 'darkMode', label: 'Dark Mode', desc: 'Use dark theme', icon: Moon },
                                ].map((setting) => (
                                    <div key={setting.key} className="flex items-center justify-between p-4 bg-neutral-900/50 rounded-xl">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center">
                                                <setting.icon className="w-5 h-5 text-amber-500" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">{setting.label}</p>
                                                <p className="text-sm text-neutral-500">{setting.desc}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSettings(prev => ({
                                                ...prev,
                                                [setting.key]: !prev[setting.key as keyof typeof prev]
                                            }))}
                                            className={cn(
                                                "w-14 h-8 rounded-full transition-all relative",
                                                settings[setting.key as keyof typeof settings]
                                                    ? 'bg-amber-500'
                                                    : 'bg-neutral-700'
                                            )}
                                        >
                                            <div className={cn(
                                                "w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow-md",
                                                settings[setting.key as keyof typeof settings]
                                                    ? 'left-7'
                                                    : 'left-1'
                                            )} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Security */}
                        <Card className="p-6 bg-neutral-950 border-neutral-800 rounded-[2rem]">
                            <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-3">
                                <Lock className="w-5 h-5 text-amber-500" />
                                Security
                            </h3>

                            <div className="space-y-4">
                                <button
                                    onClick={() => setShowPasswordModal(true)}
                                    className="w-full flex items-center justify-between p-4 bg-neutral-900/50 rounded-xl hover:bg-neutral-800/50 transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center">
                                            <Key className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-white">Change PIN</p>
                                            <p className="text-sm text-neutral-500">Update your login PIN</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-neutral-600 group-hover:text-amber-500 transition-colors" />
                                </button>

                                <button className="w-full flex items-center justify-between p-4 bg-neutral-900/50 rounded-xl hover:bg-neutral-800/50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center">
                                            <Smartphone className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-white">Two-Factor Authentication</p>
                                            <p className="text-sm text-neutral-500">Add extra security layer</p>
                                        </div>
                                    </div>
                                    <Badge className="bg-neutral-800 text-neutral-500">Coming Soon</Badge>
                                </button>

                                <button className="w-full flex items-center justify-between p-4 bg-neutral-900/50 rounded-xl hover:bg-neutral-800/50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center">
                                            <FileText className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-white">Activity Log</p>
                                            <p className="text-sm text-neutral-500">View recent account activity</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-neutral-600 group-hover:text-amber-500 transition-colors" />
                                </button>
                            </div>
                        </Card>

                        {/* Danger Zone */}
                        <Card className="p-6 bg-neutral-950 border-red-900/30 rounded-[2rem]">
                            <h3 className="text-lg font-bold text-red-500 uppercase tracking-widest mb-6 flex items-center gap-3">
                                <Trash2 className="w-5 h-5" />
                                Danger Zone
                            </h3>

                            <div className="space-y-4">
                                <button
                                    onClick={() => setShowLogoutModal(true)}
                                    className="w-full flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                                            <LogOut className="w-5 h-5 text-red-500" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-white">Sign Out</p>
                                            <p className="text-sm text-neutral-500">Sign out from all devices</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-red-500/50 group-hover:text-red-500 transition-colors" />
                                </button>
                            </div>
                        </Card>
                    </motion.div>
                </div>

                {/* Logout Confirmation Modal */}
                <Modal
                    isOpen={showLogoutModal}
                    onClose={() => setShowLogoutModal(false)}
                    title="SIGN OUT"
                >
                    <div className="p-4 text-center">
                        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <LogOut className="w-10 h-10 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Are you sure?</h3>
                        <p className="text-neutral-400 mb-8">You'll need to sign in again to access your account.</p>

                        <div className="flex gap-4">
                            <Button
                                variant="outline"
                                onClick={() => setShowLogoutModal(false)}
                                className="flex-1 h-12 rounded-xl border-neutral-800"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleLogout}
                                className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white rounded-xl"
                            >
                                Sign Out
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* Change PIN Modal */}
                <Modal
                    isOpen={showPasswordModal}
                    onClose={() => setShowPasswordModal(false)}
                    title="CHANGE PIN"
                >
                    <div className="p-4 space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-neutral-500 uppercase tracking-widest mb-2">
                                Current PIN
                            </label>
                            <input
                                type="password"
                                placeholder="••••"
                                maxLength={4}
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[1rem] focus:border-amber-500 outline-none transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-neutral-500 uppercase tracking-widest mb-2">
                                New PIN
                            </label>
                            <input
                                type="password"
                                placeholder="••••"
                                maxLength={4}
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[1rem] focus:border-amber-500 outline-none transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-neutral-500 uppercase tracking-widest mb-2">
                                Confirm New PIN
                            </label>
                            <input
                                type="password"
                                placeholder="••••"
                                maxLength={4}
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[1rem] focus:border-amber-500 outline-none transition-colors"
                            />
                        </div>

                        <Button className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold">
                            Update PIN
                        </Button>
                    </div>
                </Modal>
            </motion.div>
        </div>
    )
}
