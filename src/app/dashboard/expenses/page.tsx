'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    DollarSign,
    TrendingDown,
    TrendingUp,
    Plus,
    Search,
    Calendar,
    Receipt,
    Truck,
    Zap,
    Users,
    Package,
    Trash2,
    Filter
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Modal, Input } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface Expense {
    id: string
    category: 'ingredients' | 'utilities' | 'salary' | 'supplies' | 'maintenance' | 'other'
    description: string
    amount: number
    vendor: string | null
    expense_date: string
    payment_method: 'cash' | 'card' | 'transfer'
    receipt_url: string | null
}

const categoryConfig = {
    ingredients: { label: 'Ingredients', icon: Package, color: 'text-orange-500', bg: 'bg-orange-500/20' },
    utilities: { label: 'Utilities', icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
    salary: { label: 'Salaries', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/20' },
    supplies: { label: 'Supplies', icon: Package, color: 'text-purple-500', bg: 'bg-purple-500/20' },
    maintenance: { label: 'Maintenance', icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/20' },
    other: { label: 'Other', icon: Receipt, color: 'text-neutral-400', bg: 'bg-neutral-400/20' },
}

export default function ExpensesPage() {
    const { restaurant } = useAuthStore()
    const { success, error: showError } = useToast()
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')

    const currentMonth = new Date().toISOString().slice(0, 7)

    // Fetch from Supabase
    useEffect(() => {
        async function loadExpenses() {
            if (!restaurant?.id) return
            setIsLoading(true)
            try {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from('expenses')
                    .select('*')
                    .eq('restaurant_id', restaurant.id)
                    .order('expense_date', { ascending: false })

                if (error) throw error
                setExpenses(data || [])
            } catch (err) {
                showError('Error', 'Failed to load expenses')
            } finally {
                setIsLoading(false)
            }
        }
        loadExpenses()
    }, [restaurant?.id])

    const filteredExpenses = expenses.filter(e => {
        const matchesSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (e.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
        const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter
        return matchesSearch && matchesCategory
    })

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
    const thisMonth = expenses.filter(e => e.expense_date.startsWith(currentMonth)).reduce((sum, e) => sum + e.amount, 0)
    const ingredientsCost = expenses.filter(e => e.category === 'ingredients').reduce((sum, e) => sum + e.amount, 0)
    const utilitiesCost = expenses.filter(e => e.category === 'utilities').reduce((sum, e) => sum + e.amount, 0)

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this expense?')) return
        try {
            const supabase = createClient()
            const { error } = await supabase.from('expenses').delete().eq('id', id)
            if (error) throw error
            setExpenses(expenses.filter(e => e.id !== id))
            success('Deleted', 'Expense removed')
        } catch (err) {
            showError('Error', 'Failed to delete expense')
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
                        <Badge variant="outline" className="bg-rose-600/10 text-rose-500 border-rose-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            <TrendingDown className="w-3 h-3 mr-1" /> Expense Tracking
                        </Badge>
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white uppercase">
                        Business <span className="text-rose-500">Expenses</span>
                    </h1>
                    <p className="text-neutral-400 text-lg font-medium">
                        <span className="text-white font-bold">Rs.{thisMonth.toLocaleString()}</span> spent this month
                    </p>
                </div>
                <Button onClick={() => setShowAddModal(true)} icon={Plus} className="h-14 px-10 bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase tracking-widest text-xs">
                    Add Expense
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Expenses', value: `Rs.${totalExpenses.toLocaleString()}`, icon: DollarSign, color: 'text-rose-500' },
                    { label: 'This Month', value: `Rs.${thisMonth.toLocaleString()}`, icon: Calendar, color: 'text-orange-500' },
                    { label: 'Ingredients', value: `Rs.${ingredientsCost.toLocaleString()}`, icon: Package, color: 'text-emerald-500' },
                    { label: 'Utilities', value: `Rs.${utilitiesCost.toLocaleString()}`, icon: Zap, color: 'text-yellow-500' },
                ].map((stat, idx) => (
                    <motion.div key={idx} variants={item}>
                        <Card className="p-5 bg-neutral-900 border-neutral-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">{stat.label}</p>
                                    <h3 className={cn("text-xl font-bold", stat.color)}>{stat.value}</h3>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-neutral-600">
                                    <stat.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search expenses..."
                        className="w-full h-12 bg-black border border-neutral-800 rounded-xl pl-12 pr-4 text-sm text-white placeholder:text-neutral-700 focus:border-rose-600 outline-none"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {['all', ...Object.keys(categoryConfig)].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={cn(
                                "px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all",
                                categoryFilter === cat
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-neutral-900 border border-neutral-800 text-neutral-500 hover:border-neutral-700'
                            )}
                        >
                            {cat === 'all' ? 'All' : categoryConfig[cat as keyof typeof categoryConfig].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Expenses List */}
            <div className="space-y-4">
                {filteredExpenses.map((expense) => {
                    const config = categoryConfig[expense.category]
                    return (
                        <motion.div key={expense.id} variants={item}>
                            <Card className="p-6 bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-all">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    <div className="flex items-center gap-6">
                                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", config.bg)}>
                                            <config.icon className={cn("w-5 h-5", config.color)} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">{expense.description}</h3>
                                            <div className="flex items-center gap-4 mt-1 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                                                <span className="flex items-center gap-1">
                                                    <Truck className="w-3 h-3" /> {expense.vendor || 'Unknown'}
                                                </span>
                                                <span>{new Date(expense.expense_date).toLocaleDateString()}</span>
                                                <Badge className={cn("border-none text-[9px]", config.bg, config.color)}>
                                                    {config.label}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-xl font-bold text-rose-500">Rs.{expense.amount.toLocaleString()}</p>
                                            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                                                {expense.payment_method}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(expense.id)}
                                            className="w-10 h-10 rounded-lg bg-black border border-neutral-800 flex items-center justify-center text-neutral-600 hover:text-rose-500 hover:border-rose-500 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    )
                })}
            </div>

            {/* Add Expense Modal */}
            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Expense" size="md">
                <AddExpenseForm onSuccess={() => { setShowAddModal(false); success('Added', 'Expense recorded') }} onCancel={() => setShowAddModal(false)} />
            </Modal>
        </motion.div>
    )
}

function AddExpenseForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
    const [form, setForm] = useState({
        description: '',
        amount: '',
        category: 'ingredients',
        vendor: '',
        date: new Date().toISOString().split('T')[0],
        payment: 'cash'
    })

    const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm({ ...form, [field]: e.target.value })
    }

    return (
        <div className="space-y-6 py-4">
            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Description *</label>
                    <input
                        type="text"
                        value={form.description}
                        onChange={handleChange('description')}
                        placeholder="What was purchased?"
                        className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white placeholder:text-neutral-700 focus:border-rose-600 outline-none"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Amount (Rs.) *</label>
                        <input
                            type="number"
                            value={form.amount}
                            onChange={handleChange('amount')}
                            placeholder="0"
                            className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white placeholder:text-neutral-700 focus:border-rose-600 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Category</label>
                        <select
                            value={form.category}
                            onChange={handleChange('category')}
                            className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white focus:border-rose-600 outline-none appearance-none"
                        >
                            {Object.entries(categoryConfig).map(([key, val]) => (
                                <option key={key} value={key}>{val.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Vendor</label>
                    <input
                        type="text"
                        value={form.vendor}
                        onChange={handleChange('vendor')}
                        placeholder="Supplier name"
                        className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white placeholder:text-neutral-700 focus:border-rose-600 outline-none"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Date</label>
                        <input
                            type="date"
                            value={form.date}
                            onChange={handleChange('date')}
                            className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white focus:border-rose-600 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Payment</label>
                        <select
                            value={form.payment}
                            onChange={handleChange('payment')}
                            className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white focus:border-rose-600 outline-none appearance-none"
                        >
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="transfer">Transfer</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <Button variant="outline" onClick={onCancel} className="flex-1 h-14 border-neutral-800 text-neutral-500">
                    Cancel
                </Button>
                <Button
                    onClick={onSuccess}
                    disabled={!form.description || !form.amount}
                    className="flex-1 h-14 bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase tracking-widest text-xs"
                >
                    Add Expense
                </Button>
            </div>
        </div>
    )
}
