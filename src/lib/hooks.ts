// Custom React hooks for data fetching and state management
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import type { Category, MenuItem, Order, Table } from '@/types'

// Generic loading state hook
export function useLoading(initialState = false) {
    const [isLoading, setIsLoading] = useState(initialState)
    const startLoading = useCallback(() => setIsLoading(true), [])
    const stopLoading = useCallback(() => setIsLoading(false), [])
    return { isLoading, startLoading, stopLoading, setIsLoading }
}

// Debounce hook for search inputs
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState(value)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])

    return debouncedValue
}

// Categories data hook
export function useCategories() {
    const { restaurant } = useAuthStore()
    const [categories, setCategories] = useState<Category[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchCategories = useCallback(async () => {
        if (!restaurant?.id) return

        setIsLoading(true)
        setError(null)

        try {
            const supabase = createClient()
            const { data, error: fetchError } = await supabase
                .from('categories')
                .select('*')
                .eq('restaurant_id', restaurant.id)
                .order('display_order', { ascending: true })

            if (fetchError) throw fetchError
            setCategories(data || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch categories')
        } finally {
            setIsLoading(false)
        }
    }, [restaurant?.id])

    useEffect(() => {
        fetchCategories()
    }, [fetchCategories])

    return { categories, isLoading, error, refetch: fetchCategories, setCategories }
}

// Menu items data hook
export function useMenuItems(categoryId?: string) {
    const { restaurant } = useAuthStore()
    const [items, setItems] = useState<MenuItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchItems = useCallback(async () => {
        if (!restaurant?.id) return

        setIsLoading(true)
        setError(null)

        try {
            const supabase = createClient()
            let query = supabase
                .from('menu_items')
                .select('*')
                .eq('restaurant_id', restaurant.id)
                .order('display_order', { ascending: true })

            if (categoryId) {
                query = query.eq('category_id', categoryId)
            }

            const { data, error: fetchError } = await query

            if (fetchError) throw fetchError
            setItems(data || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch menu items')
        } finally {
            setIsLoading(false)
        }
    }, [restaurant?.id, categoryId])

    useEffect(() => {
        fetchItems()
    }, [fetchItems])

    return { items, isLoading, error, refetch: fetchItems, setItems }
}

// Tables data hook
export function useTables() {
    const { restaurant } = useAuthStore()
    const [tables, setTables] = useState<Table[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchTables = useCallback(async () => {
        if (!restaurant?.id) return

        setIsLoading(true)
        setError(null)

        try {
            const supabase = createClient()
            const { data, error: fetchError } = await supabase
                .from('tables')
                .select('*')
                .eq('restaurant_id', restaurant.id)
                .order('table_number', { ascending: true })

            if (fetchError) throw fetchError
            setTables(data || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch tables')
        } finally {
            setIsLoading(false)
        }
    }, [restaurant?.id])

    useEffect(() => {
        fetchTables()
    }, [fetchTables])

    return { tables, isLoading, error, refetch: fetchTables, setTables }
}

// Orders data hook with real-time subscription
export function useOrders(statusFilter?: string) {
    const { restaurant } = useAuthStore()
    const [orders, setOrders] = useState<Order[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchOrders = useCallback(async () => {
        if (!restaurant?.id) return

        setIsLoading(true)
        setError(null)

        try {
            const supabase = createClient()
            let query = supabase
                .from('orders')
                .select(`
          *,
          table:tables(id, table_number),
          items:order_items(*, menu_item:menu_items(id, name, price))
        `)
                .eq('restaurant_id', restaurant.id)
                .order('created_at', { ascending: false })

            if (statusFilter && statusFilter !== 'all') {
                query = query.eq('status', statusFilter)
            }

            const { data, error: fetchError } = await query

            if (fetchError) throw fetchError
            setOrders(data || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch orders')
        } finally {
            setIsLoading(false)
        }
    }, [restaurant?.id, statusFilter])

    // Set up real-time subscription
    useEffect(() => {
        if (!restaurant?.id) return

        const supabase = createClient()
        const channel = supabase
            .channel('orders-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `restaurant_id=eq.${restaurant.id}`,
                },
                () => {
                    fetchOrders()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [restaurant?.id, fetchOrders])

    useEffect(() => {
        fetchOrders()
    }, [fetchOrders])

    return { orders, isLoading, error, refetch: fetchOrders, setOrders }
}

// Local storage hook
export function useLocalStorage<T>(key: string, initialValue: T) {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') return initialValue

        try {
            const item = window.localStorage.getItem(key)
            return item ? JSON.parse(item) : initialValue
        } catch {
            return initialValue
        }
    })

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value
            setStoredValue(valueToStore)
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore))
            }
        } catch (error) {
            console.error('Error saving to localStorage:', error)
        }
    }

    return [storedValue, setValue] as const
}

// Time elapsed hook (for kitchen display)
export function useTimeElapsed(startTime: string | Date) {
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        const calculateElapsed = () => {
            const start = new Date(startTime).getTime()
            const now = Date.now()
            return Math.floor((now - start) / 1000)
        }

        setElapsed(calculateElapsed())

        const interval = setInterval(() => {
            setElapsed(calculateElapsed())
        }, 1000)

        return () => clearInterval(interval)
    }, [startTime])

    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`

    return { elapsed, minutes, seconds, formatted }
}

// Sound notification hook
export function useNotificationSound() {
    const [enabled, setEnabled] = useState(true)

    const play = useCallback(() => {
        if (!enabled) return

        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleg==')
            audio.volume = 0.5
            audio.play().catch(() => { })
        } catch {
            // Audio not supported
        }
    }, [enabled])

    return { enabled, setEnabled, play }
}
