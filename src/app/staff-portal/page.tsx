'use client'

import { useState, useEffect, use } from 'react'
import { motion } from 'framer-motion'
import {
    User,
    Mail,
    Phone,
    Shield,
    Lock,
    Camera,
    CheckCircle2,
    ArrowLeft,
    Copy,
    Loader2,
    LogOut,
    Home,
    Clock,
    Store,
    MessageCircle
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { Badge, Button, Card, Input } from '@/components/ui/common'
import { cn } from '@/lib/utils'

export default function StaffPortalPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const { staff, restaurant, logout } = useAuthStore()
    const { success, error: showError } = useToast()

    const [isLoading, setIsLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [showPinSetup, setShowPinSetup] = useState(false)
    const [copied, setCopied] = useState(false)
    const [profileData, setProfileData] = useState({
        name: staff?.name || '',
        email: staff?.email || '',
        phone: staff?.phone || '',
        avatar_url: staff?.avatar_url || '',
    })
    const [newPin, setNewPin] = useState('')
    const [confirmPin, setConfirmPin] = useState('')

    useEffect(() => {
        if (staff) {
            setProfileData({
                name: staff.name || '',
                email: staff.email || '',
                phone: staff.phone || '',
                avatar_url: staff.avatar_url || '',
            })
            setIsLoading(false)
        }
    }, [staff])

    const handleLogout = () => {
        logout()
        router.push('/staff-login')
    }

    const handleCopyInfo = async () => {
        const info = `Name: ${staff?.name}
Role: ${staff?.role}
Restaurant: ${restaurant?.name}
Email: ${staff?.email}
Phone: ${staff?.phone || 'Not set'}`

        await navigator.clipboard.writeText(info)
        setCopied(true)
        success('Copied!', 'Staff info copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
    }

    const handleSaveProfile = async () => {
        if (!staff?.id) return

        setIsSaving(true)
        try {
            const response = await fetch('/api/staff', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staffId: staff.id,
                    name: profileData.name,
                    email: profileData.email,
                    phone: profileData.phone,
                    restaurantId: restaurant?.id,
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update profile')
            }

            // Update local store
            const { setStaff } = useAuthStore.getState()
            setStaff({ ...staff, ...profileData })

            success('Profile Updated', 'Your profile has been saved')
            setIsEditing(false)
        } catch (err: any) {
            showError('Error', err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handlePinChange = async () => {
        if (!staff?.id || !newPin || newPin.length !== 4) {
            showError('Invalid PIN', 'PIN must be exactly 4 digits')
            return
        }

        if (newPin !== confirmPin) {
            showError('Mismatch', 'PINs do not match')
            return
        }

        setIsSaving(true)
        try {
            const response = await fetch('/api/auth/staff-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: staff.email,
                    tempPin: 'CHANGE', // Special flag for PIN change
                    newPin: newPin,
                    phone: null,
                }),
            })

            const result = await response.json()

            if (!response.ok && !result.success) {
                throw new Error(result.error || 'Failed to change PIN')
            }

            success('PIN Changed', 'Your PIN has been updated')
            setNewPin('')
            setConfirmPin('')
            setShowPinSetup(false)
        } catch (err: any) {
            showError('Error', err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const roleColors: Record<string, string> = {
        owner: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        manager: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        waiter: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        kitchen: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
        cashier: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
        delivery: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
        rider: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    }

    if (!staff) {
        return (
            <div className="min-h-screen bg-[#030303] flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-white mb-4">Staff Not Logged In</h2>
                    <Link href="/staff-login">
                        <Button className="bg-orange-600 hover:bg-orange-500">Go to Staff Login</Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#030303] text-white p-4 lg:p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Link href="/dashboard" className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-bold">Back to Dashboard</span>
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-500 hover:text-white transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-bold">Logout</span>
                    </button>
                </div>

                {/* Profile Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="p-8 bg-neutral-950 border-neutral-800 rounded-3xl relative overflow-hidden">
                        {/* Background Glow */}
                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl" />

                        <div className="relative z-10">
                            {/* Avatar & Basic Info */}
                            <div className="flex items-start gap-6 mb-8">
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center text-3xl font-black text-white">
                                        {staff.name?.split(' ').map(n => n[0]).join('') || 'S'}
                                    </div>
                                    {isEditing && (
                                        <button className="absolute -bottom-2 -right-2 w-10 h-10 bg-neutral-900 border border-neutral-700 rounded-xl flex items-center justify-center text-orange-500 hover:bg-orange-600 hover:text-white transition-colors">
                                            <Camera className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h1 className="text-2xl font-bold text-white mb-2">{staff.name}</h1>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        <Badge className={cn("font-bold text-xs uppercase tracking-widest border", roleColors[staff.role] || roleColors.waiter)}>
                                            {staff.role}
                                        </Badge>
                                        {staff.needs_setup && (
                                            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-bold text-xs uppercase tracking-widest">
                                                Setup Required
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-neutral-500">{restaurant?.name}</p>
                                </div>
                            </div>

                            {/* Quick Info Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-black rounded-xl border border-neutral-800">
                                    <div className="flex items-center gap-2 text-neutral-500 mb-1">
                                        <Mail className="w-4 h-4" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Email</span>
                                    </div>
                                    <p className="text-white font-bold">{staff.email || 'Not set'}</p>
                                </div>
                                <div className="p-4 bg-black rounded-xl border border-neutral-800">
                                    <div className="flex items-center gap-2 text-neutral-500 mb-1">
                                        <Phone className="w-4 h-4" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Phone</span>
                                    </div>
                                    <p className="text-white font-bold">{staff.phone || 'Not set'}</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <Link href="/staff-messages" className="flex-1">
                                    <Button
                                        variant="outline"
                                        className="w-full h-12 border-neutral-800 text-neutral-400 font-bold text-xs uppercase tracking-widest hover:text-white hover:border-neutral-700"
                                        icon={MessageCircle}
                                    >
                                        Messages
                                    </Button>
                                </Link>
                                <Button
                                    variant="outline"
                                    onClick={handleCopyInfo}
                                    className="flex-1 h-12 border-neutral-800 text-neutral-400 font-bold text-xs uppercase tracking-widest hover:text-white"
                                    icon={copied ? CheckCircle2 : Copy}
                                >
                                    {copied ? 'Copied!' : 'Copy Info'}
                                </Button>
                                <Button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="flex-1 h-12 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-widest"
                                    icon={User}
                                >
                                    {isEditing ? 'Cancel' : 'Edit Profile'}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </motion.div>

                {/* Edit Profile Form */}
                {isEditing && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Card className="p-6 bg-neutral-950 border-neutral-800 rounded-3xl">
                            <h2 className="text-lg font-bold text-white mb-6">Edit Profile</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">Full Name</label>
                                    <Input
                                        variant="nexus"
                                        value={profileData.name}
                                        onChange={(e: any) => setProfileData({ ...profileData, name: e.target.value })}
                                        className="h-12 bg-black border-neutral-800 text-white font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">Email</label>
                                    <Input
                                        variant="nexus"
                                        type="email"
                                        value={profileData.email}
                                        onChange={(e: any) => setProfileData({ ...profileData, email: e.target.value })}
                                        className="h-12 bg-black border-neutral-800 text-white font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">Phone</label>
                                    <Input
                                        variant="nexus"
                                        type="tel"
                                        value={profileData.phone}
                                        onChange={(e: any) => setProfileData({ ...profileData, phone: e.target.value })}
                                        className="h-12 bg-black border-neutral-800 text-white font-bold"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsEditing(false)}
                                        className="flex-1 h-12 border-neutral-800 text-neutral-400 font-bold text-xs uppercase tracking-widest"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSaveProfile}
                                        isLoading={isSaving}
                                        className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest"
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* Change PIN */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="p-6 bg-neutral-950 border-neutral-800 rounded-3xl">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                    <Lock className="w-5 h-5 text-emerald-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Change PIN</h2>
                                    <p className="text-xs text-neutral-500">Update your 4-digit login PIN</p>
                                </div>
                            </div>
                            {!showPinSetup && (
                                <Button
                                    variant="outline"
                                    onClick={() => setShowPinSetup(true)}
                                    className="h-10 px-6 border-neutral-800 text-neutral-400 font-bold text-xs uppercase tracking-widest hover:text-white"
                                >
                                    Change
                                </Button>
                            )}
                        </div>

                        {showPinSetup && (
                            <div className="space-y-4 pt-4 border-t border-neutral-800">
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">New PIN (4 digits)</label>
                                    <input
                                        type="password"
                                        maxLength={4}
                                        value={newPin}
                                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                                        placeholder="****"
                                        className="w-full h-14 bg-black border border-neutral-800 rounded-xl text-center text-2xl font-black tracking-[0.5em] text-emerald-500 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">Confirm PIN</label>
                                    <input
                                        type="password"
                                        maxLength={4}
                                        value={confirmPin}
                                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                                        placeholder="****"
                                        className="w-full h-14 bg-black border border-neutral-800 rounded-xl text-center text-2xl font-black tracking-[0.5em] text-emerald-500 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => { setShowPinSetup(false); setNewPin(''); setConfirmPin(''); }}
                                        className="flex-1 h-12 border-neutral-800 text-neutral-400 font-bold text-xs uppercase tracking-widest"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handlePinChange}
                                        isLoading={isSaving}
                                        className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest"
                                    >
                                        Update PIN
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </motion.div>

                {/* Restaurant Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className="p-6 bg-neutral-950 border-neutral-800 rounded-3xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                <Store className="w-5 h-5 text-orange-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Restaurant</h2>
                                <p className="text-xs text-neutral-500">Your workplace details</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between p-3 bg-black rounded-xl">
                                <span className="text-neutral-500 text-sm">Name</span>
                                <span className="text-white font-bold">{restaurant?.name}</span>
                            </div>
                            <div className="flex justify-between p-3 bg-black rounded-xl">
                                <span className="text-neutral-500 text-sm">Address</span>
                                <span className="text-white font-bold">{restaurant?.address || 'Not set'}</span>
                            </div>
                            <div className="flex justify-between p-3 bg-black rounded-xl">
                                <span className="text-neutral-500 text-sm">Phone</span>
                                <span className="text-white font-bold">{restaurant?.phone || 'Not set'}</span>
                            </div>
                        </div>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}