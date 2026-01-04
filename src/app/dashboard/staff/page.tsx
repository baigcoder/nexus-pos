'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    User,
    Shield,
    ChefHat,
    Utensils,
    Mail,
    Lock,
    Check,
    UserPlus
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Input, SearchInput, Modal, StatCard } from '@/components/ui/common'
import { cn } from '@/lib/utils'

type StaffRole = 'owner' | 'manager' | 'waiter' | 'kitchen' | 'cashier' | 'delivery'

interface StaffMember {
    id: string
    name: string
    email: string | null
    role: StaffRole
    pin: string | null
    is_active: boolean
    created_at: string
}

const roleConfig: Record<StaffRole, { label: string; color: string; bgColor: string }> = {
    owner: { label: 'Owner', color: 'text-orange-600', bgColor: 'bg-orange-600/10' },
    manager: { label: 'Manager', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    waiter: { label: 'Waiter', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    kitchen: { label: 'Kitchen', color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
    cashier: { label: 'Cashier', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    delivery: { label: 'Delivery', color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
}

export default function StaffPage() {
    const { restaurant } = useAuthStore()
    const { success, error: showError } = useToast()
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all')
    const [showModal, setShowModal] = useState(false)
    const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)

    // Fetch staff from Supabase
    useEffect(() => {
        async function loadStaff() {
            if (!restaurant?.id) return
            setIsLoading(true)
            try {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from('staff')
                    .select('*')
                    .eq('restaurant_id', restaurant.id)
                    .order('name')

                if (error) throw error
                setStaff(data || [])
            } catch (err) {
                showError('Error', 'Failed to load staff')
            } finally {
                setIsLoading(false)
            }
        }
        loadStaff()
    }, [restaurant?.id])

    const filteredStaff = staff.filter(member => {
        const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (member.email || '').toLowerCase().includes(searchQuery.toLowerCase())
        const matchesRole = roleFilter === 'all' || member.role === roleFilter
        return matchesSearch && matchesRole
    })

    const stats = {
        total: staff.length,
        active: staff.filter(s => s.is_active).length,
        online: 0, // Would need real-time presence tracking
        waiters: staff.filter(s => s.role === 'waiter').length,
    }

    const handleToggleActive = async (id: string) => {
        const member = staff.find(s => s.id === id)
        if (!member) return

        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('staff')
                .update({ is_active: !member.is_active })
                .eq('id', id)

            if (error) throw error
            setStaff(staff.map(s => s.id === id ? { ...s, is_active: !s.is_active } : s))
            success(member.is_active ? 'Staff Disabled' : 'Staff Enabled', `Status updated for ${member.name}.`)
        } catch (err) {
            showError('Error', 'Failed to update status')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you certain you want to delete this staff record?')) return

        try {
            const supabase = createClient()
            const { error } = await supabase.from('staff').delete().eq('id', id)
            if (error) throw error
            setStaff(staff.filter(s => s.id !== id))
            success('Staff Deleted', 'Staff member has been removed.')
        } catch (err) {
            showError('Error', 'Failed to delete staff')
        }
    }

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-12"
        >
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <Badge variant="outline" className="bg-orange-600/10 text-orange-600 border-orange-600/20 px-3 py-1 font-bold uppercase text-[10px] tracking-widest">
                            ● Team Management
                        </Badge>
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Staff Directory</span>
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white mb-2">
                        Restaurant <span className="text-orange-600">Staff</span>
                    </h1>
                    <p className="text-neutral-400 font-medium text-lg">
                        Manage your team of <span className="text-white font-bold">{stats.total} members</span> across all departments.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        className="h-14 px-8 border-neutral-800 text-neutral-400 font-bold text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                        icon={Shield}
                    >
                        Permissions
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => setShowModal(true)}
                        icon={Plus}
                        className="h-14 px-10 bg-orange-600 hover:bg-orange-500 text-white shadow-lg font-bold uppercase tracking-widest text-xs border-none group"
                    >
                        Add Staff Member
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Total Staff", value: stats.total.toString(), icon: User },
                    { label: "Online Now", value: stats.online.toString(), icon: Check },
                    { label: "Waitstaff", value: stats.waiters.toString(), icon: Utensils },
                    { label: "System Uptime", value: "100%", icon: Shield },
                ].map((stat) => (
                    <motion.div key={stat.label} variants={item}>
                        <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-xl relative overflow-hidden group">
                            <div className="relative z-10 flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4">{stat.label}</p>
                                    <h3 className="text-3xl font-bold text-white tracking-tight">{stat.value}</h3>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-orange-600 group-hover:border-orange-600 transition-all shadow-inner">
                                    <stat.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Search & Filters */}
            <motion.div variants={item}>
                <Card className="p-6 bg-neutral-950 border-neutral-900 shadow-xl">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                        <div className="lg:col-span-12 xl:col-span-8 relative group">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-orange-600 transition-colors" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search members by name or email..."
                                className="w-full h-16 bg-black border border-neutral-800 rounded-2xl pl-16 pr-8 text-sm font-bold tracking-wide text-white placeholder:text-neutral-700 focus:border-orange-600 transition-all outline-none"
                            />
                        </div>
                        <div className="lg:col-span-12 xl:col-span-4 flex gap-2 flex-wrap">
                            {(['all', 'owner', 'manager', 'waiter', 'cashier', 'kitchen'] as const).map((role) => (
                                <button
                                    key={role}
                                    onClick={() => setRoleFilter(role)}
                                    className={cn(
                                        'h-12 px-6 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border',
                                        roleFilter === role
                                            ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                                            : 'bg-black text-neutral-500 border-neutral-800 hover:border-neutral-700 hover:text-white'
                                    )}
                                >
                                    {role === 'all' ? 'All Roles' : roleConfig[role].label}
                                </button>
                            ))}
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* Staff Grid */}
            {filteredStaff.length === 0 ? (
                <motion.div variants={item}>
                    <Card className="h-[40vh] border-dashed border-neutral-800 bg-neutral-950/50 flex flex-col items-center justify-center text-center p-12">
                        <User className="w-16 h-16 mb-4 text-neutral-800/50" />
                        <h2 className="text-xl font-bold text-white mb-2">No Staff Members Found</h2>
                        <p className="text-neutral-500 font-bold text-[10px] tracking-widest uppercase">No data matches your current search or filter criteria.</p>
                    </Card>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {filteredStaff.map((member) => {
                        const cfg = roleConfig[member.role]
                        return (
                            <motion.div key={member.id} variants={item} layout>
                                <Card className={cn(
                                    'p-6 bg-neutral-900 border-neutral-800 hover:border-orange-600/50 group transition-all relative overflow-hidden flex flex-col',
                                    !member.is_active && 'opacity-60 grayscale'
                                )}>
                                    {/* Online Status & Role Badge */}
                                    <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full",
                                                member.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'
                                            )} />
                                            <span className={cn(
                                                "text-[9px] font-bold uppercase tracking-widest",
                                                member.is_active ? 'text-emerald-500' : 'text-neutral-600'
                                            )}>
                                                {member.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <Badge className={cn(
                                            "font-bold text-[10px] uppercase tracking-widest px-3 py-1 border",
                                            cfg.bgColor, cfg.color, 'border-transparent'
                                        )}>
                                            {cfg.label}
                                        </Badge>
                                    </div>

                                    {/* Avatar & Name */}
                                    <div className="flex flex-col items-center text-center mt-12 mb-4">
                                        <div className="relative mb-4">
                                            <div className={cn(
                                                "w-16 h-16 rounded-2xl bg-black border flex items-center justify-center text-xl font-bold relative z-10 transition-colors",
                                                cfg.color, member.is_active ? 'border-emerald-500/50' : 'border-neutral-800'
                                            )}>
                                                {member.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-bold text-white tracking-tight mb-1">{member.name}</h3>
                                        <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">
                                            {member.email || 'No email set'}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        <div className="p-3 bg-black border border-neutral-800 rounded-xl text-center">
                                            <span className="text-sm font-bold text-white">{member.pin || '****'}</span>
                                            <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">PIN</p>
                                        </div>
                                        <div className="p-3 bg-black border border-neutral-800 rounded-xl text-center">
                                            <span className={cn("text-sm font-bold", member.is_active ? 'text-emerald-500' : 'text-rose-500')}>
                                                {member.is_active ? 'Active' : 'Disabled'}
                                            </span>
                                            <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Status</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-auto flex gap-2">
                                        <button
                                            onClick={() => handleToggleActive(member.id)}
                                            className={cn(
                                                'h-10 flex-1 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border',
                                                member.is_active
                                                    ? 'bg-neutral-900 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white hover:border-emerald-500'
                                                    : 'bg-black text-neutral-700 border-neutral-900 hover:bg-neutral-900'
                                            )}
                                        >
                                            {member.is_active ? 'Enabled' : 'Disabled'}
                                        </button>
                                        <button
                                            onClick={() => { setEditingStaff(member); setShowModal(true); }}
                                            className="w-10 h-10 rounded-xl bg-black border border-neutral-800 text-neutral-600 hover:text-orange-600 hover:border-orange-600 flex items-center justify-center transition-all"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(member.id)}
                                            className="w-10 h-10 rounded-xl bg-black border border-neutral-800 text-neutral-600 hover:text-rose-600 hover:border-rose-600 flex items-center justify-center transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </Card>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* Staff Modal */}
            <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingStaff(null); }} title={editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'} size="md">
                <StaffForm
                    staff={editingStaff}
                    onSuccess={() => { setShowModal(false); setEditingStaff(null); }}
                    onCancel={() => { setShowModal(false); setEditingStaff(null); }}
                />
            </Modal>
        </motion.div>
    )
}

function StaffForm({ staff, onSuccess, onCancel }: any) {
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: staff?.name || '',
        email: staff?.email || '',
        role: staff?.role || 'waiter',
        pin: staff?.pin || '',
    })

    const handleSubmit = async (e: any) => {
        e.preventDefault()
        setIsLoading(true)
        await new Promise(r => setTimeout(r, 800))
        setIsLoading(false)
        onSuccess()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 p-2">
            <div className="space-y-6">
                <Input
                    label="Full Name"
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter full name"
                    required
                    icon={User}
                    className="h-14 bg-black border-neutral-800 text-white font-bold tracking-wide"
                />
                <Input
                    label="Email Address"
                    type="email"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@restaurant.com"
                    required
                    icon={Mail}
                    className="h-14 bg-black border-neutral-800 text-white font-bold tracking-wide"
                />

                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">User Role</label>
                    <div className="grid grid-cols-2 gap-3">
                        {(['waiter', 'kitchen', 'manager'] as const).map((role) => (
                            <button
                                key={role}
                                type="button"
                                onClick={() => setFormData({ ...formData, role })}
                                className={cn(
                                    'h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border',
                                    formData.role === role
                                        ? 'bg-orange-600 text-white border-orange-600 shadow-lg'
                                        : 'bg-black text-neutral-500 border-neutral-800 hover:border-neutral-700 hover:text-white'
                                )}
                            >
                                {roleConfig[role].label}
                            </button>
                        ))}
                    </div>
                </div>

                <Input
                    label="Login PIN (4-Digits)"
                    type="password"
                    value={formData.pin}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, pin: e.target.value })}
                    placeholder="••••"
                    required
                    icon={Lock}
                    maxLength={4}
                    className="h-14 bg-black border-neutral-800 text-white font-bold tracking-widest text-center"
                />
            </div>

            <div className="flex gap-4 pt-4">
                <Button
                    variant="outline"
                    className="h-16 flex-1 border-neutral-800 text-neutral-500 font-bold uppercase tracking-widest hover:border-white hover:text-white transition-all"
                    onClick={onCancel}
                    type="button"
                >
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    className="h-16 flex-1 bg-orange-600 hover:bg-orange-500 text-white shadow-xl font-bold uppercase tracking-widest border-none"
                    isLoading={isLoading}
                    type="submit"
                >
                    {staff ? 'Save Changes' : 'Add Member'}
                </Button>
            </div>
        </form>
    )
}
