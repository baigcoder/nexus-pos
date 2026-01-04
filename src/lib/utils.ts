// Utility functions for formatting, validation, and common operations
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ============================================
// CLASSNAME UTILITIES
// ============================================

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// ============================================
// CURRENCY FORMATTING
// ============================================

export function formatCurrency(
    amount: number,
    currency: string = 'PKR',
    locale: string = 'en-PK'
): string {
    if (currency === 'PKR') {
        return `Rs. ${amount.toLocaleString(locale)}`
    }

    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
    }).format(amount)
}

export function formatPrice(price: number): string {
    return formatCurrency(price)
}

// ============================================
// DATE & TIME FORMATTING
// ============================================

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', options || {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

export function formatTime(date: string | Date): string {
    const d = new Date(date)
    return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function formatDateTime(date: string | Date): string {
    return `${formatDate(date)} at ${formatTime(date)}`
}

export function getTimeAgo(date: string | Date): string {
    const now = Date.now()
    const past = new Date(date).getTime()
    const diffMs = now - past
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`

    return formatDate(date)
}

export function getElapsedTime(startTime: string | Date): { minutes: number; seconds: number; formatted: string } {
    const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    return {
        minutes,
        seconds,
        formatted: `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
}

// ============================================
// ORDER UTILITIES
// ============================================

export function generateOrderNumber(): number {
    return Math.floor(1000 + Math.random() * 9000)
}

export function calculateOrderTotals(items: { price: number; quantity: number }[], taxRate: number = 0.16) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const tax = Math.round(subtotal * taxRate)
    const total = subtotal + tax
    return { subtotal, tax, total }
}

export function getOrderStatusColor(status: string): { bg: string; text: string; border: string } {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
        pending: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-500' },
        preparing: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-500' },
        ready: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500' },
        served: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-500' },
        paid: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-500' },
        cancelled: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-500' },
    }
    return colors[status] || colors.pending
}

export function getTableStatusColor(status: string): { bg: string; text: string } {
    const colors: Record<string, { bg: string; text: string }> = {
        available: { bg: 'bg-green-100', text: 'text-green-700' },
        occupied: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
        reserved: { bg: 'bg-blue-100', text: 'text-blue-700' },
        billing: { bg: 'bg-red-100', text: 'text-red-700' },
    }
    return colors[status] || colors.available
}

// ============================================
// VALIDATION
// ============================================

export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

export function isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\d\s\-+()]{10,}$/
    return phoneRegex.test(phone)
}

export function isValidPin(pin: string): boolean {
    return /^\d{4}$/.test(pin)
}

// ============================================
// DIETARY TAGS
// ============================================

export const DIETARY_TAGS = [
    { value: 'vegetarian', label: 'Vegetarian', emoji: '🥬' },
    { value: 'vegan', label: 'Vegan', emoji: '🌱' },
    { value: 'spicy', label: 'Spicy', emoji: '🌶️' },
    { value: 'gluten-free', label: 'Gluten-Free', emoji: '🌾' },
    { value: 'halal', label: 'Halal', emoji: '☪️' },
    { value: 'dairy-free', label: 'Dairy-Free', emoji: '🥛' },
    { value: 'nut-free', label: 'Nut-Free', emoji: '🥜' },
] as const

export function getDietaryEmoji(tag: string): string {
    const found = DIETARY_TAGS.find(t => t.value === tag)
    return found?.emoji || ''
}

// ============================================
// STRING UTILITIES
// ============================================

export function truncate(str: string, length: number): string {
    if (str.length <= length) return str
    return str.slice(0, length) + '...'
}

export function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function slugify(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export function getInitials(name: string): string {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
}

// ============================================
// QR CODE URL
// ============================================

export function getOrderUrl(baseUrl: string, tableNumber: string): string {
    return `${baseUrl}/order?table=${tableNumber}`
}

export function getTrackingUrl(baseUrl: string, orderNumber: string): string {
    return `${baseUrl}/track?order=${orderNumber}`
}

// ============================================
// STORAGE
// ============================================

export function getFromStorage<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue

    try {
        const item = localStorage.getItem(key)
        return item ? JSON.parse(item) : defaultValue
    } catch {
        return defaultValue
    }
}

export function saveToStorage<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return

    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
        console.error('Error saving to storage:', error)
    }
}

export function removeFromStorage(key: string): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(key)
}
