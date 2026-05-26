'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Tag,
  Plus,
  Search,
  Percent,
  DollarSign,
  Calendar,
  Copy,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Modal, Input } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface DiscountCode {
  id: string
  code: string
  description: string | null
  type: 'percentage' | 'fixed'
  value: number
  min_order_amount: number
  max_discount: number | null
  usage_limit: number | null
  times_used: number
  valid_until: string | null
  is_active: boolean
}

export default function DiscountsPage() {
  const { restaurant } = useAuthStore()
  const { success, error: showError } = useToast()
  const [codes, setCodes] = useState<DiscountCode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch from Supabase
  useEffect(() => {
    async function loadCodes() {
      if (!restaurant?.id) return
      setIsLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('discount_codes')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setCodes(data || [])
      } catch (err) {
        showError('Error', 'Failed to load discount codes')
      } finally {
        setIsLoading(false)
      }
    }
    loadCodes()
  }, [restaurant?.id])

  const filteredCodes = codes.filter(c =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeCount = codes.filter(c => c.is_active).length
  const totalRedemptions = codes.reduce((sum, c) => sum + c.times_used, 0)

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    success('Copied!', `Code "${code}" copied to clipboard`)
  }

  const handleToggleActive = async (id: string) => {
    const code = codes.find(c => c.id === id)
    if (!code) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('discount_codes')
        .update({ is_active: !code.is_active })
        .eq('id', id)

      if (error) throw error
      setCodes(codes.map(c => c.id === id ? { ...c, is_active: !c.is_active } : c))
      success('Updated', `Code ${code.is_active ? 'disabled' : 'enabled'}`)
    } catch (err) {
      showError('Error', 'Failed to update code')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this discount code?')) return

    try {
      const supabase = createClient()
      const { error } = await supabase.from('discount_codes').delete().eq('id', id)
      if (error) throw error
      setCodes(codes.filter(c => c.id !== id))
      success('Deleted', 'Discount code removed')
    } catch (err) {
      showError('Error', 'Failed to delete code')
    }
  }

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } } }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-10 pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-brand-subtle text-brand border-brand/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
              ● Promotions
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Discount <span className="text-brand">Codes</span>
          </h1>
          <p className="text-[var(--text-muted)] text-lg font-medium">
            <span className="text-[var(--text-primary)] font-bold">{activeCount} active</span> codes • {totalRedemptions} redemptions
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} icon={Plus} className="h-14 px-10 bg-pink-600 hover:bg-pink-500 text-[var(--text-primary)] font-bold uppercase tracking-widest text-xs">
          Create Code
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Codes', value: codes.length, icon: Tag, color: 'text-brand' },
          { label: 'Active', value: activeCount, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Redemptions', value: totalRedemptions, icon: Percent, color: 'text-blue-500' },
          { label: 'Expired', value: codes.filter(c => !c.is_active).length, icon: XCircle, color: 'text-[var(--text-muted)]' },
        ].map((stat, idx) => (
          <motion.div key={idx} variants={item}>
            <Card className="p-5 bg-[var(--surface-raised)] border-[var(--border)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">{stat.label}</p>
                  <h3 className={cn("text-2xl font-bold", stat.color)}>{stat.value}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search discount codes..."
          className="w-full h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-12 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-pink-600 outline-none"
        />
      </div>

      {/* Codes List */}
      <div className="space-y-4">
        {filteredCodes.map((code) => (
          <motion.div key={code.id} variants={item}>
            <Card className={cn(
              "p-6 bg-[var(--surface-raised)] border-[var(--border)] transition-all",
              code.is_active ? 'hover:border-brand/30' : 'opacity-60'
            )}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl",
                    code.type === 'percentage' ? 'bg-pink-600/20 text-brand' : 'bg-emerald-600/20 text-emerald-500'
                  )}>
                    {code.type === 'percentage' ? <Percent className="w-6 h-6" /> : <DollarSign className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-widest">{code.code}</h3>
                      <button onClick={() => handleCopyCode(code.code)} className="text-[var(--text-muted)] hover:text-brand transition-colors">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[var(--text-muted)] text-sm mt-1">{code.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                      <span className="text-brand">
                        {code.type === 'percentage' ? `${code.value}% OFF` : `Rs.${code.value} OFF`}
                      </span>
                      {code.min_order_amount > 0 && <span>Min: Rs.{code.min_order_amount}</span>}
                      {code.max_discount && <span>Max: Rs.{code.max_discount}</span>}
                      {code.valid_until && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Until {code.valid_until}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center px-4">
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{code.times_used}</p>
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Used</p>
                  </div>
                  {code.usage_limit && (
                    <div className="text-center px-4 border-l border-[var(--border)]">
                      <p className="text-2xl font-bold text-[var(--text-muted)]">{code.usage_limit}</p>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Limit</p>
                    </div>
                  )}
                  <div className="flex gap-2 pl-4 border-l border-[var(--border)]">
                    <button
                      onClick={() => handleToggleActive(code.id)}
                      className={cn(
                        "h-10 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border",
                        code.is_active
                          ? 'bg-emerald-600/10 text-emerald-500 border-emerald-600/20 hover:bg-emerald-600 hover:text-[var(--text-primary)]'
                          : 'bg-[var(--surface-active)] text-[var(--text-muted)] border-[var(--border-strong)] hover:bg-[var(--surface-active)]'
                      )}
                    >
                      {code.is_active ? 'Active' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => handleDelete(code.id)}
                      className="w-10 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-rose-500 hover:border-rose-500 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Discount Code" size="md">
        <DiscountCodeForm onSuccess={() => { setShowModal(false); success('Created', 'Discount code added') }} onCancel={() => setShowModal(false)} />
      </Modal>
    </motion.div>
  )
}

function DiscountCodeForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const { restaurant } = useAuthStore()
  const { success, error: showError } = useToast()
  const [form, setForm] = useState({
    code: '',
    description: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: '',
    minOrder: '',
    maxDiscount: '',
    validUntil: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [field]: field === 'code' ? e.target.value.toUpperCase() : e.target.value })
  }

  const handleSubmit = async () => {
    if (!form.code || !form.value || !restaurant?.id) return
    setIsSaving(true)

    try {
      const supabase = createClient()
      const insertData = {
        restaurant_id: restaurant.id,
        code: form.code,
        description: form.description || null,
        type: form.type,
        value: parseFloat(form.value),
        min_order_amount: form.minOrder ? parseFloat(form.minOrder) : 0,
        max_discount: form.maxDiscount ? parseFloat(form.maxDiscount) : null,
        valid_from: new Date().toISOString(),
        valid_until: form.validUntil ? new Date(form.validUntil).toISOString() : null,
        is_active: true,
        times_used: 0,
      }

      const { error } = await supabase
        .from('discount_codes')
        .insert(insertData)

      if (error) throw error

      success('Created', 'Discount code added successfully')
      onSuccess()
    } catch (err) {
      console.error('Failed to save discount:', err)
      showError('Error', 'Failed to save discount code')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-4">
        <Input label="Code" value={form.code} onChange={handleChange('code')} placeholder="e.g., SAVE20" />
        <Input label="Description" value={form.description} onChange={handleChange('description')} placeholder="What is this code for?" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Type</p>
            <div className="flex gap-2">
              {(['percentage', 'fixed'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, type: t })}
                  className={cn(
                    "flex-1 h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                    form.type === t ? 'bg-pink-600 text-[var(--text-primary)] border-pink-600' : 'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]'
                  )}
                >
                  {t === 'percentage' ? '% Off' : 'Fixed'}
                </button>
              ))}
            </div>
          </div>
          <Input label="Value" type="number" value={form.value} onChange={handleChange('value')} placeholder={form.type === 'percentage' ? '20' : '100'} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Min Order (Rs.)" type="number" value={form.minOrder} onChange={handleChange('minOrder')} placeholder="500" />
          <Input label="Max Discount (Rs.)" type="number" value={form.maxDiscount} onChange={handleChange('maxDiscount')} placeholder="300" />
        </div>
        <Input label="Valid Until" type="date" value={form.validUntil} onChange={handleChange('validUntil')} />
      </div>
      <div className="flex gap-4">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-14 border-[var(--border)] text-[var(--text-muted)] hover:border-white hover:text-[var(--text-primary)]">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!form.code || !form.value || isSaving}
          isLoading={isSaving}
          className="flex-1 h-14 bg-pink-600 hover:bg-pink-500 text-[var(--text-primary)] font-bold uppercase tracking-widest text-xs"
        >
          Create Code
        </Button>
      </div>
    </div>
  )
}
