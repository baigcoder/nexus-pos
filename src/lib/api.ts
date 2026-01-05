// API utility functions for consistent error handling and data fetching
import { createClient } from '@/lib/supabase/client'
import type { Category, MenuItem, Order, Table, Restaurant } from '@/types'
import {
    withCache,
    withRetry,
    createCacheKey,
    apiCache,
    handleApiError
} from './api-utils'

// Generic API response type
export type ApiResponse<T> = {
    data: T | null
    error: string | null
    errorCode?: string
    success: boolean
}

// Cache TTL configurations (in milliseconds)
const CACHE_TTL = {
    CATEGORIES: 60000,    // 1 minute
    MENU_ITEMS: 60000,    // 1 minute  
    TABLES: 30000,        // 30 seconds
    ORDERS: 10000,        // 10 seconds (more volatile)
    RESTAURANT: 300000,   // 5 minutes
}

// Helper to handle Supabase errors
function handleError(error: unknown): { message: string; code: string } {
    return handleApiError(error)
}

// ============================================
// CATEGORY API
// ============================================

export async function fetchCategories(
    restaurantId: string,
    options?: { forceRefresh?: boolean }
): Promise<ApiResponse<Category[]>> {
    const cacheKey = createCacheKey('categories', restaurantId)

    return withCache(
        cacheKey,
        async () => {
            try {
                const supabase = createClient()
                const { data, error } = await withRetry(async () =>
                    supabase
                        .from('categories')
                        .select('*')
                        .eq('restaurant_id', restaurantId)
                        .order('display_order', { ascending: true })
                )

                if (error) throw error
                return { data, error: null, success: true }
            } catch (error) {
                const { message, code } = handleError(error)
                return { data: null, error: message, errorCode: code, success: false }
            }
        },
        { ttl: CACHE_TTL.CATEGORIES, forceRefresh: options?.forceRefresh }
    )
}

export async function createCategory(
    restaurantId: string,
    data: { name: string; description?: string; image_url?: string }
): Promise<ApiResponse<Category>> {
    try {
        const supabase = createClient()
        const { data: category, error } = await supabase
            .from('categories')
            .insert({
                restaurant_id: restaurantId,
                name: data.name,
                description: data.description || null,
                image_url: data.image_url || null,
                display_order: 0,
            })
            .select()
            .single()

        if (error) throw error
        // Invalidate cache after create
        apiCache.invalidateByPrefix('categories')
        return { data: category, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

export async function updateCategory(
    categoryId: string,
    data: Partial<Category>
): Promise<ApiResponse<Category>> {
    try {
        const supabase = createClient()
        const { data: category, error } = await supabase
            .from('categories')
            .update(data)
            .eq('id', categoryId)
            .select()
            .single()

        if (error) throw error
        // Invalidate categories cache after update
        apiCache.invalidateByPrefix('categories')
        return { data: category, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

export async function deleteCategory(categoryId: string): Promise<ApiResponse<null>> {
    try {
        const supabase = createClient()
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', categoryId)

        if (error) throw error
        // Invalidate categories cache after delete
        apiCache.invalidateByPrefix('categories')
        return { data: null, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

// ============================================
// MENU ITEMS API
// ============================================

export async function fetchMenuItems(categoryId: string): Promise<ApiResponse<MenuItem[]>> {
    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .eq('category_id', categoryId)
            .order('display_order', { ascending: true })

        if (error) throw error
        return { data, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

export async function fetchAllMenuItems(restaurantId: string): Promise<ApiResponse<MenuItem[]>> {
    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('menu_items')
            .select('*, category:categories(name)')
            .eq('restaurant_id', restaurantId)
            .eq('is_available', true)
            .order('display_order', { ascending: true })

        if (error) throw error
        return { data, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

export async function createMenuItem(
    restaurantId: string,
    categoryId: string,
    data: {
        name: string
        description?: string
        price: number
        dietary_tags?: string[]
        is_available?: boolean
        is_special?: boolean
    }
): Promise<ApiResponse<MenuItem>> {
    try {
        const supabase = createClient()
        const { data: item, error } = await supabase
            .from('menu_items')
            .insert({
                restaurant_id: restaurantId,
                category_id: categoryId,
                name: data.name,
                description: data.description || null,
                price: data.price,
                dietary_tags: data.dietary_tags || [],
                is_available: data.is_available ?? true,
                is_special: data.is_special ?? false,
                display_order: 0,
            })
            .select()
            .single()

        if (error) throw error
        // Invalidate menu items cache
        apiCache.invalidateByPrefix('menu_items')
        return { data: item, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

export async function updateMenuItem(
    itemId: string,
    data: Partial<MenuItem>
): Promise<ApiResponse<MenuItem>> {
    try {
        const supabase = createClient()
        const { data: item, error } = await supabase
            .from('menu_items')
            .update(data)
            .eq('id', itemId)
            .select()
            .single()

        if (error) throw error
        // Invalidate menu items cache
        apiCache.invalidateByPrefix('menu_items')
        return { data: item, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

export async function deleteMenuItem(itemId: string): Promise<ApiResponse<null>> {
    try {
        const supabase = createClient()
        const { error } = await supabase
            .from('menu_items')
            .delete()
            .eq('id', itemId)

        if (error) throw error
        // Invalidate menu items cache
        apiCache.invalidateByPrefix('menu_items')
        return { data: null, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

// ============================================
// TABLES API
// ============================================

export async function fetchTables(restaurantId: string): Promise<ApiResponse<Table[]>> {
    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('tables')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('table_number', { ascending: true })

        if (error) throw error
        return { data, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

export async function createTable(
    restaurantId: string,
    data: { table_number: string; capacity: number; notes?: string }
): Promise<ApiResponse<Table>> {
    try {
        const supabase = createClient()
        const { data: table, error } = await supabase
            .from('tables')
            .insert({
                restaurant_id: restaurantId,
                table_number: data.table_number,
                capacity: data.capacity,
                notes: data.notes || null,
                status: 'available',
            })
            .select()
            .single()

        if (error) throw error
        // Invalidate tables cache
        apiCache.invalidateByPrefix('tables')
        return { data: table, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

export async function updateTableStatus(
    tableId: string,
    status: Table['status']
): Promise<ApiResponse<Table>> {
    try {
        const supabase = createClient()
        const { data: table, error } = await supabase
            .from('tables')
            .update({ status })
            .eq('id', tableId)
            .select()
            .single()

        if (error) throw error
        // Invalidate tables cache
        apiCache.invalidateByPrefix('tables')
        return { data: table, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

// ============================================
// ORDERS API
// ============================================

export async function fetchOrders(
    restaurantId: string,
    status?: string
): Promise<ApiResponse<Order[]>> {
    try {
        const supabase = createClient()
        let query = supabase
            .from('orders')
            .select(`
        *,
        table:tables(id, table_number),
        items:order_items(*, menu_item:menu_items(name, price))
      `)
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })

        if (status) {
            query = query.eq('status', status)
        }

        const { data, error } = await query

        if (error) throw error
        return { data, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

export async function createOrder(
    restaurantId: string,
    tableId: string,
    items: { menu_item_id: string; quantity: number; special_instructions?: string }[]
): Promise<ApiResponse<Order>> {
    try {
        const supabase = createClient()

        // Get menu items for pricing
        const menuItemIds = items.map(i => i.menu_item_id)
        const { data: menuItems, error: menuError } = await supabase
            .from('menu_items')
            .select('id, price')
            .in('id', menuItemIds)

        if (menuError) throw menuError

        // Calculate totals
        const priceMap = new Map(menuItems?.map(m => [m.id, m.price]) || [])
        let subtotal = 0
        const orderItems = items.map(item => {
            const price = priceMap.get(item.menu_item_id) || 0
            const itemSubtotal = price * item.quantity
            subtotal += itemSubtotal
            return {
                menu_item_id: item.menu_item_id,
                quantity: item.quantity,
                unit_price: price,
                subtotal: itemSubtotal,
                special_instructions: item.special_instructions || null,
                status: 'pending',
            }
        })

        const tax = Math.round(subtotal * 0.16)
        const total = subtotal + tax

        // Create order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                restaurant_id: restaurantId,
                table_id: tableId,
                status: 'pending',
                subtotal,
                tax,
                total,
                discount: 0,
            })
            .select()
            .single()

        if (orderError) throw orderError

        // Create order items
        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems.map(item => ({ ...item, order_id: order.id })))

        if (itemsError) throw itemsError

        // Update table status
        await supabase
            .from('tables')
            .update({ status: 'occupied' })
            .eq('id', tableId)

        return { data: order, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

export async function updateOrderStatus(
    orderId: string,
    status: Order['status']
): Promise<ApiResponse<Order>> {
    try {
        const supabase = createClient()
        const { data: order, error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId)
            .select()
            .single()

        if (error) throw error
        // Invalidate orders cache
        apiCache.invalidateByPrefix('orders')
        return { data: order, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

// ============================================
// RESTAURANT API
// ============================================

export async function fetchRestaurant(userId: string): Promise<ApiResponse<Restaurant>> {
    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('restaurants')
            .select('*')
            .eq('owner_id', userId)
            .single()

        if (error) throw error
        return { data, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}

export async function updateRestaurant(
    restaurantId: string,
    data: Partial<Restaurant>
): Promise<ApiResponse<Restaurant>> {
    try {
        const supabase = createClient()
        const { data: restaurant, error } = await supabase
            .from('restaurants')
            .update(data)
            .eq('id', restaurantId)
            .select()
            .single()

        if (error) throw error
        // Invalidate restaurant cache
        apiCache.invalidateByPrefix('restaurant')
        return { data: restaurant, error: null, success: true }
    } catch (error) {
        const { message, code } = handleError(error)
        return { data: null, error: message, errorCode: code, success: false }
    }
}
