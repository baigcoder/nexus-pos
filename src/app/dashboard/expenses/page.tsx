'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  TrendingDown,
  Plus,
  Search,
  Calendar,
  Receipt,
  Truck,
  Zap,
  Users,
  Package,
  Trash2,
  Sparkles,
  RefreshCw,
  Lightbulb,
  Wand2,
  X,
  Check,
  AlertCircle,
  Brain,
  TrendingUp,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  Bot,
  ArrowUpRight,
  Filter,
  ChevronDown,
  Eye,
  EyeOff,
  Link2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'
import {
  PageHeader,
  StatCard,
  SectionCard,
  ActionButton,
  EmptyState,
  DashboardSearch,
  FilterButton,
  itemVariants,
  containerVariants,
} from '@/components/dashboard/shared'

interface Expense {
  id: string
  category: 'ingredients' | 'utilities' | 'salary' | 'supplies' | 'maintenance' | 'other'
  description: string
  amount: number
  vendor: string | null
  expense_date: string
  payment_method: 'cash' | 'card' | 'transfer'
  receipt_url: string | null
  created_at?: string
}

interface AIExpenseAnalysis {
  description: string
  category: 'ingredients' | 'utilities' | 'salary' | 'supplies' | 'maintenance' | 'other'
  suggested_vendor?: string
  confidence: number
}

interface ExpenseInsight {
  type: 'warning' | 'success' | 'info' | 'opportunity'
  title: string
  description: string
  metric?: string
  action?: string
  icon: string
}

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  ingredients: { label: 'Ingredients', icon: Package, color: 'text-brand', bg: 'bg-brand-subtle' },
  utilities: { label: 'Utilities', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  salary: { label: 'Salaries', icon: Users, color: 'text-sky-500', bg: 'bg-sky-500/10' },
  supplies: { label: 'Supplies', icon: Package, color: 'text-brand', bg: 'bg-brand-subtle' },
  maintenance: { label: 'Maintenance', icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  other: { label: 'Other', icon: Receipt, color: 'text-[var(--text-muted)]', bg: 'bg-[var(--surface-active)]' },
}

const categoryKeywords: Record<string, string[]> = {
  ingredients: [
    'chicken', 'meat', 'fish', 'vegetable', 'fruit', 'rice', 'flour', 'oil', 'spice',
    'grain', 'dal', 'lentil', 'onion', 'tomato', 'potato', 'mutton', 'beef',
    'dairy', 'milk', 'cream', 'butter', 'cheese', 'yogurt', 'wheat', 'sugar',
    'salt', 'pepper', 'sauce', 'ketchup', 'mayo', 'powder', 'stock', 'basil',
    'pizza', 'burger', 'bread', 'roll', 'wrap', 'filling', 'topping', 'marinade'
  ],
  utilities: [
    'electric', 'electricity', 'bill', 'gas', 'water', 'internet', 'wifi', 'broadband',
    'generator', 'fuel', 'diesel', 'petrol', 'power', 'load', 'tubewell', 'pump'
  ],
  salary: [
    'salary', 'wage', 'bonus', 'allowance', 'overtime', 'commission', 'incentive',
    'pay', 'staff payment', 'employee', 'worker', 'kitchen', 'waiter', 'cashier',
    'delivery', 'manager', 'chef', 'cook', 'cleaner', 'security'
  ],
  supplies: [
    'napkin', 'tissue', 'paper', 'foil', 'wrap', 'box', 'container', 'bag',
    'plastic', 'cutlery', 'fork', 'spoon', 'knife', 'plate', 'bowl', 'cup',
    'glass', 'straw', 'takeaway', 'to-go', 'packaging', 'label', 'tag'
  ],
  maintenance: [
    'repair', 'fix', 'maintenance', 'service', 'cleaning', 'plumber', 'electrician',
    'ac', 'air condition', 'fridge', 'refrigerator', 'oven', 'stove', 'grill',
    'hood', 'exhaust', 'fan', 'pipe', 'drain', 'leak', 'paint', 'renovation'
  ]
}

const vendorHints: Record<string, string[]> = {
  'Makkah Cash & Carry': ['makkah', 'makkah'],
  'Cash & Carry': ['cash', 'carry', 'whole sale', 'wholesale'],
  'Butcher Shop': ['butcher', 'meat', 'beef', 'mutton', 'chicken shop'],
  'Sabzi Mandi': ['sabzi', 'vegetable', 'fruit mandi', 'wholesale market'],
  'Shell Station': ['shell', 'fuel', 'petrol', 'gas station'],
  'K Electric': ['k-electric', 'electricity', 'electric'],
  'Sui Gas': ['sui gas', 'gas bill', 'gas company'],
  'Water Board': ['water', 'water board', 'kwsb']
}

export default function ExpensesPage() {
  const { restaurant, isLoading: authLoading } = useAuthStore()
  const { success, error: showError } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [insights, setInsights] = useState<ExpenseInsight[]>([])
  const [aiSummary, setAiSummary] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7)

  const loadExpenses = useCallback(async () => {
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

      if (data && data.length > 0) {
        generateDeepInsights(data)
      }
    } catch (err) {
      console.error('Error loading expenses:', err)
      showError('Error', 'Failed to load expenses')
    } finally {
      setIsLoading(false)
    }
  }, [restaurant?.id, showError])

  useEffect(() => {
    if (!authLoading && restaurant?.id) {
      loadExpenses()
    }
  }, [restaurant?.id, authLoading, loadExpenses])

  // Deep AI analysis of expenses
  const generateDeepInsights = (expenseData: Expense[]) => {
    const insightsList: ExpenseInsight[] = []

    // Total spending
    const total = expenseData.reduce((sum, e) => sum + e.amount, 0)
    const avgExpense = total / expenseData.length

    // Category breakdown
    const byCategory = expenseData.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount
      return acc
    }, {} as Record<string, number>)

    const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1])

    // Highest category
    if (categories.length > 0) {
      const [highestCat, highestAmount] = categories[0]
      insightsList.push({
        type: 'info',
        title: `${categoryConfig[highestCat]?.label || highestCat} Dominates`,
        description: `Your largest expense category at Rs.${highestAmount.toLocaleString()} (${Math.round(highestAmount / total * 100)}% of total spending)`,
        metric: `Rs.${highestAmount.toLocaleString()}`,
        action: 'Review bulk purchasing options',
        icon: 'TrendingUp'
      })
    }

    // Anomalies
    const anomalies = expenseData.filter(e => e.amount > avgExpense * 3)
    if (anomalies.length > 0) {
      insightsList.push({
        type: 'warning',
        title: 'Unusual Expense Detected',
        description: `${anomalies.length} expense(s) are significantly above your average. Review for accuracy.`,
        metric: `Rs.${anomalies.reduce((sum, e) => sum + e.amount, 0).toLocaleString()} total`,
        action: 'Verify flagged expenses',
        icon: 'AlertTriangle'
      })
    }

    // Recurring vendors
    const vendors = expenseData.filter(e => e.vendor).reduce((acc, e) => {
      acc[e.vendor!] = (acc[e.vendor!] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const frequent = Object.entries(vendors).filter(([, count]) => count >= 3)
    if (frequent.length > 0) {
      insightsList.push({
        type: 'opportunity',
        title: 'Vendor Relationships',
        description: `You have ${frequent.length} regular vendor(s). Consider negotiating better rates for repeat business.`,
        action: 'Negotiate bulk discounts',
        icon: 'Link2'
      })
    }

    // Payment method analysis
    const byPayment = expenseData.reduce((acc, e) => {
      acc[e.payment_method] = (acc[e.payment_method] || 0) + e.amount
      return acc
    }, {} as Record<string, number>)

    const cashPct = Math.round((byPayment.cash || 0) / total * 100)
    if (cashPct > 50) {
      insightsList.push({
        type: 'info',
        title: 'Cash Usage High',
        description: `${cashPct}% of expenses are cash payments. Consider tracking cash flow more carefully.`,
        action: 'Review cash management',
        icon: 'DollarSign'
      })
    }

    // Monthly trend
    const thisMonthExpenses = expenseData.filter(e => e.expense_date.startsWith(currentMonth))
    const lastMonthExpenses = expenseData.filter(e => {
      const d = new Date(e.expense_date)
      const now = new Date()
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1)
      return e.expense_date.startsWith(lastMonth.toISOString().slice(0, 7))
    })

    if (thisMonthExpenses.length > 0 && lastMonthExpenses.length > 0) {
      const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0)
      const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0)
      const change = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1)

      if (parseFloat(change) > 10) {
        insightsList.push({
          type: 'warning',
          title: 'Expenses Up This Month',
          description: `Spending increased by ${change}% compared to last month. Review discretionary expenses.`,
          metric: `+${change}%`,
          action: 'Identify cost-cutting opportunities',
          icon: 'TrendingUp'
        })
      } else if (parseFloat(change) < -10) {
        insightsList.push({
          type: 'success',
          title: 'Expenses Down This Month',
          description: `Great job! Spending decreased by ${Math.abs(parseFloat(change))}% compared to last month.`,
          metric: `${change}%`,
          action: 'Keep up the good work',
          icon: 'CheckCircle2'
        })
      }
    }

    // Daily average
    const uniqueDays = new Set(expenseData.map(e => e.expense_date)).size
    const dailyAvg = uniqueDays > 0 ? Math.round(total / uniqueDays) : 0
    insightsList.push({
      type: 'info',
      title: 'Daily Average',
      description: `You spend approximately Rs.${dailyAvg.toLocaleString()} per day on expenses`,
      metric: `Rs.${dailyAvg.toLocaleString()}/day`,
      icon: 'Calendar'
    })

    setInsights(insightsList)

    // Generate summary
    if (insightsList.length > 0) {
      const urgent = insightsList.find(i => i.type === 'warning')
      if (urgent) {
        setAiSummary(urgent.description)
      } else {
        setAiSummary(insightsList[0].description)
      }
    }
  }

  const analyzeExpenseWithAI = (text: string, amount?: number): AIExpenseAnalysis => {
    const lowerText = text.toLowerCase()

    let bestCategory = 'other'
    let bestScore = 0

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.filter(kw => lowerText.includes(kw)).length
      if (score > bestScore) {
        bestScore = score
        bestCategory = category
      }
    }

    let suggestedVendor: string | undefined
    for (const [vendor, patterns] of Object.entries(vendorHints)) {
      if (patterns.some(p => lowerText.includes(p))) {
        suggestedVendor = vendor
        break
      }
    }

    return {
      description: text.length > 100 ? text.substring(0, 97) + '...' : text,
      category: bestCategory as AIExpenseAnalysis['category'],
      suggested_vendor: suggestedVendor,
      confidence: bestScore > 0 ? Math.min(0.9, 0.5 + bestScore * 0.2) : 0.3
    }
  }

  const handleAutoSuggest = async (text: string, amount?: number): Promise<AIExpenseAnalysis> => {
    try {
      const response = await fetch('/api/ai/analyze-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, amount })
      })
      if (response.ok) {
        const data = await response.json()
        return data
      }
    } catch (err) {
      console.error('AI analysis error:', err)
    }
    return analyzeExpenseWithAI(text, amount)
  }

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const thisMonth = expenses.filter(e => e.expense_date.startsWith(currentMonth)).reduce((sum, e) => sum + e.amount, 0)
  const thisWeek = expenses.filter(e => {
    const expDate = new Date(e.expense_date)
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return expDate >= weekAgo
  }).reduce((sum, e) => sum + e.amount, 0)

  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount
    return acc
  }, {} as Record<string, number>)

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

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-8 pb-24">
      {/* Header */}
      <PageHeader
        title="Business"
        highlight="Expenses"
        badge="AI Powered"
        subtitle={
          <>
            <span className="text-[var(--text-primary)] font-medium">Rs.{thisMonth.toLocaleString()}</span>
            <span className="text-[var(--text-muted)]"> spent this month</span>
            {aiSummary && (
              <span className="ml-2 text-brand italic">• {aiSummary}</span>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-3">
            <ActionButton
              onClick={loadExpenses}
              disabled={isLoading}
              variant="secondary"
              icon={RefreshCw}
              className={cn(isLoading && 'animate-spin')}
            >
              Refresh
            </ActionButton>
            <ActionButton
              onClick={() => setShowAddModal(true)}
              icon={Plus}
            >
              Add Expense
            </ActionButton>
          </div>
        }
      />

      {/* AI Insights Panel */}
      {insights.length > 0 && (
        <motion.div variants={itemVariants}>
          <SectionCard
            title="AI Expense Insights"
            action={<span className="text-xs text-[var(--text-muted)]">Deep analysis of your spending patterns</span>}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {insights.map((insight, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "p-4 rounded-xl border bg-[var(--surface)]",
                    insight.type === 'warning' && 'border-amber-500/20',
                    insight.type === 'success' && 'border-emerald-500/20',
                    insight.type === 'info' && 'border-sky-500/20',
                    insight.type === 'opportunity' && 'border-brand/20'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {insight.icon === 'TrendingUp' && <TrendingUp className={cn(
                      "w-4 h-4",
                      insight.type === 'warning' && 'text-amber-500',
                      insight.type === 'success' && 'text-emerald-500',
                      insight.type === 'info' && 'text-sky-500',
                      insight.type === 'opportunity' && 'text-brand'
                    )} />}
                    {insight.icon === 'AlertTriangle' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    {insight.icon === 'CheckCircle2' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {insight.icon === 'DollarSign' && <DollarSign className="w-4 h-4 text-sky-500" />}
                    {insight.icon === 'Link2' && <Link2 className="w-4 h-4 text-brand" />}
                    {insight.icon === 'Calendar' && <Calendar className="w-4 h-4 text-sky-500" />}
                    <span className={cn(
                      "text-xs font-bold uppercase",
                      insight.type === 'warning' && 'text-amber-500',
                      insight.type === 'success' && 'text-emerald-500',
                      insight.type === 'info' && 'text-sky-500',
                      insight.type === 'opportunity' && 'text-brand'
                    )}>
                      {insight.type}
                    </span>
                  </div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-sm">{insight.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{insight.description}</p>
                  {insight.metric && (
                    <p className="text-lg font-black text-[var(--text-primary)] mt-2">{insight.metric}</p>
                  )}
                </motion.div>
              ))}
            </div>
          </SectionCard>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Expenses"
          value={`Rs.${totalExpenses.toLocaleString()}`}
          icon={DollarSign}
          tone="error"
        />
        <StatCard
          label="This Month"
          value={`Rs.${thisMonth.toLocaleString()}`}
          icon={Calendar}
          tone="warning"
        />
        <StatCard
          label="This Week"
          value={`Rs.${thisWeek.toLocaleString()}`}
          icon={TrendingDown}
          tone="brand"
        />
        <StatCard
          label="Transactions"
          value={expenses.length}
          icon={Receipt}
          tone="info"
        />
      </div>

      {/* Category Breakdown */}
      <SectionCard title="Expenses by Category">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(byCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, amount]) => {
              const config = categoryConfig[cat]
              const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0
              return (
                <div key={cat} className="p-4 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                  <div className="flex items-center gap-2 mb-3">
                    {config && <config.icon className={cn("w-4 h-4", config.color)} />}
                    <span className="text-xs text-[var(--text-muted)]">{config?.label || cat}</span>
                  </div>
                  <p className={cn("text-lg font-black", config?.color)}>Rs.{amount.toLocaleString()}</p>
                  <div className="mt-3 h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", config?.color.replace('text-', 'bg-'))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-disabled)] mt-2">{pct}%</p>
                </div>
              )
            })}
        </div>
      </SectionCard>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <DashboardSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search expenses..."
          className="flex-1 max-w-md"
        />
        <div className="flex gap-2 flex-wrap">
          {['all', ...Object.keys(categoryConfig)].map((cat) => (
            <FilterButton
              key={cat}
              label={cat === 'all' ? 'All' : categoryConfig[cat]?.label}
              active={categoryFilter === cat}
              onClick={() => setCategoryFilter(cat)}
            />
          ))}
        </div>
      </div>

      {/* Expenses List */}
      {isLoading ? (
        <div className="text-center py-20 text-[var(--text-muted)]">Loading expenses...</div>
      ) : filteredExpenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No Expenses Found"
          description="Start tracking your business expenses to get insights."
          action={{ label: 'Add First Expense', onClick: () => setShowAddModal(true) }}
        />
      ) : (
        <div className="space-y-3">
          {filteredExpenses.map((expense) => {
            const config = categoryConfig[expense.category]
            return (
              <motion.div
                key={expense.id}
                variants={itemVariants}
                className="p-5 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl hover:border-[var(--border-strong)] transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", config?.bg)}>
                      {config && <config.icon className={cn("w-5 h-5", config.color)} />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)]">{expense.description}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                        {expense.vendor && (
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            {expense.vendor}
                          </span>
                        )}
                        <span>{new Date(expense.expense_date).toLocaleDateString()}</span>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs", config?.bg, config?.color)}>
                          {config?.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-black text-rose-500">Rs.{expense.amount.toLocaleString()}</p>
                      <p className="text-xs text-[var(--text-disabled)] uppercase">{expense.payment_method}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="w-10 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-rose-500 hover:border-rose-500/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddModal && (
        <AddExpenseModal
          onSuccess={() => { setShowAddModal(false); loadExpenses(); }}
          onCancel={() => setShowAddModal(false)}
          onAnalyze={handleAutoSuggest}
          restaurantId={restaurant?.id || ''}
        />
      )}
    </motion.div>
  )
}

function AddExpenseModal({
  onSuccess,
  onCancel,
  onAnalyze,
  restaurantId
}: {
  onSuccess: () => void
  onCancel: () => void
  onAnalyze: (text: string, amount?: number) => AIExpenseAnalysis | Promise<AIExpenseAnalysis>
  restaurantId: string
}) {
  const { success, error: showError } = useToast()
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'ingredients' as Expense['category'],
    vendor: '',
    date: new Date().toISOString().split('T')[0],
    payment: 'cash' as Expense['payment_method']
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [suggestion, setSuggestion] = useState<AIExpenseAnalysis | null>(null)
  const [showSuggestion, setShowSuggestion] = useState(false)

  const handleDescriptionChange = (value: string) => {
    setForm({ ...form, description: value })
    setShowSuggestion(false)
  }

  const handleSuggest = async () => {
    if (!form.description.trim()) return
    setIsAnalyzing(true)
    try {
      const result = await onAnalyze(form.description, parseFloat(form.amount))
      setSuggestion(result)
      setShowSuggestion(true)
    } catch (err) {
      console.error('Analysis error:', err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const applySuggestion = () => {
    if (suggestion) {
      setForm({
        ...form,
        description: suggestion.description,
        category: suggestion.category,
        vendor: suggestion.suggested_vendor || form.vendor
      })
      setShowSuggestion(false)
      success('Applied', 'AI suggestion applied')
    }
  }

  const handleSubmit = async () => {
    if (!form.description.trim() || !form.amount) return
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('expenses')
        .insert({
          restaurant_id: restaurantId,
          description: form.description,
          amount: parseFloat(form.amount),
          category: form.category,
          vendor: form.vendor || null,
          expense_date: form.date,
          payment_method: form.payment,
        })

      if (error) throw error
      success('Added', 'Expense recorded')
      onSuccess()
    } catch (err) {
      showError('Error', 'Failed to add expense')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface)]/60 backdrop-blur-sm">
      <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl w-full max-w-lg p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <Plus className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Add Expense</h2>
              <p className="text-xs text-[var(--text-muted)]">AI-powered categorization</p>
            </div>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-lg bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Description *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="What was purchased?"
                className="flex-1 h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
              />
              <button
                onClick={handleSuggest}
                disabled={!form.description.trim() || isAnalyzing}
                className="h-12 px-4 bg-brand-subtle text-purple-400 hover:bg-purple-500/20 rounded-xl flex items-center gap-2 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {isAnalyzing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                AI
              </button>
            </div>
          </div>

          {showSuggestion && suggestion && (
            <div className="p-4 bg-brand-subtle border border-brand/20 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-400">AI Suggestion</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    ({Math.round(suggestion.confidence * 100)}% confidence)
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-3 bg-[var(--surface)] rounded-lg">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Suggested Category</p>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium capitalize",
                    categoryConfig[suggestion.category]?.bg,
                    categoryConfig[suggestion.category]?.color
                  )}>
                    {suggestion.category}
                  </span>
                </div>
                {suggestion.suggested_vendor && (
                  <div className="p-3 bg-[var(--surface)] rounded-lg">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Suggested Vendor</p>
                    <p className="text-sm text-[var(--text-primary)] font-medium">{suggestion.suggested_vendor}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applySuggestion}
                  className="flex-1 h-10 bg-purple-500 hover:bg-purple-600 text-[var(--text-primary)] rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Apply
                </button>
                <button
                  onClick={() => setShowSuggestion(false)}
                  className="h-10 px-4 bg-[var(--surface-hover)] text-[var(--text-muted)] rounded-lg text-sm font-medium hover:text-[var(--text-primary)] transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Amount (Rs.) *</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                className="w-full h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 text-[var(--text-primary)] text-lg font-medium outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Expense['category'] })}
                className="w-full h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
              >
                {Object.entries(categoryConfig).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Vendor</label>
            <input
              type="text"
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              placeholder="Supplier name (optional)"
              className="w-full h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Payment</label>
              <select
                value={form.payment}
                onChange={(e) => setForm({ ...form, payment: e.target.value as Expense['payment_method'] })}
                className="w-full h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onCancel} className="flex-1 h-12 bg-[var(--surface-hover)] text-[var(--text-muted)] rounded-xl font-medium hover:text-[var(--text-primary)] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!form.description.trim() || !form.amount}
              className="flex-1 h-12 bg-rose-500 hover:bg-rose-600 text-[var(--text-primary)] rounded-xl font-medium disabled:opacity-50 transition-colors"
            >
              Add Expense
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
