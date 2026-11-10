'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, RefreshCw, Settings2, Volume2, VolumeX } from 'lucide-react'
import type { TransitionEffect } from '@/types/display'
import { SignageArtwork, type DisplaySlide } from './SignageArtwork'
import styles from './signage.module.css'

export type { DisplaySlide } from './SignageArtwork'

interface AdSlideshowProps {
    contents: DisplaySlide[]
    onRefresh: () => void
    restaurant: { id: string; name: string; logo_url?: string | null; currency: string }
    settings?: { transition_effect?: TransitionEffect; show_clock?: boolean; show_progress?: boolean; show_branding?: boolean }
}

export function AdSlideshow({ contents, onRefresh, restaurant, settings }: AdSlideshowProps) {
    const [selected, setSelected] = useState<string>()
    const [paused, setPaused] = useState(false)
    const [muted, setMuted] = useState(true)
    const [controls, setControls] = useState(false)
    const [fullscreen, setFullscreen] = useState(false)
    const [clock, setClock] = useState('')
    const [progress, setProgress] = useState(0)
    const [problem, setProblem] = useState('')
    const reduced = useReducedMotion()
    const player = useRef<HTMLElement>(null)
    const remaining = useRef<{ id: string; duration: number; ms: number } | null>(null)
    const index = Math.max(0, contents.findIndex(slide => slide.id === selected))
    const active = contents[index]
    const nextId = contents[(index + 1) % contents.length]?.id
    const duration = Math.min(300, Math.max(1, Number(active?.duration_seconds) || 8)) * 1000
    const multiple = contents.length > 1

    useEffect(() => {
        const changed = () => setFullscreen(document.fullscreenElement === player.current)
        document.addEventListener('fullscreenchange', changed)
        return () => document.removeEventListener('fullscreenchange', changed)
    }, [])

    useEffect(() => {
        if (!settings?.show_clock) return
        const update = () => setClock(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
        update()
        const timer = window.setInterval(update, 1000)
        return () => window.clearInterval(timer)
    }, [settings?.show_clock])

    useEffect(() => {
        if (!active?.id || !multiple || !nextId) return
        if (remaining.current?.id !== active.id || remaining.current.duration !== duration) {
            remaining.current = { id: active.id, duration, ms: duration }
            setProgress(0)
        }
        if (paused) return
        const run = remaining.current
        const began = performance.now()
        const elapsed = () => performance.now() - began
        const advance = window.setTimeout(() => setSelected(nextId), run.ms)
        const ticker = settings?.show_progress ? window.setInterval(() => setProgress(Math.min(100, (1 - (run.ms - elapsed()) / duration) * 100)), 150) : undefined
        return () => {
            run.ms = Math.max(0, run.ms - elapsed())
            window.clearTimeout(advance)
            window.clearInterval(ticker)
        }
    }, [active?.id, duration, multiple, nextId, paused, settings?.show_progress])

    function go(offset: number) {
        if (multiple) setSelected(contents[(index + offset + contents.length) % contents.length]?.id)
    }

    async function toggleFullscreen() {
        setProblem('')
        try {
            if (document.fullscreenElement) await document.exitFullscreen()
            else if (player.current?.requestFullscreen) { await player.current.requestFullscreen(); setControls(false) }
            else throw new Error('Unavailable')
        } catch { setProblem('Fullscreen is unavailable in this browser.') }
    }

    const transition = reduced ? {} : settings?.transition_effect === 'slide' ? { x: 16 }
        : settings?.transition_effect === 'zoom' ? { scale: .985 } : {}

    return <main ref={player} className={styles.player} aria-label="Advertisement player">
        {active ? <AnimatePresence initial={false}>
            <motion.div key={active.id} className={styles.playerSlide} initial={{ opacity: 0, ...transition }}
                animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .28 }}>
                <SignageArtwork slide={active} playing={!paused} muted={muted} loop={!multiple}
                    onEnded={() => { if (multiple && !paused) setSelected(current => !current || current === active.id ? nextId : current) }} />
            </motion.div>
        </AnimatePresence> : <div className={styles.playerEmpty}><h1>{restaurant.name}</h1><p>This screen has no scheduled promotions.</p></div>}
        {settings?.show_progress && active && multiple && <div className={styles.progress} aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>}
        {(settings?.show_branding || settings?.show_clock) && <p className={styles.playerInfo}>{settings.show_branding && restaurant.name}{settings.show_branding && settings.show_clock && ' · '}{settings.show_clock && clock}</p>}
        <div className={styles.controls} data-open={controls}>
            {controls && <>
                {multiple && <>
                    <button type="button" aria-label="Previous slide" onClick={() => go(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
                    <span className={styles.controlCount}>{index + 1} / {contents.length}</span>
                    <button type="button" aria-label="Next slide" onClick={() => go(1)}><ChevronRight size={20} aria-hidden="true" /></button>
                </>}
                {active && <button type="button" aria-label={paused ? 'Play' : 'Pause'} onClick={() => setPaused(!paused)}>{paused ? <Play size={18} /> : <Pause size={18} />}</button>}
                {active && ['video', 'youtube'].includes(active.media_type) && <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>}
                <button type="button" aria-label="Refresh playlist" onClick={onRefresh}><RefreshCw size={18} /></button>
                <button type="button" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
            </>}
            <button type="button" aria-label={controls ? 'Hide playback controls' : 'Show playback controls'} aria-expanded={controls} onClick={() => setControls(!controls)}><Settings2 size={18} /></button>
        </div>
        {problem && <p className={styles.playerProblem} role="status">{problem}</p>}
    </main>
}
