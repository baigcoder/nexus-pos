'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Maximize, Volume2, VolumeX, RefreshCw, Pause, Play, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdContent, TransitionEffect } from '@/types/display'
import Image from 'next/image'

interface AdSlideshowProps {
  displayId: string
  restaurantId: string
  restaurant: {
    id: string
    name: string
    logo_url?: string | null
    currency: string
  }
  settings?: {
    transition_effect?: TransitionEffect
    show_clock?: boolean
    show_progress?: boolean
    show_branding?: boolean
  }
}

export function AdSlideshow({ displayId, restaurantId, restaurant, settings }: AdSlideshowProps) {
  const [contents, setContents] = useState<AdContent[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isMuted, setIsMuted] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [progress, setProgress] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const supabase = createClient()

  const transition = settings?.transition_effect || 'fade'

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Check fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Load ad content
  const loadContent = useCallback(async () => {
    setIsLoading(true)
    let query = supabase
      .from('ad_content')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // If displayId is provided, also filter by it (for display-specific content)
    if (displayId) {
      query = query.or(`display_id.eq.${displayId},display_id.is.null`)
    }

    const { data } = await query
    if (data) setContents(data)
    setIsLoading(false)
  }, [restaurantId, displayId, supabase])

  useEffect(() => {
    loadContent()
  }, [loadContent])

  // Auto-advance slides
  useEffect(() => {
    if (contents.length === 0 || isPaused) return

    const currentContent = contents[currentIndex]
    const duration = (currentContent?.duration_seconds || 8) * 1000

    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressTimer)
          return 100
        }
        return prev + (100 / ((duration / 1000) * 10))
      })
    }, 100)

    const slideTimer = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % contents.length)
      setProgress(0)
    }, duration)

    return () => {
      clearInterval(progressTimer)
      clearTimeout(slideTimer)
    }
  }, [contents, currentIndex, isPaused])

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('ad_content_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ad_content',
        filter: `restaurant_id=eq.${restaurantId}`
      }, () => {
        loadContent()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [restaurantId, loadContent, supabase])

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
    setProgress(0)
  }

  const nextSlide = () => {
    setCurrentIndex(prev => (prev + 1) % contents.length)
    setProgress(0)
  }

  const prevSlide = () => {
    setCurrentIndex(prev => prev === 0 ? contents.length - 1 : prev - 1)
    setProgress(0)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const currentContent = contents[currentIndex]

  const getTransitionProps = () => {
    switch (transition) {
      case 'slide':
        return { initial: { x: 100, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: -100, opacity: 0 } }
      case 'zoom':
        return { initial: { scale: 0.9, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 1.1, opacity: 0 } }
      default: // fade
        return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (contents.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-white mb-2">No Content Yet</h2>
          <p className="text-neutral-500">Add advertisements in Display Manager</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ backgroundColor: currentContent?.background_color || '#000000' }}
    >
      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          {...getTransitionProps()}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          {currentContent?.media_type === 'youtube' && currentContent?.media_url ? (
            <iframe
              src={`https://www.youtube.com/embed/${extractYouTubeId(currentContent.media_url)}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${extractYouTubeId(currentContent.media_url)}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : currentContent?.media_type === 'video' && currentContent?.media_url ? (
            <video
              src={currentContent.media_url}
              autoPlay
              loop={false}
              muted={isMuted}
              className="w-full h-full object-cover"
              onEnded={nextSlide}
            />
          ) : currentContent?.media_url ? (
            <Image
              src={currentContent.media_url}
              alt={currentContent.title}
              fill={true}
              className="object-cover"
              priority
            />
          ) : null}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Text Content */}
          <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 lg:p-16">
            <h1
              className="text-4xl md:text-6xl lg:text-7xl font-black mb-4"
              style={{ color: currentContent?.text_color || '#ffffff' }}
            >
              {currentContent?.title}
            </h1>
            {currentContent?.description && (
              <p className="text-xl md:text-2xl text-white/80 max-w-3xl">
                {currentContent.description}
              </p>
            )}
            {currentContent?.cta_text && currentContent?.cta_url && (
              <a
                href={currentContent.cta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-6 px-8 py-4 bg-pink-500 text-white font-bold rounded-xl text-lg"
              >
                {currentContent.cta_text}
              </a>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress Bar */}
      {settings?.show_progress !== false && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <motion.div
            className="h-full bg-pink-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        {/* Navigation */}
        <div className="hidden md:flex items-center gap-1">
          <button
            onClick={prevSlide}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={nextSlide}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Play/Pause */}
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          {isPaused ? <Play className="w-5 h-5 text-white" /> : <Pause className="w-5 h-5 text-white" />}
        </button>

        {/* Mute */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>

        {/* Refresh */}
        <button
          onClick={loadContent}
          className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          <RefreshCw className="w-5 h-5 text-white" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          <Maximize className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Clock */}
      {settings?.show_clock !== false && (
        <div className="absolute top-4 left-4 px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full">
          <span className="text-lg font-bold text-white">
            {currentTime.toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Branding */}
      {settings?.show_branding !== false && (
        <div className="absolute bottom-4 right-4 text-white/50 text-sm">
          {restaurant.name}
        </div>
      )}

      {/* Slide Indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {contents.map((_, i) => (
          <button
            key={i}
            onClick={() => goToSlide(i)}
            className={cn(
              "h-2 rounded-full transition-all",
              i === currentIndex ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
            )}
          />
        ))}
      </div>

      {/* Slide Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full">
        <span className="text-sm font-bold text-white">
          {currentIndex + 1} / {contents.length}
        </span>
      </div>
    </div>
  )
}

function extractYouTubeId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)
  return match ? match[1] : ''
}
