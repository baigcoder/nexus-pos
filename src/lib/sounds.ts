// Sound utilities for OrderFlow

const notificationSounds = {
    newOrder: typeof window !== 'undefined' ? new Audio('/sounds/new-order.mp3') : null,
    orderReady: typeof window !== 'undefined' ? new Audio('/sounds/order-ready.mp3') : null,
    alert: typeof window !== 'undefined' ? new Audio('/sounds/alert.mp3') : null,
}

// Use Web Audio API for generated sounds (no external files needed)
export function playBeep(type: 'newOrder' | 'orderReady' | 'alert' = 'newOrder') {
    if (typeof window === 'undefined') return

    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
        const audioContext = new AudioContext()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        // Different tones for different events
        const frequencies: Record<string, number[]> = {
            newOrder: [523.25, 659.25, 783.99], // C5, E5, G5 - pleasant chord
            orderReady: [783.99, 880, 1046.5], // G5, A5, C6 - high excited tone
            alert: [440, 440, 440], // A4 repeated - attention
        }

        const freqs = frequencies[type] || frequencies.newOrder
        const duration = type === 'alert' ? 0.15 : 0.2
        const gap = 0.05

        freqs.forEach((freq, i) => {
            const startTime = audioContext.currentTime + i * (duration + gap)
            oscillator.frequency.setValueAtTime(freq, startTime)
            gainNode.gain.setValueAtTime(0.3, startTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
        })

        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + freqs.length * (duration + gap))
    } catch (e) {
        console.warn('Audio playback failed:', e)
    }
}

// Play new order notification
export function playNewOrderSound() {
    playBeep('newOrder')
}

// Play order ready notification
export function playOrderReadySound() {
    playBeep('orderReady')
}

// Play alert sound
export function playAlertSound() {
    playBeep('alert')
}

// Check if browser supports audio
export function isAudioSupported(): boolean {
    return typeof window !== 'undefined' &&
        (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined')
}
