'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuthStore } from '@/stores'

// Available DaisyUI themes
export const AVAILABLE_THEMES = [
    { id: 'dark', name: 'Industrial Dark', preview: '#1E293B' },
    { id: 'light', name: 'Clean Light', preview: '#F8FAFC' },
    { id: 'luxury', name: 'Luxury Gold', preview: '#171618' },
    { id: 'cyberpunk', name: 'Neon Cyberpunk', preview: '#FF7598' },
    { id: 'coffee', name: 'Warm Coffee', preview: '#20161F' },
    { id: 'forest', name: 'Deep Forest', preview: '#171D19' },
    { id: 'cupcake', name: 'Soft Cupcake', preview: '#FAF7F5' },
    { id: 'valentine', name: 'Valentine Pink', preview: '#E96D7B' },
    { id: 'business', name: 'Corporate Business', preview: '#1C4E80' },
    { id: 'night', name: 'Midnight Night', preview: '#0F172A' },
] as const

export type ThemeId = typeof AVAILABLE_THEMES[number]['id']

interface ThemeContextType {
    theme: ThemeId
    setTheme: (theme: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
    const { restaurant } = useAuthStore()
    const [theme, setThemeState] = useState<ThemeId>('dark')

    // Load theme from restaurant settings or localStorage
    useEffect(() => {
        const savedTheme = restaurant?.settings?.theme || localStorage.getItem('orderflow-theme') || 'dark'
        setThemeState(savedTheme as ThemeId)
    }, [restaurant])

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('orderflow-theme', theme)
    }, [theme])

    const setTheme = (newTheme: ThemeId) => {
        setThemeState(newTheme)
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
