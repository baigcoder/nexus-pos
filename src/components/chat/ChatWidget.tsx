'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Loader2, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { withStaffAuthHeaders } from '@/lib/staff-api'
import { useAuthStore, useUserRole } from '@/stores'
import { cn } from '@/lib/utils'
import type { Conversation } from '@/types'
import { useRouter } from 'next/navigation'

const ROLE_COLORS: Record<string, string> = {
    owner: 'bg-amber-500/20 text-amber-600',
    manager: 'bg-orange-500/20 text-orange-600',
    waiter: 'bg-emerald-500/20 text-emerald-600',
    kitchen: 'bg-rose-500/20 text-rose-600',
    cashier: 'bg-blue-500/20 text-blue-600',
    delivery: 'bg-purple-500/20 text-purple-600',
    rider: 'bg-cyan-500/20 text-cyan-600',
}

function canMessage(myRole: string | null, theirRole: string): boolean {
    return !!myRole && !!theirRole
}

export function ChatWidget() {
    const { staff, restaurant } = useAuthStore()
    const myRole = useUserRole()
    const router = useRouter()
    const currentUserId = staff?.id || ''

    const [isOpen, setIsOpen] = useState(false)
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!staff || !restaurant?.id) return
        if (myRole === 'owner') return

        const fetchConversations = async () => {
            setIsLoading(true)
            try {
                const res = await fetch(`/api/messages/conversations?restaurantId=${restaurant.id}`, {
                    headers: withStaffAuthHeaders(),
                })
                const data = await res.json()
                if (data.success) {
                    setConversations(data.conversations)
                }
            } catch {
                // silently fail
            } finally {
                setIsLoading(false)
            }
        }

        fetchConversations()
    }, [staff, restaurant?.id, myRole])

    useEffect(() => {
        if (!staff || !restaurant?.id || myRole === 'owner') return

        const supabase = createClient()
        const channel = supabase
            .channel(`widget-messages:${currentUserId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${currentUserId}`,
            }, () => {
                import('@/lib/sounds').then(({ playAlertSound }) => playAlertSound()).catch(() => {})
                fetch(`/api/messages/conversations?restaurantId=${restaurant.id}`, {
                    headers: withStaffAuthHeaders(),
                })
                    .then(r => r.json())
                    .then(data => {
                        if (data.success) setConversations(data.conversations)
                    })
                    .catch(() => {})
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [staff, restaurant?.id, currentUserId, myRole])

    if (!staff || myRole === 'owner') return null

    const filteredConversations = conversations.filter(c => canMessage(myRole, c.peer_role))
    const totalUnread = filteredConversations.reduce((sum, c) => sum + c.unread_count, 0)

    const openFullMessages = () => {
        setIsOpen(false)
        router.push('/dashboard/messages')
    }

    return (
        <>
            <motion.button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-brand rounded-2xl shadow-2xl shadow-brand/30 flex items-center justify-center text-white hover:scale-110 transition-transform"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
            >
                <MessageCircle className="w-6 h-6" />
                {totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                        {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                )}
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-24 right-6 z-50 w-80 h-[460px] bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-brand-subtle flex items-center justify-center text-brand">
                                    <Users className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-[var(--text-primary)]">Messages</p>
                                    <span className="text-[10px] text-[var(--text-muted)]">{filteredConversations.length} contacts</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={openFullMessages}
                                    className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] text-[10px] font-semibold uppercase tracking-wider"
                                  >
                                    Open
                                </button>
                                <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="w-6 h-6 animate-spin text-brand" />
                                </div>
                            ) : filteredConversations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
                                    <MessageCircle className="w-10 h-10 mb-3 opacity-50" />
                                    <p className="text-sm font-semibold">No contacts</p>
                                    <p className="text-xs mt-1">No one to message yet</p>
                                </div>
                            ) : (
                                filteredConversations.map(conv => (
                                    <button
                                        key={conv.peer_id}
                                        onClick={openFullMessages}
                                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--surface-hover)] transition-colors border-b border-[var(--border)]"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-sm font-bold text-[var(--text-secondary)] shrink-0 relative">
                                            {conv.peer_name.charAt(0).toUpperCase()}
                                            {conv.peer_is_active && (
                                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[var(--surface-raised)] rounded-full" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-sm text-[var(--text-primary)] truncate">{conv.peer_name}</span>
                                                {conv.unread_count > 0 && (
                                                    <span className="ml-1 w-4 h-4 bg-brand rounded-full text-[9px] font-bold text-[var(--text-primary)] flex items-center justify-center shrink-0">
                                                        {conv.unread_count}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs text-[var(--text-muted)] truncate">{conv.last_message || ROLE_LABELS_SIMPLE[conv.peer_role] || conv.peer_role}</p>
                                                <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 ml-1", ROLE_COLORS[conv.peer_role] || 'bg-gray-500/20 text-gray-500')}>
                                                    {conv.peer_role}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="p-3 border-t border-[var(--border)]">
                            <button
                                onClick={openFullMessages}
                                className="w-full h-10 rounded-lg bg-brand hover:bg-brand-hover text-[var(--text-primary)] text-sm font-medium flex items-center justify-center gap-2 transition-all"
                            >
                                <MessageCircle className="w-4 h-4" />
                                Open Messages
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

const ROLE_LABELS_SIMPLE: Record<string, string> = {
    owner: 'Owner',
    manager: 'Manager',
    waiter: 'Waiter',
    kitchen: 'Kitchen',
    cashier: 'Cashier',
    delivery: 'Delivery',
    rider: 'Rider',
}
