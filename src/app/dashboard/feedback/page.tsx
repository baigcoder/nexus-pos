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
import { Card, Button, Badge, Modal } from '@/components/ui/common'
import { cn } from '@/lib/utils'

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

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
    const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } } }

    const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
        return (
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={cn(
                            size === 'sm' ? 'w-4 h-4' : 'w-5 h-5',
                            star <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-neutral-700'
                        )}
                    />
                ))}
            </div>
        )
    }

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-10 pb-24">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-yellow-600/10 text-yellow-500 border-yellow-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            <Star className="w-3 h-3 mr-1 fill-yellow-500" /> Customer Feedback
                        </Badge>
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white uppercase">
                        Reviews & <span className="text-yellow-500">Ratings</span>
                    </h1>
                    <p className="text-neutral-400 text-lg font-medium">
                        <span className="text-white font-bold">{feedback.length} reviews</span> from your customers
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Average Rating', value: avgRating, icon: Star, color: 'text-yellow-500', suffix: '/5' },
                    { label: 'Total Reviews', value: feedback.length, icon: MessageSquare, color: 'text-blue-500' },
                    { label: 'Positive', value: positiveCount, icon: ThumbsUp, color: 'text-emerald-500' },
                    { label: 'Negative', value: negativeCount, icon: ThumbsDown, color: 'text-rose-500' },
                ].map((stat, idx) => (
                    <motion.div key={idx} variants={item}>
                        <Card className="p-5 bg-neutral-900 border-neutral-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">{stat.label}</p>
                                    <h3 className={cn("text-2xl font-bold", stat.color)}>
                                        {stat.value}{stat.suffix || ''}
                                    </h3>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-neutral-600">
                                    <stat.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Filter */}
            <div className="flex gap-2">
                {(['all', 'positive', 'negative'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all",
                            filter === f
                                ? 'bg-yellow-600 text-black'
                                : 'bg-neutral-900 border border-neutral-800 text-neutral-500 hover:border-neutral-700'
                        )}
                    >
                        {f === 'all' ? 'All Reviews' : f === 'positive' ? '4-5 Stars' : '1-2 Stars'}
                    </button>
                ))}
            </div>

            {/* Feedback List */}
            <div className="space-y-4">
                {filteredFeedback.map((fb) => (
                    <motion.div key={fb.id} variants={item}>
                        <Card
                            className={cn(
                                "p-6 bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-all cursor-pointer",
                                fb.overall_rating >= 4 ? 'hover:border-emerald-600/30' : fb.overall_rating <= 2 ? 'hover:border-rose-600/30' : ''
                            )}
                            onClick={() => setSelectedFeedback(fb)}
                        >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
                                        fb.overall_rating >= 4 ? 'bg-emerald-500/20 text-emerald-500' :
                                            fb.overall_rating <= 2 ? 'bg-rose-500/20 text-rose-500' : 'bg-yellow-500/20 text-yellow-500'
                                    )}>
                                        {fb.overall_rating}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-bold text-white">{fb.customer_name || 'Anonymous'}</h3>
                                            {renderStars(fb.overall_rating)}
                                        </div>
                                        <p className="text-neutral-400 text-sm line-clamp-2">{fb.comment || 'No comment'}</p>
                                        <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                                            {fb.order_number && <span>Order #{fb.order_number}</span>}
                                            {fb.waiter_name && <span>Server: {fb.waiter_name}</span>}
                                            <span>{new Date(fb.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-6">
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Food</p>
                                        {renderStars(fb.food_rating || 0)}
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Service</p>
                                        {renderStars(fb.service_rating || 0)}
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Ambiance</p>
                                        {renderStars(fb.ambiance_rating || 0)}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
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
                                selectedFeedback.overall_rating >= 4 ? 'bg-emerald-500/20 text-emerald-500' :
                                    selectedFeedback.overall_rating <= 2 ? 'bg-rose-500/20 text-rose-500' : 'bg-yellow-500/20 text-yellow-500'
                            )}>
                                {selectedFeedback.overall_rating}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">{selectedFeedback.customer_name || 'Anonymous'}</h3>
                                {renderStars(selectedFeedback.overall_rating, 'md')}
                            </div>
                        </div>

                        <div className="p-4 bg-black border border-neutral-800 rounded-xl">
                            <p className="text-neutral-300">{selectedFeedback.comment || 'No comment'}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-neutral-900 rounded-xl text-center">
                                <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2">Food</p>
                                <p className="text-2xl font-bold text-yellow-500">{selectedFeedback.food_rating || 0}/5</p>
                            </div>
                            <div className="p-4 bg-neutral-900 rounded-xl text-center">
                                <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2">Service</p>
                                <p className="text-2xl font-bold text-yellow-500">{selectedFeedback.service_rating || 0}/5</p>
                            </div>
                            <div className="p-4 bg-neutral-900 rounded-xl text-center">
                                <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2">Ambiance</p>
                                <p className="text-2xl font-bold text-yellow-500">{selectedFeedback.ambiance_rating || 0}/5</p>
                            </div>
                        </div>

                        <div className="p-4 bg-neutral-900 rounded-xl">
                            <div className="flex justify-between text-sm">
                                <span className="text-neutral-500">Order</span>
                                <span className="text-white font-bold">#{selectedFeedback.order_number}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-2">
                                <span className="text-neutral-500">Server</span>
                                <span className="text-white font-bold">{selectedFeedback.waiter_name}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-2">
                                <span className="text-neutral-500">Date</span>
                                <span className="text-white font-bold">{new Date(selectedFeedback.created_at).toLocaleString()}</span>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => setSelectedFeedback(null)}
                            className="w-full h-14 border-neutral-800 text-neutral-500"
                        >
                            Close
                        </Button>
                    </div>
                </Modal>
            )}
        </motion.div>
    )
}
