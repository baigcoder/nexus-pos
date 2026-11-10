'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { APPEARANCE_KEY, COLOR_SCHEME_QUERY } from '@/lib/appearance'
import { useAuthStore } from '@/stores'

const supportedThemes = ['dark', 'light', 'luxury', 'cyberpunk', 'coffee', 'forest', 'cupcake', 'valentine', 'business', 'night'] as const
export type Appearance = 'auto' | 'light' | 'dark'

interface ThemeContextType {
    appearance: Appearance
    setAppearance: (appearance: Appearance) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function parseAppearance(value: string | null): Appearance {
    return value === 'light' || value === 'dark' ? value : 'auto'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const workspaceTheme = useAuthStore(state => state.restaurant?.settings?.theme)
    const [appearance, setPreference] = useState<Appearance>('auto')
    const [systemDark, setSystemDark] = useState<boolean>()

    useEffect(() => {
        const media = window.matchMedia(COLOR_SCHEME_QUERY)
        const syncSystem = () => setSystemDark(media.matches)
        syncSystem()
        try { setPreference(parseAppearance(localStorage.getItem(APPEARANCE_KEY))) } catch {}
        const syncPreference = (event: StorageEvent) => {
            if (event.key === APPEARANCE_KEY || event.key === null) setPreference(parseAppearance(event.newValue))
        }
        media.addEventListener('change', syncSystem)
        window.addEventListener('storage', syncPreference)
        return () => {
            media.removeEventListener('change', syncSystem)
            window.removeEventListener('storage', syncPreference)
        }
    }, [])

    useEffect(() => {
        if (systemDark === undefined) return
        const configured = supportedThemes.find(theme => theme === workspaceTheme)
        document.documentElement.dataset.theme = appearance === 'auto' ? configured || (systemDark ? 'dark' : 'light') : appearance
    }, [appearance, systemDark, workspaceTheme])

    function setAppearance(value: Appearance) {
        setPreference(value)
        try { localStorage.setItem(APPEARANCE_KEY, value) } catch {}
    }

    return <ThemeContext.Provider value={{ appearance, setAppearance }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) throw new Error('useTheme must be used within a ThemeProvider')
    return context
}
