'use client'

import { useState, useEffect } from 'react'
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
  History,
  RefreshCw,
  TrendingDown,
  Receipt,
  Wallet,
  Percent
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Badge } from '@/components/ui/common'
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
  is_active: boolean
}

interface PointsTransaction {
  id: string
  member_id: string
  type: 'earned' | 'redeemed'
  points: number
  order_id: string | null
  description: string
  created_at: string
  running_balance: number
}

interface TierConfig {
  min: number
  max: number
  color: string
  bg: string
  pointsMultiplier: number
  icon: React.ElementType
}

const tierConfig: Record<string, TierConfig> = {
  bronze: { min: 0, max: 499, color: 'text-orange-400', bg: 'bg-brand/20', pointsMultiplier: 1, icon: Award },
  silver: { min: 500, max: 1999, color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--border)]', pointsMultiplier: 1.5, icon: Sparkles },
  gold: { min: 2000, max: 4999, color: 'text-yellow-400', bg: 'bg-yellow-500/20', pointsMultiplier: 2, icon: Star },
  platinum: { min: 5000, max: Infinity, color: 'text-purple-400', bg: 'bg-purple-500/20', pointsMultiplier: 3, icon: Crown },
}

const calculateTier = (points: number): string => {
  if (points >= 5000) return 'platinum'
  if (points >= 2000) return 'gold'
  if (points >= 500) return 'silver'
  return 'bronze'
}

export default function LoyaltyPage() {
  const { restaurant, isLoading: authLoading } = useAuthStore()
  const { success, error: showError } = useToast()
  const [members, setMembers] = useState<LoyaltyMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPointsModal, setShowPointsModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null)
  const [pointsAction, setPointsAction] = useState<'add' | 'redeem'>('add')
  const [pointsAmount, setPointsAmount] = useState('')
  const [pointsNote, setPointsNote] = useState('')

  const loadMembers = async () => {
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
      console.error('Error loading members:', err)
      showError('Error', 'Failed to load loyalty members')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && restaurant?.id) {
      loadMembers()
    }
  }, [restaurant?.id, authLoading])

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.phone.includes(searchQuery) ||
    (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const totalMembers = members.length
  const totalPoints = members.reduce((sum, m) => sum + m.points, 0)
  const totalSpent = members.reduce((sum, m) => sum + m.total_spent, 0)
  const avgPoints = totalMembers > 0 ? Math.round(totalPoints / totalMembers) : 0
  const platinumCount = members.filter(m => m.tier === 'platinum').length
  const goldCount = members.filter(m => m.tier === 'gold').length

  const tierDistribution = {
    platinum: members.filter(m => m.tier === 'platinum').length,
    gold: members.filter(m => m.tier === 'gold').length,
    silver: members.filter(m => m.tier === 'silver').length,
    bronze: members.filter(m => m.tier === 'bronze').length,
  }

  const handleAddMember = async (form: { name: string; phone: string; email: string }) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('loyalty_members')
        .insert({
          restaurant_id: restaurant?.id,
          name: form.name,
          phone: form.phone,
          email: form.email || null,
          points: 0,
          tier: 'bronze',
          total_spent: 0,
          visits: 0,
          is_active: true
        })

      if (error) throw error
      success('Member Added', `${form.name} enrolled successfully`)
      setShowAddModal(false)
      loadMembers()
    } catch (err) {
      showError('Error', 'Failed to add member')
    }
  }

  const handlePointsAction = async () => {
    if (!selectedMember || !pointsAmount) return
    const amount = parseInt(pointsAmount)
    if (isNaN(amount) || amount <= 0) {
      showError('Invalid', 'Please enter a valid amount')
      return
    }

    try {
      const supabase = createClient()
      let newPoints = selectedMember.points

      if (pointsAction === 'add') {
        newPoints = selectedMember.points + amount
      } else {
        if (amount > selectedMember.points) {
          showError('Insufficient', 'Not enough points to redeem')
          return
        }
        newPoints = selectedMember.points - amount
      }

      const newTier = calculateTier(newPoints)
      const { error } = await supabase
        .from('loyalty_members')
        .update({
          points: newPoints,
          tier: newTier
        })
        .eq('id', selectedMember.id)

      if (error) throw error
      success('Points Updated', `${pointsAction === 'add' ? 'Added' : 'Redeemed'} ${amount} points`)
      setShowPointsModal(false)
      setPointsAmount('')
      setPointsNote('')
      loadMembers()
    } catch (err) {
      showError('Error', 'Failed to update points')
    }
  }

  const getTierIcon = (tier: string) => {
    const config = tierConfig[tier] || tierConfig.bronze
    const Icon = config.icon
    return <Icon className="w-4 h-4" />
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="outline" className="bg-brand-subtle text-brand border-brand/20 px-3 py-1">
            <Award className="w-3 h-3 mr-1" /> Loyalty Program
          </Badge>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">
            Loyalty <span className="text-brand">Points</span>
          </h1>
          <p className="text-[var(--text-muted)] text-sm">
            <span className="text-[var(--text-primary)] font-medium">{totalMembers}</span> members enrolled
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadMembers}
            disabled={isLoading}
            className="h-11 px-4 rounded-xl bg-[var(--surface-active)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--surface-active)] flex items-center gap-2 transition-all text-sm"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="h-11 px-5 rounded-xl bg-purple-500 hover:bg-purple-600 text-[var(--text-primary)] font-medium text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Member
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide">Total Members</span>
            <Users className="w-4 h-4 text-brand" />
          </div>
          <p className="text-3xl font-bold text-[var(--text-primary)]">{totalMembers}</p>
        </div>
        <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide">Total Points</span>
            <Award className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-yellow-500">{totalPoints.toLocaleString()}</p>
        </div>
        <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide">Total Spent</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-emerald-500">Rs.{totalSpent.toLocaleString()}</p>
        </div>
        <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wide">VIP Members</span>
            <Crown className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-purple-400">{platinumCount + goldCount}</p>
        </div>
      </div>

      {/* Tier Distribution */}
      <div className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Tier Distribution</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(tierDistribution).map(([tier, count]) => {
            const config = tierConfig[tier]
            const pct = totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0
            return (
              <div key={tier} className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--surface)]/50 border border-[var(--border)]">
                  <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", config.bg, config.color)}>
                    {getTierIcon(tier)}
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)] capitalize">{tier}</span>
                  <span className="text-xs text-[var(--text-muted)]">{count}</span>
                </div>
                <div className="w-16 h-1.5 bg-[var(--surface-active)] rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", config.color.replace('text-', 'bg-'))}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tier Info */}
      <div className="flex flex-wrap gap-3 p-4 bg-[var(--surface-raised)]/30 border border-[var(--border)] rounded-xl">
        <span className="text-xs text-[var(--text-muted)] font-medium">Tier Benefits:</span>
        {Object.entries(tierConfig).map(([tier, config]) => (
          <div key={tier} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg", config.bg)}>
            <span className={cn("font-medium text-xs capitalize", config.color)}>{tier}</span>
            <span className="text-xs text-[var(--text-muted)]">×{config.pointsMultiplier}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, phone, or email..."
          className="w-full h-12 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl pl-12 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-purple-500 outline-none"
        />
      </div>

      {/* Members List */}
      {isLoading ? (
        <div className="text-center py-20 text-[var(--text-muted)]">Loading members...</div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-[var(--border)] rounded-2xl">
          <Award className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Members Found</h3>
          <p className="text-[var(--text-muted)] text-sm mb-4">Start by adding your first loyalty member</p>
          <button onClick={() => setShowAddModal(true)} className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-[var(--text-primary)] text-sm font-medium rounded-xl">
            Add First Member
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              onClick={() => setSelectedMember(member)}
              className="p-5 bg-[var(--surface-raised)]/50 border border-[var(--border)] rounded-2xl hover:border-brand/30 transition-all cursor-pointer"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
                    tierConfig[member.tier].bg, tierConfig[member.tier].color
                  )}>
                    {getTierIcon(member.tier)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)]">{member.name}</h3>
                      <span className={cn(
                        "text-xs font-medium px-2.5 py-1 rounded-full capitalize",
                        tierConfig[member.tier].bg, tierConfig[member.tier].color
                      )}>
                        {member.tier}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {member.phone}
                      </span>
                      <span>{member.visits} visits</span>
                      <span>Rs.{member.total_spent.toLocaleString()} spent</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-brand">{member.points.toLocaleString()}</p>
                    <p className="text-xs text-[var(--text-muted)]">Points</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-yellow-500">×{tierConfig[member.tier].pointsMultiplier}</p>
                    <p className="text-xs text-[var(--text-muted)]">Multiplier</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Member Detail Modal */}
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          restaurantId={restaurant?.id || ''}
          onClose={() => setSelectedMember(null)}
          onAction={() => { setSelectedMember(null); loadMembers(); }}
          onAddPoints={() => { setSelectedMember(selectedMember); setPointsAction('add'); setShowPointsModal(true); }}
          onRedeemPoints={() => { setSelectedMember(selectedMember); setPointsAction('redeem'); setShowPointsModal(true); }}
          onViewHistory={() => { setSelectedMember(selectedMember); setShowHistoryModal(true); }}
        />
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface)]/60 backdrop-blur-sm">
          <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 mx-4">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">Add Loyalty Member</h2>
            <AddMemberForm onSubmit={handleAddMember} onCancel={() => setShowAddModal(false)} />
          </div>
        </div>
      )}

      {/* Points Action Modal */}
      {showPointsModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface)]/60 backdrop-blur-sm">
          <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center gap-3 mb-6">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                pointsAction === 'add' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'
              )}>
                {pointsAction === 'add' ? <Plus className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{pointsAction === 'add' ? 'Add Points' : 'Redeem Points'}</h2>
                <p className="text-sm text-[var(--text-muted)]">{selectedMember.name}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2 block">Points Amount</label>
                <input
                  type="number"
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(e.target.value)}
                  placeholder="Enter points"
                  className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-[var(--text-primary)] text-lg font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2 block">Note (optional)</label>
                <input
                  type="text"
                  value={pointsNote}
                  onChange={(e) => setPointsNote(e.target.value)}
                  placeholder="e.g., Birthday bonus, Referral reward"
                  className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-sm text-[var(--text-primary)]"
                />
              </div>
              <div className="p-4 bg-[var(--surface-active)]/50 rounded-xl">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-[var(--text-muted)]">Current Balance</span>
                  <span className="text-[var(--text-primary)] font-medium">{selectedMember.points.toLocaleString()} pts</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">{pointsAction === 'add' ? 'After Addition' : 'After Redemption'}</span>
                  <span className={cn(
                    "font-medium",
                    pointsAction === 'add' ? 'text-emerald-500' : 'text-rose-500'
                  )}>
                    {pointsAction === 'add'
                      ? (selectedMember.points + (parseInt(pointsAmount) || 0)).toLocaleString()
                      : (selectedMember.points - (parseInt(pointsAmount) || 0)).toLocaleString()
                    } pts
                  </span>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowPointsModal(false); setPointsAmount(''); setPointsNote(''); }}
                  className="flex-1 h-12 bg-[var(--surface-active)] text-[var(--text-muted)] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePointsAction}
                  disabled={!pointsAmount || parseInt(pointsAmount) <= 0}
                  className={cn(
                    "flex-1 h-12 rounded-xl font-medium text-[var(--text-primary)]",
                    pointsAction === 'add'
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-rose-500 hover:bg-rose-600'
                  )}
                >
                  {pointsAction === 'add' ? 'Add Points' : 'Redeem Points'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface)]/60 backdrop-blur-sm">
          <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl w-full max-w-lg p-6 mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Points History</h2>
              <button onClick={() => setShowHistoryModal(false)} className="w-8 h-8 rounded-lg bg-[var(--surface-active)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                ✕
              </button>
            </div>
            <div className="flex items-center gap-4 mb-6 p-4 bg-[var(--surface-active)]/50 rounded-xl">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
                tierConfig[selectedMember.tier].bg, tierConfig[selectedMember.tier].color
              )}>
                {getTierIcon(selectedMember.tier)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[var(--text-primary)]">{selectedMember.name}</p>
                <p className="text-sm text-[var(--text-muted)]">{selectedMember.points.toLocaleString()} points available</p>
              </div>
            </div>
            <PointsHistory memberId={selectedMember.id} restaurantId={restaurant?.id || ''} />
          </div>
        </div>
      )}
    </div>
  )
}

function AddMemberForm({ onSubmit, onCancel }: { onSubmit: (data: { name: string; phone: string; email: string }) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' })

  const handleSubmit = () => {
    if (!form.name.trim() || !form.phone.trim()) return
    onSubmit(form)
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2 block">Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Customer name"
          className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-sm text-[var(--text-primary)]"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2 block">Phone *</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+92 300 1234567"
          className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-sm text-[var(--text-primary)]"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2 block">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="email@example.com"
          className="w-full h-12 bg-[var(--surface-active)] border border-[var(--border-strong)] rounded-xl px-4 text-sm text-[var(--text-primary)]"
        />
      </div>

      <div className="p-4 bg-brand-subtle border border-brand/20 rounded-xl">
        <p className="text-xs font-medium text-purple-400 mb-2">Benefits</p>
        <ul className="text-sm text-[var(--text-muted)] space-y-1">
          <li>• Earn 1 point per Rs.10 spent</li>
          <li>• Tier upgrades with bonus multipliers</li>
          <li>• Redeem points for rewards</li>
        </ul>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 h-12 bg-[var(--surface-active)] text-[var(--text-muted)] rounded-xl font-medium">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!form.name.trim() || !form.phone.trim()}
          className="flex-1 h-12 bg-purple-500 hover:bg-purple-600 text-[var(--text-primary)] rounded-xl font-medium disabled:opacity-50"
        >
          Enroll Member
        </button>
      </div>
    </div>
  )
}

function MemberDetailModal({
  member,
  restaurantId,
  onClose,
  onAction,
  onAddPoints,
  onRedeemPoints,
  onViewHistory
}: {
  member: LoyaltyMember
  restaurantId: string
  onClose: () => void
  onAction: () => void
  onAddPoints: () => void
  onRedeemPoints: () => void
  onViewHistory: () => void
}) {
  const config = tierConfig[member.tier]
  const nextTier = member.tier === 'bronze' ? 'silver' : member.tier === 'silver' ? 'gold' : member.tier === 'gold' ? 'platinum' : null
  const pointsToNextTier = nextTier ? config.min - member.points : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface)]/60 backdrop-blur-sm">
      <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Member Details</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[var(--surface-active)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            ✕
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className={cn(
            "w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold",
            config.bg, config.color
          )}>
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{member.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full capitalize", config.bg, config.color)}>
                {member.tier} Member
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 bg-[var(--surface-active)]/50 rounded-xl text-center">
            <p className="text-2xl font-bold text-brand">{member.points.toLocaleString()}</p>
            <p className="text-xs text-[var(--text-muted)]">Available Points</p>
          </div>
          <div className="p-4 bg-[var(--surface-active)]/50 rounded-xl text-center">
            <p className="text-2xl font-bold text-yellow-500">×{config.pointsMultiplier}</p>
            <p className="text-xs text-[var(--text-muted)]">Multiplier</p>
          </div>
        </div>

        {pointsToNextTier && pointsToNextTier > 0 && (
          <div className="mb-6 p-4 bg-[var(--surface-active)]/30 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[var(--text-muted)]">Progress to {nextTier}</span>
              <span className="text-sm text-[var(--text-muted)]">{pointsToNextTier} pts needed</span>
            </div>
            <div className="w-full h-2 bg-[var(--surface-active)] rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", config.color.replace('text-', 'bg-'))}
                style={{ width: `${Math.min(100, (member.points / config.max) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)] flex items-center gap-2"><Phone className="w-4 h-4" /> Phone</span>
            <span className="text-[var(--text-primary)] font-medium">{member.phone}</span>
          </div>
          {member.email && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)] flex items-center gap-2"><Mail className="w-4 h-4" /> Email</span>
              <span className="text-[var(--text-primary)] font-medium">{member.email}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Total Spent</span>
            <span className="text-[var(--text-primary)] font-medium">Rs.{member.total_spent.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Total Visits</span>
            <span className="text-[var(--text-primary)] font-medium">{member.visits}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Member Since</span>
            <span className="text-[var(--text-primary)] font-medium">{new Date(member.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Last Visit</span>
            <span className="text-[var(--text-primary)] font-medium">{member.last_visit ? new Date(member.last_visit).toLocaleDateString() : 'No visits yet'}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onViewHistory}
            className="h-12 px-4 bg-[var(--surface-active)] text-[var(--text-muted)] rounded-xl font-medium flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            History
          </button>
          <button
            onClick={onRedeemPoints}
            disabled={member.points < 100}
            className="flex-1 h-12 bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <TrendingDown className="w-4 h-4" />
            Redeem
          </button>
          <button
            onClick={onAddPoints}
            className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 text-[var(--text-primary)] rounded-xl font-medium flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Points
          </button>
        </div>
      </div>
    </div>
  )
}

function PointsHistory({ memberId, restaurantId }: { memberId: string; restaurantId: string }) {
  const [transactions, setTransactions] = useState<PointsTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadHistory() {
      if (!memberId || !restaurantId) return
      setIsLoading(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('points_transactions')
          .select('*')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(50)

        setTransactions(data || [])
      } catch (err) {
        console.error('History error:', err)
        setTransactions([])
      } finally {
        setIsLoading(false)
      }
    }
    loadHistory()
  }, [memberId, restaurantId])

  if (isLoading) {
    return <div className="text-center py-10 text-[var(--text-muted)]">Loading history...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-2">
      {transactions.length === 0 ? (
        <div className="text-center py-10 text-[var(--text-muted)]">
          <Receipt className="w-10 h-10 mx-auto mb-2 text-[var(--text-muted)]" />
          <p>No transaction history</p>
        </div>
      ) : (
        transactions.map(tx => (
          <div key={tx.id} className="flex items-center justify-between p-3 bg-[var(--surface-active)]/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                tx.type === 'earned' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'
              )}>
                {tx.type === 'earned' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{tx.description || (tx.type === 'earned' ? 'Points Earned' : 'Points Redeemed')}</p>
                <p className="text-xs text-[var(--text-muted)]">{new Date(tx.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn("text-sm font-bold", tx.type === 'earned' ? 'text-emerald-500' : 'text-rose-500')}>
                {tx.type === 'earned' ? '+' : '-'}{tx.points}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Bal: {tx.running_balance}</p>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
