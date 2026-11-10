'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type Appearance } from '@/components/ThemeProvider'
import styles from './appearance-control.module.css'

export function AppearanceControl() {
    const { appearance, setAppearance } = useTheme()
    const Icon = appearance === 'light' ? Sun : appearance === 'dark' ? Moon : Monitor
    return <label className={styles.control} title="Auto uses the restaurant theme when set, or your device appearance.">
        <Icon size={16} aria-hidden="true" />
        <select value={appearance} onChange={event => setAppearance(event.target.value as Appearance)} aria-label="Appearance">
            <option value="auto">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    </label>
}
