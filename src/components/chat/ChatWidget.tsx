'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Users, ChevronLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/common'

interface Message {
    id: string
    sender_id: string
    receiver_id: string | null
    content: string
    created_at: string
    sender?: { name: string; role: string }
}

interface StaffMember {
    id: string
    name: string
    role: string
    is_active: boolean
}

export function ChatWidget() {
    const { staff, restaurant } = useAuthStore()
    const [isOpen, setIsOpen] = useState(false)
    const [view, setView] = useState<'list' | 'chat'>('list')
    const [selectedUser, setSelectedUser] = useState<StaffMember | null>(null)
    const [staffList, setStaffList] = useState<StaffMember[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Fetch staff list
    useEffect(() => {
        if (!restaurant?.id) return

        const fetchStaff = async () => {
            const supabase = createClient()
            const { data } = await supabase
                .from('staff')
                .select('id, name, role, is_active')
                .eq('restaurant_id', restaurant.id)
                .eq('is_active', true)
                .neq('id', staff?.id) // Exclude self

            if (data) setStaffList(data)
        }

        fetchStaff()
    }, [restaurant?.id, staff?.id])

    // Fetch messages for selected user
    useEffect(() => {
        if (!selectedUser || !staff) return

        const fetchMessages = async () => {
            setIsLoading(true)
            const supabase = createClient()
            const { data } = await supabase
                .from('messages')
                .select('*, sender:staff!sender_id(name, role)')
                .or(`and(sender_id.eq.${staff.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${staff.id})`)
                .order('created_at', { ascending: true })
                .limit(50)

            if (data) setMessages(data)
            setIsLoading(false)
        }

        fetchMessages()

        // Subscribe to new messages
        const supabase = createClient()
        const channel = supabase
            .channel('messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${staff.id}`,
            }, (payload: any) => {
                setMessages((prev) => [...prev, payload.new as Message])
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [selectedUser, staff])

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = async () => {
        if (!newMessage.trim() || !selectedUser || !staff || !restaurant) return

        const supabase = createClient()
        const { error } = await supabase.from('messages').insert({
            restaurant_id: restaurant.id,
            sender_id: staff.id,
            receiver_id: selectedUser.id,
            content: newMessage.trim(),
        })

        if (!error) {
            setMessages((prev) => [...prev, {
                id: Date.now().toString(),
                sender_id: staff.id,
                receiver_id: selectedUser.id,
                content: newMessage.trim(),
                created_at: new Date().toISOString(),
            }])
            setNewMessage('')
        }
    }

    const openChat = (member: StaffMember) => {
        setSelectedUser(member)
        setView('chat')
    }

    const roleColors: Record<string, string> = {
        owner: 'bg-amber-500/20 text-amber-500',
        manager: 'bg-orange-500/20 text-orange-500',
        waiter: 'bg-emerald-500/20 text-emerald-500',
        kitchen: 'bg-rose-500/20 text-rose-500',
    }

    if (!staff) return null

    return (
        <>
            {/* Floating Button */}
            <motion.button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-primary rounded-2xl shadow-2xl shadow-primary/30 flex items-center justify-center text-white hover:scale-110 transition-transform"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
            >
                <MessageCircle className="w-7 h-7" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </motion.button>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-24 right-6 z-50 w-96 h-[500px] bg-slate-900 rounded-3xl shadow-2xl border border-white/10 overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-white/5 flex items-center justify-between">
                            {view === 'chat' && selectedUser ? (
                                <>
                                    <button onClick={() => setView('list')} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                        <ChevronLeft className="w-5 h-5 text-white" />
                                    </button>
                                    <div className="text-center flex-1">
                                        <p className="font-black text-white text-sm">{selectedUser.name}</p>
                                        <span className={`text-[0.55rem] font-black uppercase tracking-widest ${roleColors[selectedUser.role]?.split(' ')[1] || 'text-slate-400'}`}>
                                            {selectedUser.role}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-black text-white text-sm">Team Chat</p>
                                            <span className="text-[0.55rem] font-black uppercase tracking-widest text-slate-400">{staffList.length} Online</span>
                                        </div>
                                    </div>
                                </>
                            )}
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {view === 'list' ? (
                                <div className="space-y-2">
                                    {staffList.map((member) => (
                                        <button
                                            key={member.id}
                                            onClick={() => openChat(member)}
                                            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all text-left"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 font-black">
                                                {member.name.charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-white text-sm">{member.name}</p>
                                                <span className={`text-[0.55rem] px-2 py-0.5 rounded-full font-black uppercase ${roleColors[member.role] || 'bg-slate-500/20 text-slate-400'}`}>
                                                    {member.role}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                    {staffList.length === 0 && (
                                        <div className="text-center py-20 text-slate-500">
                                            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                            <p className="font-bold">No team members found</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-20">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                        </div>
                                    ) : (
                                        messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`flex ${msg.sender_id === staff?.id ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div className={cn(
                                                    "max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                                                    msg.sender_id === staff?.id
                                                        ? "bg-amber-500 text-white rounded-tr-none"
                                                        : "bg-white/5 border border-white/10 text-slate-200 rounded-tl-none"
                                                )}>
                                                    <p className="text-sm">{msg.content}</p>
                                                    <span className="text-[0.5rem] opacity-50 mt-1 block">
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        {/* Input (only in chat view) */}
                        {view === 'chat' && (
                            <div className="p-4 border-t border-white/5">
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white placeholder:text-white/30 outline-none focus:border-primary transition-colors"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!newMessage.trim()}
                                        className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white disabled:opacity-50 hover:bg-primary-dark transition-colors"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
