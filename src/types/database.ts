// OrderFlow Database Types
// These types match the Supabase database schema

export type UserRole = 'owner' | 'manager' | 'waiter' | 'kitchen' | 'cashier' | 'delivery'

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'billing'

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled'

export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served'

export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'other'

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

// Database Tables

export interface Restaurant {
    id: string
    owner_id: string
    name: string
    slug: string
    logo_url: string | null
    address: string | null
    phone: string | null
    email: string | null
    operating_hours: OperatingHours | null
    settings: RestaurantSettings | null
    currency: string
    tax_rate: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface OperatingHours {
    monday?: { open: string; close: string; closed?: boolean }
    tuesday?: { open: string; close: string; closed?: boolean }
    wednesday?: { open: string; close: string; closed?: boolean }
    thursday?: { open: string; close: string; closed?: boolean }
    friday?: { open: string; close: string; closed?: boolean }
    saturday?: { open: string; close: string; closed?: boolean }
    sunday?: { open: string; close: string; closed?: boolean }
}

export interface RestaurantSettings {
    theme?: 'light' | 'dark' | 'system'
    language?: string
    sound_enabled?: boolean
    auto_accept_orders?: boolean
    show_prices_to_kitchen?: boolean
}

export interface Staff {
    id: string
    restaurant_id: string
    user_id: string | null
    name: string
    email: string | null
    pin: string | null
    role: UserRole
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface Category {
    id: string
    restaurant_id: string
    name: string
    description: string | null
    image_url: string | null
    display_order: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface MenuItem {
    id: string
    restaurant_id: string
    category_id: string
    name: string
    description: string | null
    price: number
    image_url: string | null
    dietary_tags: string[]
    customizations: MenuCustomization[]
    is_available: boolean
    is_special: boolean
    special_until: string | null
    preparation_time: number | null
    display_order: number
    created_at: string
    updated_at: string
}

export interface MenuCustomization {
    id: string
    name: string
    type: 'single' | 'multiple'
    required: boolean
    options: CustomizationOption[]
}

export interface CustomizationOption {
    id: string
    name: string
    price_modifier: number
}

export interface Table {
    id: string
    restaurant_id: string
    table_number: string
    capacity: number
    status: TableStatus
    qr_code: string | null
    notes: string | null
    created_at: string
    updated_at: string
}

export interface Order {
    id: string
    restaurant_id: string
    table_id: string
    staff_id: string | null
    order_number: number
    status: OrderStatus
    subtotal: number
    tax: number
    discount: number
    total: number
    notes: string | null
    is_priority: boolean
    created_at: string
    updated_at: string
    // Joined data
    table?: Table
    staff?: Staff
    items?: OrderItem[]
}

export interface OrderItem {
    id: string
    order_id: string
    menu_item_id: string
    quantity: number
    unit_price: number
    subtotal: number
    special_instructions: string | null
    customizations: SelectedCustomization[]
    status: OrderItemStatus
    created_at: string
    // Joined data
    menu_item?: MenuItem
}

export interface SelectedCustomization {
    customization_id: string
    customization_name: string
    selected_options: {
        option_id: string
        option_name: string
        price_modifier: number
    }[]
}

export interface Payment {
    id: string
    order_id: string
    amount: number
    method: PaymentMethod
    status: PaymentStatus
    transaction_id: string | null
    notes: string | null
    created_at: string
}

export interface SplitPayment {
    id: string
    order_id: string
    split_number: number
    amount: number
    payment_method: PaymentMethod | null
    payment_status: PaymentStatus
    items: string[]  // Array of order_item_ids
    notes: string | null
    created_at: string
    updated_at: string
}

export type SplitType = 'equal' | 'by_items' | 'custom'

export interface SplitBillConfig {
    type: SplitType
    splitCount?: number  // for equal splits
    splits?: {
        items?: string[]  // order_item_ids for by_items split
        amount: number
        label?: string
    }[]
}

// API Response Types

export interface ApiResponse<T> {
    data: T | null
    error: string | null
    success: boolean
}

export interface PaginatedResponse<T> {
    data: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

// Form Input Types

export interface CreateRestaurantInput {
    name: string
    slug?: string
    address?: string
    phone?: string
    email?: string
    currency?: string
    tax_rate?: number
}

export interface CreateCategoryInput {
    name: string
    description?: string
    image_url?: string
    display_order?: number
}

export interface CreateMenuItemInput {
    category_id: string
    name: string
    description?: string
    price: number
    image_url?: string
    dietary_tags?: string[]
    customizations?: MenuCustomization[]
    preparation_time?: number
}

export interface CreateTableInput {
    table_number: string
    capacity: number
    notes?: string
}

export interface CreateOrderInput {
    table_id: string
    staff_id?: string
    items: CreateOrderItemInput[]
    notes?: string
    is_priority?: boolean
}

export interface CreateOrderItemInput {
    menu_item_id: string
    quantity: number
    special_instructions?: string
    customizations?: SelectedCustomization[]
}

// Auth Types

export interface AuthUser {
    id: string
    email: string
    full_name?: string
    avatar_url?: string
}

export interface Session {
    user: AuthUser
    restaurant?: Restaurant
    staff?: Staff
}
