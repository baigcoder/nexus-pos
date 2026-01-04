'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Award,
    Gift,
    Users,
    TrendingUp,
    Search,
    Plus,
    Star,
    Crown,
    Sparkles,
    Phone,
    Mail,
    ChevronRight,
    History
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Modal, Input } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface LoyaltyMember {
    id: string
    name: string
    phone: string
    email: string | null
    points: number
    tier: 'bronze' | 'silver' | 'gold' | 'platinum'
    total_spent: number
    visits: number
    created_at: string
    last_visit: string | null
}

interface PointsTransaction {
    id: string
    member_id: string
    type: 'earned' | 'redeemed'
    points: number
    order_id: string
    description: string
    created_at: string
}

const tierConfig = {
    bronze: { min: 0, max: 499, color: 'text-orange-700', bg: 'bg-orange-700/20', pointsMultiplier: 1 },
    silver: { min: 500, max: 1999, color: 'text-neutral-400', bg: 'bg-neutral-400/20', pointsMultiplier: 1.5 },
    gold: { min: 2000, max: 4999, color: 'text-yellow-500', bg: 'bg-yellow-500/20', pointsMultiplier: 2 },
    platinum: { min: 5000, max: Infinity, color: 'text-purple-400', bg: 'bg-purple-400/20', pointsMultiplier: 3 },
}

export default function LoyaltyPage() {
    const { restaurant } = useAuthStore()
    const { success, error: showError } = useToast()
    const [members, setMembers] = useState<LoyaltyMember[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null)

    // Fetch from Supabase
    useEffect(() => {
        async function loadMembers() {
            if (!restaurant?.id) return
            setIsLoading(true)
            try {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from('loyalty_members')
                    .select('*')
                    .eq('restaurant_id', restaurant.id)
                    .eq('is_active', true)
                    .order('points', { ascending: false })

                if (error) throw error
                setMembers(data || [])
            } catch (err) {
                showError('Error', 'Failed to load loyalty members')
            } finally {
                setIsLoading(false)
            }
        }
        loadMembers()
    }, [restaurant?.id])

    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.phone.includes(searchQuery)
    )

    const totalMembers = members.length
    const totalPoints = members.reduce((sum, m) => sum + m.points, 0)
    const avgPoints = totalMembers > 0 ? Math.round(totalPoints / totalMembers) : 0
    const platinumCount = members.filter(m => m.tier === 'platinum').length

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
    const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } } }

    const getTierIcon = (tier: string) => {
        switch (tier) {
            case 'platinum': return <Crown className="w-4 h-4" />
            case 'gold': return <Star className="w-4 h-4 fill-current" />
            case 'silver': return <Sparkles className="w-4 h-4" />
            default: return <Award className="w-4 h-4" />
        }
    }

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-10 pb-24">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-purple-600/10 text-purple-500 border-purple-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            <Award className="w-3 h-3 mr-1" /> Loyalty Program
                        </Badge>
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white uppercase">
                        Loyalty <span className="text-purple-500">Points</span>
                    </h1>
                    <p className="text-neutral-400 text-lg font-medium">
                        <span className="text-white font-bold">{totalMembers} members</span> earning rewards
                    </p>
                </div>
                <Button onClick={() => setShowAddModal(true)} icon={Plus} className="h-14 px-10 bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest text-xs">
                    Add Member
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Members', value: totalMembers, icon: Users, color: 'text-purple-500' },
                    { label: 'Total Points', value: totalPoints.toLocaleString(), icon: Award, color: 'text-yellow-500' },
                    { label: 'Avg Points', value: avgPoints, icon: TrendingUp, color: 'text-emerald-500' },
                    { label: 'VIP Members', value: platinumCount, icon: Crown, color: 'text-purple-400' },
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

            {/* Tier Legend */}
            <div className="flex flex-wrap gap-4">
                {Object.entries(tierConfig).map(([tier, config]) => (
                    <div key={tier} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl", config.bg)}>
                        <span className={cn("font-bold text-[10px] uppercase tracking-widest", config.color)}>
                            {tier}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                            {config.min}-{config.max === Infinity ? '∞' : config.max} pts
                        </span>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or phone..."
                    className="w-full h-12 bg-black border border-neutral-800 rounded-xl pl-12 pr-4 text-sm text-white placeholder:text-neutral-700 focus:border-purple-600 outline-none"
                />
            </div>

            {/* Members List */}
            <div className="space-y-4">
                {filteredMembers.map((member) => (
                    <motion.div key={member.id} variants={item}>
                        <Card
                            className="p-6 bg-neutral-900 border-neutral-800 hover:border-purple-500/30 transition-all cursor-pointer"
                            onClick={() => setSelectedMember(member)}
                        >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="flex items-center gap-6">
                                    <div className={cn(
                                        "w-14 h-14 rounded-xl flex items-center justify-center",
                                        tierConfig[member.tier].bg, tierConfig[member.tier].color
                                    )}>
                                        {getTierIcon(member.tier)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-bold text-white">{member.name}</h3>
                                            <Badge className={cn(
                                                "font-bold text-[10px] uppercase tracking-widest border-none",
                                                tierConfig[member.tier].bg, tierConfig[member.tier].color
                                            )}>
                                                {member.tier}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                                            <span className="flex items-center gap-1">
                                                <Phone className="w-3 h-3" /> {member.phone}
                                            </span>
                                            <span>{member.visits} visits</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-purple-500">{member.points.toLocaleString()}</p>
                                        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Points</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-white">Rs.{member.total_spent.toLocaleString()}</p>
                                        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Total Spent</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-neutral-600" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Member Detail Modal */}
            {selectedMember && (
                <Modal
                    isOpen={!!selectedMember}
                    onClose={() => setSelectedMember(null)}
                    title="Member Details"
                    size="md"
                >
                    <div className="space-y-6 py-4">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-16 h-16 rounded-xl flex items-center justify-center",
                                tierConfig[selectedMember.tier].bg, tierConfig[selectedMember.tier].color
                            )}>
                                {getTierIcon(selectedMember.tier)}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">{selectedMember.name}</h3>
                                <Badge className={cn(
                                    "font-bold text-xs uppercase tracking-widest border-none mt-1",
                                    tierConfig[selectedMember.tier].bg, tierConfig[selectedMember.tier].color
                                )}>
                                    {selectedMember.tier} Member
                                </Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-black border border-neutral-800 rounded-xl text-center">
                                <p className="text-3xl font-bold text-purple-500">{selectedMember.points.toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mt-1">Available Points</p>
                            </div>
                            <div className="p-4 bg-black border border-neutral-800 rounded-xl text-center">
                                <p className="text-3xl font-bold text-emerald-500">{tierConfig[selectedMember.tier].pointsMultiplier}x</p>
                                <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mt-1">Points Multiplier</p>
                            </div>
                        </div>

                        <div className="p-4 bg-neutral-900 rounded-xl space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-neutral-500 flex items-center gap-2"><Phone className="w-4 h-4" /> Phone</span>
                                <span className="text-white font-bold">{selectedMember.phone}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-neutral-500 flex items-center gap-2"><Mail className="w-4 h-4" /> Email</span>
                                <span className="text-white font-bold">{selectedMember.email}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-neutral-500">Total Spent</span>
                                <span className="text-white font-bold">Rs.{selectedMember.total_spent.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-neutral-500">Total Visits</span>
                                <span className="text-white font-bold">{selectedMember.visits}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-neutral-500">Member Since</span>
                                <span className="text-white font-bold">{new Date(selectedMember.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-neutral-500">Last Visit</span>
                                <span className="text-white font-bold">{selectedMember.last_visit ? new Date(selectedMember.last_visit).toLocaleDateString() : 'No visits yet'}</span>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <Button
                                variant="outline"
                                icon={Gift}
                                className="flex-1 h-14 border-emerald-600/30 text-emerald-500 hover:bg-emerald-500 hover:text-white"
                            >
                                Redeem Points
                            </Button>
                            <Button
                                icon={Plus}
                                className="flex-1 h-14 bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest text-xs"
                            >
                                Add Points
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Add Member Modal */}
            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Loyalty Member" size="md">
                <AddMemberForm onSuccess={() => { setShowAddModal(false); success('Added', 'New member enrolled!') }} onCancel={() => setShowAddModal(false)} />
            </Modal>
        </motion.div>
    )
}

function AddMemberForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
    const [form, setForm] = useState({ name: '', phone: '', email: '' })

    const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [field]: e.target.value })
    }

    return (
        <div className="space-y-6 py-4">
            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Name *</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={handleChange('name')}
                        placeholder="Customer name"
                        className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white placeholder:text-neutral-700 focus:border-purple-600 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Phone *</label>
                    <input
                        type="tel"
                        value={form.phone}
                        onChange={handleChange('phone')}
                        placeholder="+92 300 1234567"
                        className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white placeholder:text-neutral-700 focus:border-purple-600 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Email</label>
                    <input
                        type="email"
                        value={form.email}
                        onChange={handleChange('email')}
                        placeholder="email@example.com"
                        className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white placeholder:text-neutral-700 focus:border-purple-600 outline-none"
                    />
                </div>
            </div>

            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-2">Benefits</p>
                <ul className="text-sm text-neutral-400 space-y-1">
                    <li>• Earn 1 point per Rs.10 spent</li>
                    <li>• Redeem points for discounts</li>
                    <li>• Tier upgrades with bonus multipliers</li>
                </ul>
            </div>

            <div className="flex gap-4">
                <Button variant="outline" onClick={onCancel} className="flex-1 h-14 border-neutral-800 text-neutral-500">
                    Cancel
                </Button>
                <Button
                    onClick={onSuccess}
                    disabled={!form.name || !form.phone}
                    className="flex-1 h-14 bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest text-xs"
                >
                    Enroll Member
                </Button>
            </div>
        </div>
    )
}
