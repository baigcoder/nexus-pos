import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ],
}

export type CallSignalType = 'offer' | 'answer' | 'ice-candidate' | 'hang-up' | 'reject' | 'incoming-call'
export type CallType = 'audio' | 'video'

export interface CallSignal {
    type: CallSignalType
    callId: string
    fromId: string
    toId: string
    callType?: CallType
    payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | null
}

export interface IncomingCallData {
    callId: string
    fromId: string
    fromName: string
    fromRole: string
    callType: CallType
    offer: RTCSessionDescriptionInit
}

// Check if we're on localhost (HTTP) - browsers block media on insecure origins
export function isLocalhost(): boolean {
    if (typeof window === 'undefined') return false
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

export function isSecureContext(): boolean {
    if (typeof window === 'undefined') return false
    return window.isSecureContext || window.location.protocol === 'https:'
}

export function createCallChannel(callId: string, onSignal: (signal: CallSignal) => void): RealtimeChannel {
    const supabase = createClient()
    const channel = supabase.channel(`call:${callId}`, {
        config: { broadcast: { self: true } },
    })

    channel.on('broadcast', { event: 'signal' }, (payload: { payload: CallSignal }) => {
        onSignal(payload.payload)
    })

    channel.subscribe()
    return channel
}

export function sendSignal(channel: RealtimeChannel, signal: CallSignal): void {
    channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: signal,
    })
}

export function createPeerConnection(
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onTrack: (stream: MediaStream) => void,
): RTCPeerConnection {
    const pc = new RTCPeerConnection(ICE_SERVERS)

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            onIceCandidate(event.candidate)
        }
    }

    pc.ontrack = (event) => {
        if (event.streams[0]) {
            onTrack(event.streams[0])
        }
    }

    return pc
}

export async function getLocalStream(callType: CallType = 'audio'): Promise<MediaStream> {
    try {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('MediaDevicesUnavailable')
        }

        const constraints: MediaStreamConstraints = {
            audio: callType === 'audio' || callType === 'video' ? {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            } : false,
            video: callType === 'video' ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
            } : false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        return stream
    } catch (error: unknown) {
        const err = error as Error
        console.error('Media permission error:', err)
        const policy = typeof document !== 'undefined'
            ? ((document as Document & {
                featurePolicy?: { allowsFeature?: (feature: string) => boolean }
                permissionsPolicy?: { allowsFeature?: (feature: string) => boolean }
            }).permissionsPolicy || (document as Document & {
                featurePolicy?: { allowsFeature?: (feature: string) => boolean }
            }).featurePolicy)
            : undefined
        const microphoneBlocked = policy?.allowsFeature?.('microphone') === false
        const cameraBlocked = callType === 'video' && policy?.allowsFeature?.('camera') === false

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            if (microphoneBlocked || cameraBlocked) {
                throw new Error('Camera/microphone access is blocked by this page policy. Allow media access for this site or update the deployment security headers.')
            }
            throw new Error('Camera/microphone access denied. Please click "Allow" when the browser asks for permission and check the site permission settings in your browser.')
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            throw new Error('No camera/microphone found. Please connect a device or check if another app is using it.')
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            throw new Error('Camera or microphone is already in use by another application.')
        } else if (err.name === 'OverconstrainedError') {
            throw new Error('Camera settings not supported. Trying with basic settings...')
        } else if (err.name === 'SecurityError') {
            throw new Error('Media access blocked. HTTPS is required for camera/microphone access. Please use HTTPS or localhost.')
        } else if (err.message === 'MediaDevicesUnavailable') {
            throw new Error('Camera/microphone access is not available in this browser context. Open the app directly over HTTPS or localhost instead of an embedded or restricted document.')
        }

        throw new Error(`Failed to access camera/microphone: ${err.message || 'Unknown error'}. Please check your device settings.`)
    }
}

export async function getVideoStream(): Promise<MediaStream> {
    try {
        return await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
            },
            audio: false,
        })
    } catch (error: unknown) {
        const err = error as Error
        console.error('Video permission error:', err)
        throw new Error('Failed to access camera. Please check your camera settings.')
    }
}

export function hangUp(pc: RTCPeerConnection, channel: RealtimeChannel, localStream: MediaStream | null): void {
    pc.close()
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
    }
    try {
        const supabase = createClient()
        supabase.removeChannel(channel)
    } catch {
        // Channel may already be removed
    }
}

export function formatCallDuration(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Check if peer is online via presence
export function setupPresenceChannel(
    restaurantId: string,
    staffId: string,
    onPresenceSync: (presences: Record<string, { online: boolean; lastSeen: string }>) => void
): RealtimeChannel {
    const supabase = createClient()
    const channel = supabase.channel(`presence:${restaurantId}`)

    channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const presences: Record<string, { online: boolean; lastSeen: string }> = {}

        Object.entries(state).forEach(([userId, events]) => {
            const event = (events as any[])[0]
            presences[userId] = {
                online: event?.online || false,
                lastSeen: event?.lastSeen || new Date().toISOString(),
            }
        })

        onPresenceSync(presences)
    })

    channel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
            await channel.track({
                staff_id: staffId,
                online: true,
                lastSeen: new Date().toISOString(),
            })
        }
    })

    return channel
}
