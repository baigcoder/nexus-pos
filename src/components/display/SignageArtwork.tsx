'use client'

import { useEffect, useRef, useState } from 'react'
import { Film, ImageOff } from 'lucide-react'
import type { AdContent } from '@/types/display'
import styles from './signage.module.css'

export type DisplaySlide = Pick<AdContent, 'id' | 'title' | 'description' | 'media_url' | 'media_type' |
    'duration_seconds' | 'background_color' | 'text_color' | 'cta_text' | 'cta_url'>

export function youtubeId(value: string) {
    try {
        const url = new URL(value)
        const host = url.hostname.replace(/^www\./, '')
        const [kind, pathId] = url.pathname.split('/').filter(Boolean)
        const id = host === 'youtu.be' ? kind :
            ['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)
                ? url.searchParams.get('v') || (['embed', 'shorts', 'live', 'v'].includes(kind) ? pathId : '') : ''
        return id && /^[\w-]{11}$/.test(id) ? id : ''
    } catch { return '' }
}

export function httpsUrl(value?: string | null) {
    if (!value) return ''
    try {
        const url = new URL(value)
        return url.protocol === 'https:' ? url.href : ''
    } catch { return '' }
}

export function SignageArtwork({ slide, playing = false, muted = true, loop = false, onEnded }: {
    slide: DisplaySlide; playing?: boolean; muted?: boolean; loop?: boolean; onEnded?: () => void
}) {
    const media = slide.media_url || ''
    const [failed, setFailed] = useState('')
    const video = useRef<HTMLVideoElement>(null)
    const youtube = slide.media_type === 'youtube' ? youtubeId(media) : ''
    const cta = httpsUrl(slide.cta_url)

    useEffect(() => {
        const player = video.current
        if (!player) return
        if (playing) void player.play().catch(() => {})
        else player.pause()
    }, [playing, media])

    return <div className={styles.artwork} style={{ backgroundColor: slide.background_color || '#171a15', color: slide.text_color || '#fff' }}>
        {media && failed !== media && (slide.media_type === 'youtube' ? (
            youtube && (playing
                ? <iframe title={slide.title} src={`https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1&mute=${muted ? 1 : 0}&playsinline=1&loop=${loop ? 1 : 0}&playlist=${youtube}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                : <img src={`https://i.ytimg.com/vi/${youtube}/hqdefault.jpg`} alt="" onError={() => setFailed(media)} />)
        ) : slide.media_type === 'video' ? (
            <video key={media} ref={video} src={media} muted={muted} playsInline loop={loop} preload={playing ? 'auto' : 'metadata'} onEnded={onEnded} onError={() => setFailed(media)} />
        ) : (
            <img key={media} src={media} alt="" referrerPolicy="no-referrer" onError={() => setFailed(media)} />
        ))}
        {failed === media && !!media && <ImageOff className={styles.artFallback} aria-label="Media unavailable" />}
        {!media && <Film className={styles.artFallback} aria-hidden="true" />}
        <div className={styles.artCopy}>
            <strong>{slide.title}</strong>
            {slide.description && <p>{slide.description}</p>}
            {slide.cta_text && cta && (onEnded
                ? <a href={cta} target="_blank" rel="noopener noreferrer">{slide.cta_text}</a>
                : <span>{slide.cta_text}</span>)}
        </div>
    </div>
}
