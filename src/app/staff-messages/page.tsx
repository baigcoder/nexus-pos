'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Phone, PhoneOff, PhoneIncoming,
  Send, Search, Loader2, Video, VideoOff, Mic, MicOff,
  ArrowLeft, X, User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { withStaffAuthHeaders } from '@/lib/staff-api'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  createCallChannel, sendSignal, createPeerConnection,
  formatCallDuration, getLocalStream, setupPresenceChannel,
  type CallType, type IncomingCallData,
} from '@/lib/webrtc'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Conversation {
  peer_id: string
  peer_name: string
  peer_role: string
  peer_avatar_url: string | null
  peer_is_active: boolean
  last_message: string | null
  last_message_at: string | null
  unread_count: number
}

interface Message {
  id: string
  restaurant_id: string
  sender_id: string
  receiver_id: string
  content: string
  message_type: string
  is_read: boolean
  created_at: string
  sender?: { name: string; role: string }
  receiver?: { name: string; role: string }
}

interface CallSignal {
  type: string
  callId: string
  fromId: string
  toId: string
  callType?: CallType
  payload?: any
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/20 text-amber-600',
  manager: 'bg-orange-500/20 text-orange-600',
  waiter: 'bg-emerald-500/20 text-emerald-600',
  kitchen: 'bg-rose-500/20 text-rose-600',
  cashier: 'bg-blue-500/20 text-blue-600',
  delivery: 'bg-purple-500/20 text-purple-600',
  rider: 'bg-cyan-500/20 text-cyan-600',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  waiter: 'Waiter',
  kitchen: 'Kitchen',
  cashier: 'Cashier',
  delivery: 'Delivery',
  rider: 'Rider',
}

export default function StaffMessagesPage() {
  const { restaurant, staff, user } = useAuthStore()
  const { success, error: showError } = useToast()
  const currentUserId = staff?.id || user?.id || ''

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPeer, setSelectedPeer] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [search, setSearch] = useState('')
  const [isLoadingConvos, setIsLoadingConvos] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
  const [call, setCall] = useState<any>(null)
  const [onlineStaff, setOnlineStaff] = useState<Record<string, boolean>>({})

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)

  const fetchConversations = useCallback(async () => {
    if (!restaurant?.id) return
    try {
      const res = await fetch(`/api/messages/conversations?restaurantId=${restaurant.id}`, {
        headers: withStaffAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setConversations(data.conversations)
      }
    } catch {
    } finally {
      setIsLoadingConvos(false)
    }
  }, [restaurant?.id])

  const fetchMessages = useCallback(async (peerId: string) => {
    if (!restaurant?.id || !peerId) return
    setIsLoadingMessages(true)
    try {
      const res = await fetch(`/api/messages?peerId=${peerId}&limit=100`, {
        headers: withStaffAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setMessages(data.messages)
      }
      await fetch(`/api/messages?peerId=${peerId}`, {
        method: 'PATCH',
        headers: withStaffAuthHeaders(),
      }).catch(() => {})
      setConversations(prev =>
        prev.map(c => c.peer_id === peerId ? { ...c, unread_count: 0 } : c)
      )
    } catch {
    } finally {
      setIsLoadingMessages(false)
    }
  }, [restaurant?.id])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    if (selectedPeer) {
      fetchMessages(selectedPeer.peer_id)
    }
  }, [selectedPeer?.peer_id])

  useEffect(() => {
    if (!restaurant?.id || !currentUserId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`staff-messages:${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${currentUserId}`,
      }, () => {
        import('@/lib/sounds').then(({ playAlertSound }) => playAlertSound()).catch(() => {})
        fetchConversations()
        if (selectedPeer) {
          fetchMessages(selectedPeer.peer_id)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurant?.id, currentUserId, selectedPeer?.peer_id, fetchConversations, fetchMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!restaurant?.id || !currentUserId) return

    const channel = setupPresenceChannel(restaurant.id, currentUserId, (presences) => {
      const onlineMap: Record<string, boolean> = {}
      Object.entries(presences).forEach(([staffId, presence]) => {
        onlineMap[staffId] = presence.online
      })
      setOnlineStaff(onlineMap)
    })

    const supabase = createClient()
    const callChannel = supabase.channel(`incoming-calls:${currentUserId}`)

    callChannel.on('broadcast', { event: 'signal' }, (payload: { payload: CallSignal }) => {
      const signal = payload.payload
      if (signal.toId === currentUserId && signal.type === 'incoming-call') {
        setIncomingCall({
          callId: signal.callId,
          fromId: signal.fromId,
          fromName: selectedPeer?.peer_name || 'Unknown',
          fromRole: selectedPeer?.peer_role || 'staff',
          callType: signal.callType || 'audio',
          offer: signal.payload,
        })
      }
    })

    callChannel.subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(callChannel)
    }
  }, [restaurant?.id, currentUserId, selectedPeer])

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedPeer || !restaurant?.id) return
    const content = newMessage.trim()
    setNewMessage('')
    setIsSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          receiverId: selectedPeer.peer_id,
          content,
          messageType: 'direct',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')

      const optimistic: Message = {
        id: data.message?.id || Date.now().toString(),
        restaurant_id: restaurant.id,
        sender_id: currentUserId,
        receiver_id: selectedPeer.peer_id,
        content,
        message_type: 'direct',
        is_read: false,
        created_at: new Date().toISOString(),
        sender: { name: staff?.name || 'You', role: (staff?.role || 'staff') as string },
      }
      setMessages(prev => [...prev, optimistic])
      fetchConversations()
    } catch (err: any) {
      showError('Send Failed', err.message)
      setNewMessage(content)
    } finally {
      setIsSending(false)
    }
  }

  const handleStartCall = async (peer: Conversation, callType: CallType = 'audio') => {
    if (!currentUserId) return
    try {
      const stream = await getLocalStream(callType)
      const callId = `call-${currentUserId}-${peer.peer_id}-${Date.now()}`
      const pc = createPeerConnection(
        (candidate) => {
          const ch = call?.channel || channelRef.current
          if (ch) {
            sendSignal(ch, {
              type: 'ice-candidate',
              callId,
              fromId: currentUserId,
              toId: peer.peer_id,
              payload: candidate.toJSON(),
            })
          }
        },
        (remoteStream) => {
          setCall((prev: any) => ({ ...prev, remoteStream, status: 'connected' }))
        },
      )

      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const channel = createCallChannel(callId, (signal: CallSignal) => {
        if (signal.type === 'answer' && signal.fromId === peer.peer_id) {
          pc.setRemoteDescription(new RTCSessionDescription(signal.payload))
          setCall((prev: any) => ({ ...prev, status: 'connected' }))
        }
        if (signal.type === 'ice-candidate' && signal.fromId === peer.peer_id) {
          pc.addIceCandidate(new RTCIceCandidate(signal.payload)).catch(() => {})
        }
        if (signal.type === 'hang-up' && signal.fromId === peer.peer_id) {
          endCall()
        }
      })

      channelRef.current = channel

      const supabase = createClient()
      const notifyChannel = supabase.channel(`incoming-calls:${peer.peer_id}`)
      notifyChannel.on('broadcast', { event: 'signal' }, () => {}).subscribe()

      sendSignal(notifyChannel, {
        type: 'incoming-call',
        callId,
        fromId: currentUserId,
        toId: peer.peer_id,
        callType,
        payload: offer,
      })

      sendSignal(channel, {
        type: 'incoming-call',
        callId,
        fromId: currentUserId,
        toId: peer.peer_id,
        callType,
        payload: offer,
      })

      setCall({
        status: 'ringing',
        callId,
        callType,
        peerId: peer.peer_id,
        peerName: peer.peer_name,
        peerRole: peer.peer_role,
        duration: 0,
        pc,
        channel,
        localStream: stream,
        remoteStream: null,
      })
    } catch (err: any) {
      showError('Call Failed', err.message || 'Could not start call.')
    }
  }

  const endCall = useCallback(async () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }

    if (call?.channel) {
      sendSignal(call.channel, {
        type: 'hang-up',
        callId: call.callId,
        fromId: currentUserId,
        toId: call.peerId,
      })
    }

    call?.pc?.close()
    call?.localStream?.getTracks().forEach((t: any) => t.stop())
    if (call?.channel) {
      try {
        createClient().removeChannel(call.channel)
      } catch {}
    }

    setCall(null)
  }, [call, currentUserId])

  const acceptIncomingCall = async () => {
    if (!incomingCall) return
    try {
      const stream = await getLocalStream(incomingCall.callType)
      const pc = createPeerConnection(
        (candidate) => {
          const ch = channelRef.current
          if (ch) {
            sendSignal(ch, {
              type: 'ice-candidate',
              callId: incomingCall.callId,
              fromId: currentUserId,
              toId: incomingCall.fromId,
              payload: candidate.toJSON(),
            })
          }
        },
        (remoteStream) => {
          setCall((prev: any) => ({ ...prev, remoteStream, status: 'connected' }))
        },
      )

      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      const channel = createCallChannel(incomingCall.callId, (signal: CallSignal) => {
        if (signal.type === 'ice-candidate' && signal.fromId === incomingCall.fromId) {
          pc.addIceCandidate(new RTCIceCandidate(signal.payload)).catch(() => {})
        }
        if (signal.type === 'hang-up' && signal.fromId === incomingCall.fromId) {
          endCall()
        }
      })

      channelRef.current = channel

      sendSignal(channel, {
        type: 'answer',
        callId: incomingCall.callId,
        fromId: currentUserId,
        toId: incomingCall.fromId,
        payload: answer,
      })

      setCall({
        status: 'connected',
        callId: incomingCall.callId,
        callType: incomingCall.callType,
        peerId: incomingCall.fromId,
        peerName: incomingCall.fromName,
        peerRole: incomingCall.fromRole,
        duration: 0,
        pc,
        channel,
        localStream: stream,
        remoteStream: null,
      })
      setIncomingCall(null)
    } catch (err: any) {
      showError('Call Failed', err.message || 'Could not answer call.')
    }
  }

  const rejectIncomingCall = () => {
    if (incomingCall && channelRef.current) {
      sendSignal(channelRef.current, {
        type: 'reject',
        callId: incomingCall.callId,
        fromId: currentUserId,
        toId: incomingCall.fromId,
      })
    }
    setIncomingCall(null)
  }

  const filteredConversations = conversations.filter(c =>
    c.peer_name.toLowerCase().includes(search.toLowerCase())
  )

  if (!staff) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center text-white">
          <p>Please log in to view messages</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="h-screen flex">
        {/* Conversation List */}
        <div className={cn(
          "w-full md:w-80 border-r border-neutral-800 flex flex-col",
          selectedPeer ? "hidden md:flex" : "flex"
        )}>
          <div className="p-4 border-b border-neutral-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold">Messages</h1>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full h-10 pl-10 pr-4 bg-neutral-900 border border-neutral-800 rounded-lg text-sm outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingConvos ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-neutral-500">
                <MessageCircle className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No conversations</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <button
                  key={conv.peer_id}
                  onClick={() => setSelectedPeer(conv)}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 text-left transition-all hover:bg-neutral-900 border-b border-neutral-800",
                    selectedPeer?.peer_id === conv.peer_id && "bg-neutral-900"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-bold shrink-0 relative">
                    {conv.peer_name.charAt(0).toUpperCase()}
                    {conv.peer_is_active && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-neutral-950 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm truncate">{conv.peer_name}</span>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-neutral-500 shrink-0 ml-2">
                          {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-neutral-500 truncate">{conv.last_message || ROLE_LABELS[conv.peer_role] || conv.peer_role}</p>
                      {conv.unread_count > 0 && (
                        <span className="ml-2 w-5 h-5 bg-orange-600 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={cn(
          "flex-1 flex flex-col",
          selectedPeer ? "flex" : "hidden md:flex"
        )}>
          {selectedPeer ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedPeer(null)}
                    className="md:hidden p-1 rounded-lg hover:bg-neutral-900 text-neutral-500"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-bold">
                    {selectedPeer.peer_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{selectedPeer.peer_name}</p>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold uppercase", ROLE_COLORS[selectedPeer.peer_role] || 'bg-gray-500/20 text-gray-500')}>
                        {ROLE_LABELS[selectedPeer.peer_role] || selectedPeer.peer_role}
                      </span>
                      {selectedPeer.peer_is_active && (
                        <span className="text-[10px] text-emerald-500">Online</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartCall(selectedPeer, 'audio')}
                    className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 flex items-center justify-center"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleStartCall(selectedPeer, 'video')}
                    className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-neutral-500">
                    <MessageCircle className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === currentUserId
                    return (
                      <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                          isMine
                            ? "bg-orange-600 text-white rounded-tr-sm"
                            : "bg-neutral-800 text-white rounded-tl-sm"
                        )}>
                          <p>{msg.content}</p>
                          <div className={cn("flex items-center gap-1 mt-1", isMine ? "justify-end" : "justify-start")}>
                            <span className={cn("text-[10px]", isMine ? "text-white/60" : "text-neutral-500")}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-neutral-800">
                <div className="flex gap-2">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 h-11 bg-neutral-900 border border-neutral-800 rounded-xl px-4 text-sm outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || isSending}
                    className="h-11 w-11 bg-orange-600 hover:bg-orange-500 rounded-xl flex items-center justify-center disabled:opacity-50"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-500">
              <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-semibold">Select a conversation</p>
            </div>
          )}
        </div>
      </div>

      {/* Incoming Call Modal */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          >
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 w-80 text-center space-y-6">
              <div>
                <div className="w-20 h-20 mx-auto rounded-full bg-orange-600/20 border-4 border-orange-500 flex items-center justify-center text-2xl font-bold text-orange-500">
                  {incomingCall.fromName.charAt(0).toUpperCase()}
                </div>
              </div>
              <div>
                <p className="font-bold text-lg">{incomingCall.fromName}</p>
                <p className="text-xs text-neutral-500">
                  {incomingCall.callType === 'video' ? 'Incoming video call' : 'Incoming audio call'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-emerald-400">
                <PhoneIncoming className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Calling...</span>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={rejectIncomingCall}
                  className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>
                <button
                  onClick={acceptIncomingCall}
                  className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center"
                >
                  {incomingCall.callType === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Call Overlay */}
      <AnimatePresence>
        {call && call.status !== 'idle' && !incomingCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          >
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 w-80 text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-orange-600/20 border-4 border-orange-500 flex items-center justify-center text-2xl font-bold text-orange-500">
                {call.peerName?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-lg">{call.peerName}</p>
                <p className="text-xs text-neutral-500">{call.status === 'ringing' ? 'Calling...' : 'Connected'}</p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
