const CURRENCY_CODE = 'PKR'
const CURRENCY_LOCALE = 'en-PK'

const currencyFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: 'currency',
    currency: CURRENCY_CODE,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
})

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
})

const numberFormatter = new Intl.NumberFormat('en-US')

export function formatCurrency(value: number, currency?: string): string {
    if (currency && currency !== 'PKR') {
        const locale = currency === 'USD' ? 'en-US' : currency === 'EUR' ? 'de-DE' : currency === 'GBP' ? 'en-GB' : currency === 'AED' ? 'ar-AE' : currency === 'SAR' ? 'ar-SA' : currency === 'INR' ? 'en-IN' : 'en-US'
        try {
            return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
        } catch {
            return `${currency} ${value.toLocaleString()}`
        }
    }
    return currencyFormatter.format(value)
}

export function formatDate(date: string | Date): string {
    return dateFormatter.format(new Date(date))
}

export function formatTime(date: string | Date): string {
    return timeFormatter.format(new Date(date))
}

export function formatShortDate(date: string | Date): string {
    return shortDateFormatter.format(new Date(date))
}

export function formatRelativeTime(date: string | Date): string {
    const now = Date.now()
    const target = new Date(date).getTime()
    const diffMs = now - target
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return formatShortDate(date)
}

export function formatPercentage(value: number, decimals: number = 1): string {
    return `${value.toFixed(decimals)}%`
}

export function formatNumber(value: number): string {
    return numberFormatter.format(value)
}

export function formatCompact(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return value.toString()
}

export function getStartOfDay(date: Date = new Date()): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

export function getEndOfDay(date: Date = new Date()): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

export function getDaysAgo(days: number): Date {
    const d = new Date()
    d.setDate(d.getDate() - days)
    d.setHours(0, 0, 0, 0)
    return d
}