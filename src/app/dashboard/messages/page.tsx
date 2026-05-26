'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ElementType } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Phone, PhoneOff, PhoneIncoming, PhoneMissed,
  Send, Search, Users, X, Loader2, Volume2, VolumeX,
  Mic, MicOff, Check, CheckCheck, ArrowLeft, Megaphone, Video, VideoOff,
  ShieldCheck, Radio, UserRound, Inbox, Clock3, Sparkles
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { withStaffAuthHeaders } from '@/lib/staff-api'
import { useAuthStore, useIsOwner, useUserRole } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { Conversation, Message, CallLog, CallStatus } from '@/types'
import {
  createCallChannel, sendSignal, createPeerConnection,
  formatCallDuration, getLocalStream, setupPresenceChannel,
  type CallType, type IncomingCallData,
} from '@/lib/webrtc'
import type { RealtimeChannel } from '@supabase/supabase-js'

type CallSignalType = 'offer' | 'answer' | 'ice-candidate' | 'hang-up' | 'reject' | 'incoming-call'

interface CallSignal {
    type: CallSignalType
    callId: string
    fromId: string
    toId: string
    callType?: CallType
    payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | null
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

const ROLE_ORDER = ['owner', 'manager', 'waiter', 'kitchen', 'cashier', 'delivery', 'rider']

type CallState = {
  status: CallStatus
  callId: string
  callType: CallType
  peerId: string
  peerName: string
  peerRole: string
  duration: number
  isMuted: boolean
  isVideoEnabled: boolean
  pc: RTCPeerConnection | null
  channel: RealtimeChannel | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  callLogId: string | null
}

const INITIAL_CALL_STATE: CallState = {
  status: 'idle',
  callId: '',
  callType: 'audio',
  peerId: '',
  peerName: '',
  peerRole: '',
  duration: 0,
  isMuted: false,
  isVideoEnabled: true,
  pc: null,
  channel: null,
  localStream: null,
  remoteStream: null,
  callLogId: null,
}

export default function MessagesPage() {
  const { restaurant, staff, user } = useAuthStore()
  const isOwner = useIsOwner()
  const myRole = useUserRole()
  const { success, error: showError } = useToast()
  const currentUserId = staff?.id || user?.id || ''

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPeer, setSelectedPeer] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [isLoadingConvos, setIsLoadingConvos] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastRecipients, setBroadcastRecipients] = useState<string[]>([])
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [call, setCall] = useState<CallState>(INITIAL_CALL_STATE)
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
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
      // silently fail
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
      // silently fail
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
      .channel(`messages-page:${currentUserId}`)
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
  }, [restaurant?.id, currentUserId, selectedPeer?.peer_id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Setup presence channel for online status
  useEffect(() => {
    if (!restaurant?.id || !currentUserId) return

    const channel = setupPresenceChannel(restaurant.id, currentUserId, (presences) => {
      const onlineMap: Record<string, boolean> = {}
      Object.entries(presences).forEach(([staffId, presence]) => {
        onlineMap[staffId] = presence.online
      })
      setOnlineStaff(onlineMap)
    })

    // Also listen for incoming calls
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
          offer: signal.payload as RTCSessionDescriptionInit,
        })
      }
    })

    callChannel.subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(callChannel)
    }
  }, [restaurant?.id, currentUserId, selectedPeer])

  // Update local video preview when stream changes
  useEffect(() => {
    if (localVideoRef.current && call.localStream && call.callType === 'video') {
      localVideoRef.current.srcObject = new MediaStream(call.localStream.getVideoTracks())
    }
  }, [call.localStream, call.callType])

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
        sender: { name: staff?.name || user?.full_name || 'You', role: (myRole || 'owner') as string },
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

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim() || !restaurant?.id) return
    setIsBroadcasting(true)
    try {
      const res = await fetch('/api/messages/broadcast', {
        method: 'POST',
        headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          content: broadcastMessage.trim(),
          receiverIds: broadcastRecipients.length > 0 ? broadcastRecipients : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      success('Broadcast Sent', `Message sent to ${data.count} team member${data.count > 1 ? 's' : ''}`)
      setBroadcastMessage('')
      setBroadcastRecipients([])
      setShowBroadcast(false)
      fetchConversations()
    } catch (err: any) {
      showError('Broadcast Failed', err.message)
    } finally {
      setIsBroadcasting(false)
    }
  }

  const handleStartCall = async (peer: Conversation, callType: CallType = 'audio') => {
    if (!currentUserId) return
    try {
      const stream = await getLocalStream(callType)
      const callId = `call-${currentUserId}-${peer.peer_id}-${Date.now()}`
      const pc = createPeerConnection(
        (candidate) => {
          const ch = call.channel || channelRef.current
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
          setCall(prev => ({ ...prev, remoteStream, status: 'connected' }))
          startCallTimer()
        },
      )

      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const channel = createCallChannel(callId, (signal: CallSignal) => {
        if (signal.type === 'answer' && signal.fromId === peer.peer_id) {
          pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit))
          setCall(prev => ({ ...prev, status: 'connected' }))
          startCallTimer()
        }
        if (signal.type === 'ice-candidate' && signal.fromId === peer.peer_id) {
          pc.addIceCandidate(new RTCIceCandidate(signal.payload as RTCIceCandidateInit)).catch(() => {})
        }
        if (signal.type === 'hang-up' && signal.fromId === peer.peer_id) {
          endCall()
        }
        if (signal.type === 'reject' && signal.fromId === peer.peer_id) {
          endCall()
        }
      })

      channelRef.current = channel

      // Send incoming call notification to recipient's listening channel
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

      // Also send the call-specific signal for the actual WebRTC connection
      sendSignal(channel, {
        type: 'incoming-call',
        callId,
        fromId: currentUserId,
        toId: peer.peer_id,
        callType,
        payload: offer,
      })

      // Also send the offer
      sendSignal(channel, {
        type: 'offer',
        callId,
        fromId: currentUserId,
        toId: peer.peer_id,
        payload: offer,
      })

      const callLogRes = await fetch('/api/messages/call-log', {
        method: 'POST',
        headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ receiverId: peer.peer_id, callType, status: 'ringing' }),
      })
      const callLogData = await callLogRes.json()

      setCall({
        status: 'ringing',
        callId,
        callType,
        peerId: peer.peer_id,
        peerName: peer.peer_name,
        peerRole: peer.peer_role,
        duration: 0,
        isMuted: false,
        isVideoEnabled: true,
        pc,
        channel,
        localStream: stream,
        remoteStream: null,
        callLogId: callLogData.callLog?.id || null,
      })
    } catch (err: any) {
      showError('Call Failed', err.message || 'Could not start call.')
    }
  }

  const startCallTimer = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    const startTime = Date.now()
    callTimerRef.current = setInterval(() => {
      setCall(prev => ({ ...prev, duration: Math.floor((Date.now() - startTime) / 1000) }))
    }, 1000)
  }

  const endCall = useCallback(async () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }

    if (call.channel) {
      sendSignal(call.channel, {
        type: 'hang-up',
        callId: call.callId,
        fromId: currentUserId,
        toId: call.peerId,
      })
    }

    call.pc?.close()
    call.localStream?.getTracks().forEach(t => t.stop())
    if (call.channel) {
      try {
        createClient().removeChannel(call.channel)
      } catch {}
    }

    if (call.callLogId) {
      await fetch('/api/messages/call-log', {
        method: 'PATCH',
        headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          callLogId: call.callLogId,
          status: 'ended',
          durationSeconds: call.duration,
          endedAt: new Date().toISOString(),
        }),
      }).catch(() => {})
    }

    setCall(INITIAL_CALL_STATE)
  }, [call.pc, call.localStream, call.channel, call.callLogId, call.duration, call.callId, call.peerId, currentUserId])

  const toggleMute = () => {
    if (call.localStream) {
      call.localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      setCall(prev => ({ ...prev, isMuted: !prev.isMuted }))
    }
  }

  const toggleVideo = () => {
    if (call.localStream) {
      const videoTrack = call.localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setCall(prev => ({ ...prev, isVideoEnabled: !prev.isVideoEnabled }))
      }
    }
  }

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
          setCall(prev => ({ ...prev, remoteStream, status: 'connected' }))
          startCallTimer()
        },
      )

      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      const channel = createCallChannel(incomingCall.callId, (signal: CallSignal) => {
        if (signal.type === 'ice-candidate' && signal.fromId === incomingCall.fromId) {
          pc.addIceCandidate(new RTCIceCandidate(signal.payload as RTCIceCandidateInit)).catch(() => {})
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

      const callLogRes = await fetch('/api/messages/call-log', {
        method: 'POST',
        headers: withStaffAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ receiverId: incomingCall.fromId, callType: incomingCall.callType, status: 'connected' }),
      })
      const callLogData = await callLogRes.json()

      setCall({
        status: 'connected',
        callId: incomingCall.callId,
        callType: incomingCall.callType,
        peerId: incomingCall.fromId,
        peerName: incomingCall.fromName,
        peerRole: incomingCall.fromRole,
        duration: 0,
        isMuted: false,
        isVideoEnabled: true,
        pc,
        channel,
        localStream: stream,
        remoteStream: null,
        callLogId: callLogData.callLog?.id || null,
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

  const filteredConversations = conversations.filter(c => {
    const matchesSearch = c.peer_name.toLowerCase().includes(search.toLowerCase()) ||
      c.peer_role.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || c.peer_role === roleFilter
    return matchesSearch && matchesRole
  })

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0)
  const onlineCount = conversations.filter(c => onlineStaff[c.peer_id] || c.peer_is_active).length
  const roleCounts = conversations.reduce((acc, c) => {
    acc[c.peer_role] = (acc[c.peer_role] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const activeRoles = ROLE_ORDER.filter(role => roleCounts[role] > 0)
  const currentRoleLabel = ROLE_LABELS[myRole || ''] || myRole || 'Team'

  return (
    <div className="h-[calc(100vh-4rem)] min-h-0 bg-[var(--surface)] text-[var(--text-secondary)] overflow-hidden">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[440px_minmax(0,1fr)]">
      {/* Conversation List */}
      <div className={cn(
        "border-r border-[var(--border)] flex min-h-0 flex-col bg-[var(--surface)]",
        selectedPeer ? "hidden lg:flex" : "flex"
      )}>
        <div className="border-b border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-black tracking-tight text-[var(--text-primary)]">Messages</h1>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {currentRoleLabel} channel - {conversations.length} contacts
                  </p>
                </div>
              </div>
              {isOwner && (
              <button
                onClick={() => setShowBroadcast(true)}
                className="h-9 shrink-0 px-3 rounded-lg bg-brand hover:bg-brand-hover text-[var(--text-primary)] text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Megaphone className="w-3.5 h-3.5" />
                Broadcast
              </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <MessageMetric icon={Inbox} label="Unread" value={totalUnread} tone="brand" />
              <MessageMetric icon={Radio} label="Online" value={onlineCount} tone="green" />
              <MessageMetric icon={Users} label="Roles" value={activeRoles.length} tone="blue" />
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full h-11 pl-10 pr-4 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:border-brand/50"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <RoleFilterButton
              label="All"
              count={conversations.length}
              active={roleFilter === 'all'}
              onClick={() => setRoleFilter('all')}
            />
            {activeRoles.map(role => (
              <RoleFilterButton
                key={role}
                label={ROLE_LABELS[role] || role}
                count={roleCounts[role]}
                active={roleFilter === role}
                onClick={() => setRoleFilter(role)}
                className={ROLE_COLORS[role]}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--surface)] p-3 space-y-2">
          {isLoadingConvos ? (
            <div className="flex items-center justify-center py-20 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]">
              <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
              <p className="font-semibold text-sm">No conversations yet</p>
              <p className="text-xs mt-1">{search || roleFilter !== 'all' ? 'Adjust search or role filter' : 'Staff synced to this restaurant will appear here'}</p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.peer_id}
                onClick={() => setSelectedPeer(conv)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition-all hover:bg-[var(--surface-hover)]",
                  selectedPeer?.peer_id === conv.peer_id
                    ? "bg-brand-subtle border-brand/30 shadow-[0_0_0_1px_rgba(249,115,22,0.12)]"
                    : "bg-[var(--surface-raised)] border-[var(--border)]"
                )}
              >
                <div className="w-11 h-11 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-sm font-bold text-[var(--text-secondary)] shrink-0 relative">
                  {conv.peer_name.charAt(0).toUpperCase()}
                  {(onlineStaff[conv.peer_id] || conv.peer_is_active) && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-[var(--surface-raised)] rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-[var(--text-primary)] truncate">{conv.peer_name}</span>
                    {conv.last_message_at && (
                      <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-2">
                        {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={cn("shrink-0 text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase", ROLE_COLORS[conv.peer_role] || 'bg-gray-500/20 text-gray-500')}>
                        {ROLE_LABELS[conv.peer_role] || conv.peer_role}
                      </span>
                      <p className="text-xs text-[var(--text-muted)] truncate">{conv.last_message || 'Ready to message'}</p>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="ml-2 w-5 h-5 bg-brand rounded-full text-[10px] font-bold text-[var(--text-primary)] flex items-center justify-center shrink-0">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
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
        "min-w-0 min-h-0 flex flex-col bg-[var(--surface)]",
        selectedPeer ? "flex" : "hidden lg:flex"
      )}>
        {selectedPeer ? (
          <>
            {/* Chat Header */}
            <div className="border-b border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedPeer(null)}
                  className="lg:hidden p-1 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="relative w-11 h-11 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-sm font-bold text-[var(--text-secondary)]">
                  {selectedPeer.peer_name.charAt(0).toUpperCase()}
                  {(onlineStaff[selectedPeer.peer_id] || selectedPeer.peer_is_active) && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface-raised)] bg-emerald-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm text-[var(--text-primary)]">{selectedPeer.peer_name}</p>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold uppercase", ROLE_COLORS[selectedPeer.peer_role] || 'bg-gray-500/20 text-gray-500')}>
                      {ROLE_LABELS[selectedPeer.peer_role] || selectedPeer.peer_role}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {(onlineStaff[selectedPeer.peer_id] || selectedPeer.peer_is_active) ? 'Online' : 'Available in staff account'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartCall(selectedPeer, 'audio')}
                    className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 flex items-center justify-center transition-all"
                    title="Audio Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleStartCall(selectedPeer, 'video')}
                    className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center transition-all"
                    title="Video Call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--background)] p-5 space-y-3">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-brand" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-[var(--text-muted)]">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)]">
                    <Sparkles className="h-7 w-7 text-brand" />
                  </div>
                  <p className="font-semibold text-sm text-[var(--text-primary)]">Start with {selectedPeer.peer_name}</p>
                  <p className="text-xs mt-1">This chat is synced inside {restaurant?.name || 'your restaurant'}.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === currentUserId
                  return (
                    <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "min-w-[96px] max-w-[68%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                        isMine
                          ? "bg-brand text-[var(--text-primary)] rounded-tr-sm"
                          : "bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-primary)] rounded-tl-sm"
                      )}>
                        {msg.message_type === 'broadcast' && !isMine && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1 mb-1">
                            <Megaphone className="w-3 h-3" /> Broadcast
                          </span>
                        )}
                        <p>{msg.content}</p>
                        <div className={cn("flex items-center gap-1 mt-1", isMine ? "justify-end" : "justify-start")}>
                          <span className={cn("text-[10px]", isMine ? "text-[var(--text-primary)]/60" : "text-[var(--text-muted)]")}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMine && (
                            msg.is_read
                              ? <CheckCheck className="w-3 h-3 text-blue-400" />
                              : <Check className="w-3 h-3 text-[var(--text-primary)]/60" />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-2">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 h-10 bg-transparent px-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || isSending}
                  className="h-10 w-10 bg-brand hover:bg-brand-hover rounded-xl flex items-center justify-center text-[var(--text-primary)] disabled:opacity-50 transition-all shrink-0"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 bg-[var(--background)] p-8 flex items-center justify-center">
            <div className="w-full max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--surface-raised)] p-8">
              <div className="flex flex-col items-center text-center">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-subtle text-brand">
                  <MessageCircle className="h-9 w-9" />
                </div>
                <p className="font-black text-2xl tracking-tight text-[var(--text-primary)]">Team messaging</p>
                <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
                  Select any staff member linked to {restaurant?.name || 'this restaurant'} to send messages, start calls, and receive real-time alerts.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
                <EmptyPanelMetric icon={Users} label="Contacts" value={conversations.length} />
                <EmptyPanelMetric icon={Radio} label="Online" value={onlineCount} />
                <EmptyPanelMetric icon={Inbox} label="Unread" value={totalUnread} />
                <EmptyPanelMetric icon={ShieldCheck} label="Roles" value={activeRoles.length} />
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {activeRoles.length === 0 ? (
                  <span className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
                    Waiting for staff sync
                  </span>
                ) : activeRoles.map(role => (
                  <span key={role} className={cn("rounded-full px-3 py-1.5 text-xs font-bold", ROLE_COLORS[role] || 'bg-gray-500/20 text-gray-500')}>
                    {ROLE_LABELS[role] || role} - {roleCounts[role]}
                  </span>
                ))}
              </div>
            </div>
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
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-8 w-80 text-center space-y-6 shadow-2xl">
              <div className="relative">
                <div className="w-20 h-20 mx-auto rounded-full bg-brand-subtle border-4 border-brand flex items-center justify-center text-2xl font-bold text-brand">
                  {incomingCall.fromName.charAt(0).toUpperCase()}
                </div>
                {incomingCall.callType === 'video' && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <Video className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-bold text-lg text-[var(--text-primary)]">{incomingCall.fromName}</p>
                <p className="text-xs text-[var(--text-muted)]">
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
                  className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-all shadow-lg shadow-rose-500/30"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>
                <button
                  onClick={acceptIncomingCall}
                  className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all shadow-lg shadow-emerald-500/30"
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
        {call.status !== 'idle' && !incomingCall && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-8 w-80 text-center space-y-6 shadow-2xl">
              <div className="w-20 h-20 mx-auto rounded-full bg-brand-subtle border-4 border-brand flex items-center justify-center text-2xl font-bold text-brand">
                {call.peerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-lg text-[var(--text-primary)]">{call.peerName}</p>
                <p className={cn("text-xs px-2 py-0.5 rounded-full font-bold uppercase inline-block", ROLE_COLORS[call.peerRole] || 'bg-gray-500/20 text-gray-500')}>
                  {ROLE_LABELS[call.peerRole] || call.peerRole}
                </p>
              </div>

              <div className="text-sm font-mono text-[var(--text-muted)]">
                {call.status === 'ringing' && (
                  <div className="flex items-center justify-center gap-2">
                    <PhoneIncoming className="w-4 h-4 animate-pulse text-emerald-400" />
                    <span>Calling...</span>
                  </div>
                )}
                {call.status === 'connected' && (
                  <div className="flex items-center justify-center gap-2 text-emerald-400">
                    <Phone className="w-4 h-4" />
                    <span>{formatCallDuration(call.duration)}</span>
                  </div>
                )}
              </div>

              {/* Video Preview */}
              {call.callType === 'video' && call.localStream && (
                <div className="relative w-32 h-24 mx-auto rounded-lg overflow-hidden border-2 border-[var(--border)]">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!call.isVideoEnabled && (
                    <div className="absolute inset-0 bg-black flex items-center justify-center">
                      <VideoOff className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={toggleMute}
                  className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center transition-all",
                    call.isMuted ? "bg-rose-500/20 text-rose-400" : "bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]"
                  )}
                  title={call.isMuted ? "Unmute" : "Mute"}
                >
                  {call.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                {call.callType === 'video' && (
                  <button
                    onClick={toggleVideo}
                    className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center transition-all",
                      !call.isVideoEnabled ? "bg-rose-500/20 text-rose-400" : "bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]"
                    )}
                    title={call.isVideoEnabled ? "Turn off video" : "Turn on video"}
                  >
                    {call.isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                )}
                <button
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-all shadow-lg shadow-rose-500/30"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Broadcast Modal */}
      <AnimatePresence>
        {showBroadcast && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowBroadcast(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)]">Send Broadcast</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Message will be sent to all selected team members</p>
                </div>
                <button onClick={() => setShowBroadcast(false)} className="p-1 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Recipients</label>
                  <button
                    onClick={() => {
                      if (broadcastRecipients.length === conversations.length) {
                        setBroadcastRecipients([])
                      } else {
                        setBroadcastRecipients(conversations.map(c => c.peer_id))
                      }
                    }}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    {broadcastRecipients.length === conversations.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <div className="space-y-1">
                    {conversations.map(conv => (
                      <label key={conv.peer_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={broadcastRecipients.includes(conv.peer_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBroadcastRecipients(prev => [...prev, conv.peer_id])
                            } else {
                              setBroadcastRecipients(prev => prev.filter(id => id !== conv.peer_id))
                            }
                          }}
                          className="w-4 h-4 rounded border-[var(--border)] text-brand focus:ring-brand"
                        />
                        <div className="w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-secondary)]">
                          {conv.peer_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{conv.peer_name}</p>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase", ROLE_COLORS[conv.peer_role] || 'bg-gray-500/20 text-gray-500')}>
                            {ROLE_LABELS[conv.peer_role] || conv.peer_role}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Message</label>
                  <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Type your broadcast message..."
                    rows={3}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 resize-none"
                  />
                </div>
              </div>

              <div className="p-5 border-t border-[var(--border)] flex justify-end gap-3">
                <button onClick={() => setShowBroadcast(false)} className="h-10 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  Cancel
                </button>
                <button
                  onClick={handleBroadcast}
                  disabled={!broadcastMessage.trim() || broadcastRecipients.length === 0 || isBroadcasting}
                  className="h-10 px-6 rounded-lg bg-brand hover:bg-brand-hover text-[var(--text-primary)] text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isBroadcasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                  Send to {broadcastRecipients.length > 0 ? broadcastRecipients.length : 'All'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MessageMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ElementType
  label: string
  value: number
  tone: 'brand' | 'green' | 'blue'
}) {
  const toneClass = {
    brand: 'text-brand bg-brand/10',
    green: 'text-emerald-400 bg-emerald-500/10',
    blue: 'text-sky-400 bg-sky-500/10',
  }[tone]

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5">
        <span className={cn("flex h-5 w-5 items-center justify-center rounded-md", toneClass)}>
          <Icon className="h-3 w-3" />
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="text-lg font-black tabular-nums text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

function RoleFilterButton({
  label,
  count,
  active,
  onClick,
  className,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-all",
        active
          ? "border-brand/40 bg-brand/10 text-brand"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]",
        active && className
      )}
    >
      {label}
      <span className="ml-1.5 opacity-70">{count}</span>
    </button>
  )
}

function EmptyPanelMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
      <Icon className="mx-auto mb-2 h-5 w-5 text-brand" />
      <p className="text-2xl font-black tabular-nums text-[var(--text-primary)]">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
    </div>
  )
}
