'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Star,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  Users,
  Award,
  BarChart3,
  Search,
  ChevronDown
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Modal } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import {
  PageHeader,
  StatCard,
  FilterButton,
  EmptyState,
  SectionCard,
  itemVariants,
  containerVariants,
} from '@/components/dashboard/shared'

interface Feedback {
  id: string
  order_id: string | null
  order_number?: number
  customer_name: string | null
  overall_rating: number
  food_rating: number | null
  service_rating: number | null
  ambiance_rating: number | null
  comment: string | null
  waiter_name: string | null
  created_at: string
}

export default function FeedbackPage() {
  const { restaurant } = useAuthStore()
  const { success, error: showError } = useToast()
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative'>('all')
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)

  // Fetch from Supabase
  useEffect(() => {
    async function loadFeedback() {
      if (!restaurant?.id) return
      setIsLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('feedback')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setFeedback(data || [])
      } catch (err) {
        showError('Error', 'Failed to load feedback')
      } finally {
        setIsLoading(false)
      }
    }
    loadFeedback()
  }, [restaurant?.id])

  const filteredFeedback = feedback.filter(f => {
    if (filter === 'positive') return f.overall_rating >= 4
    if (filter === 'negative') return f.overall_rating <= 2
    return true
  })

  const avgRating = feedback.length > 0
    ? (feedback.reduce((sum, f) => sum + f.overall_rating, 0) / feedback.length).toFixed(1)
    : '0.0'

  const positiveCount = feedback.filter(f => f.overall_rating >= 4).length
  const negativeCount = feedback.filter(f => f.overall_rating <= 2).length

  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              size === 'sm' ? 'w-4 h-4' : 'w-5 h-5',
              star <= rating ? 'text-amber-500 fill-amber-500' : 'text-[var(--border-strong)]'
            )}
          />
        ))}
      </div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-10 pb-24">
      {/* Header */}
      <PageHeader
        title="Reviews &"
        highlight="Ratings"
        badge="Customer Feedback"
        badgeTone="warning"
        subtitle={
          <>
            <span className="text-[var(--text-primary)] font-bold">{feedback.length} reviews</span>
            <span className="text-[var(--text-muted)]"> from your customers</span>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Average Rating"
          value={`${avgRating}/5`}
          icon={Star}
          tone="warning"
        />
        <StatCard
          label="Total Reviews"
          value={feedback.length}
          icon={MessageSquare}
          tone="info"
        />
        <StatCard
          label="Positive"
          value={positiveCount}
          icon={ThumbsUp}
          tone="success"
        />
        <StatCard
          label="Negative"
          value={negativeCount}
          icon={ThumbsDown}
          tone="error"
        />
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'positive', 'negative'] as const).map((f) => (
          <FilterButton
            key={f}
            label={f === 'all' ? 'All Reviews' : f === 'positive' ? '4-5 Stars' : '1-2 Stars'}
            active={filter === f}
            onClick={() => setFilter(f)}
          />
        ))}
      </div>

      {/* Feedback List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-20 text-[var(--text-muted)]">Loading feedback...</div>
        ) : filteredFeedback.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No feedback yet"
            description="Customer reviews will appear here once they start submitting feedback."
          />
        ) : (
          filteredFeedback.map((fb) => (
            <motion.div key={fb.id} variants={itemVariants}>
              <div
                className={cn(
                  "p-6 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl hover:border-[var(--border-strong)] transition-all cursor-pointer",
                  fb.overall_rating >= 4 ? 'hover:border-emerald-500/20' : fb.overall_rating <= 2 ? 'hover:border-rose-500/20' : ''
                )}
                onClick={() => setSelectedFeedback(fb)}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
                      fb.overall_rating >= 4 ? 'bg-emerald-500/10 text-emerald-500' :
                        fb.overall_rating <= 2 ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
                    )}>
                      {fb.overall_rating}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-[var(--text-primary)]">{fb.customer_name || 'Anonymous'}</h3>
                        {renderStars(fb.overall_rating)}
                      </div>
                      <p className="text-[var(--text-secondary)] text-sm line-clamp-2">{fb.comment || 'No comment'}</p>
                      <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                        {fb.order_number && <span>Order #{fb.order_number}</span>}
                        {fb.waiter_name && <span>Server: {fb.waiter_name}</span>}
                        <span>{new Date(fb.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Food</p>
                      {renderStars(fb.food_rating || 0)}
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Service</p>
                      {renderStars(fb.service_rating || 0)}
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Ambiance</p>
                      {renderStars(fb.ambiance_rating || 0)}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedFeedback && (
        <Modal
          isOpen={!!selectedFeedback}
          onClose={() => setSelectedFeedback(null)}
          title="Review Details"
          size="md"
        >
          <div className="space-y-6 py-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl",
                selectedFeedback.overall_rating >= 4 ? 'bg-emerald-500/10 text-emerald-500' :
                  selectedFeedback.overall_rating <= 2 ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
              )}>
                {selectedFeedback.overall_rating}
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)]">{selectedFeedback.customer_name || 'Anonymous'}</h3>
                {renderStars(selectedFeedback.overall_rating, 'md')}
              </div>
            </div>

            <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
              <p className="text-[var(--text-secondary)]">{selectedFeedback.comment || 'No comment'}</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl text-center">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Food</p>
                <p className="text-2xl font-bold text-amber-500">{selectedFeedback.food_rating || 0}/5</p>
              </div>
              <div className="p-4 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl text-center">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Service</p>
                <p className="text-2xl font-bold text-amber-500">{selectedFeedback.service_rating || 0}/5</p>
              </div>
              <div className="p-4 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl text-center">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Ambiance</p>
                <p className="text-2xl font-bold text-amber-500">{selectedFeedback.ambiance_rating || 0}/5</p>
              </div>
            </div>

            <div className="p-4 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Order</span>
                <span className="text-[var(--text-primary)] font-bold">#{selectedFeedback.order_number}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-[var(--text-muted)]">Server</span>
                <span className="text-[var(--text-primary)] font-bold">{selectedFeedback.waiter_name}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-[var(--text-muted)]">Date</span>
                <span className="text-[var(--text-primary)] font-bold">{new Date(selectedFeedback.created_at).toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedFeedback(null)}
              className="w-full h-14 border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] rounded-xl transition-all text-sm font-medium"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </motion.div>
  )
}
