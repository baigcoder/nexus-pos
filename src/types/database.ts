// OrderFlow Database Types
// These types match the Supabase database schema

export type UserRole = 'owner' | 'manager' | 'waiter' | 'kitchen' | 'cashier' | 'delivery' | 'rider'

export type StaffShift = 'morning' | 'evening' | 'night' | 'full_time' | 'part_time'

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'billing'

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled'

export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served'

export type KitchenStatus = 'hold' | 'fired' | 'cooking' | 'plated' | 'served' | 'void_pending' | 'voided'

export type DeliveryStatus = 'pending_dispatch' | 'assigned' | 'picked_up' | 'en_route' | 'arrived' | 'delivered' | 'dispatch_exception' | 'cancelled'

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
    trial_ends_at?: string | null
    plan?: string | null
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
    service_charge_type?: 'percentage' | 'fixed'
    service_charge?: number
    tax_mode?: 'inclusive' | 'exclusive'
    price_rounding?: 'none' | 'up' | 'down' | 'nearest'
    order_prefix?: string
    default_prep_time?: number
    allow_cancellation?: boolean
    receipt_header?: string
    receipt_footer?: string
    receipt_show_info?: boolean
    receipt_show_tax_breakdown?: boolean
    receipt_show_logo?: boolean
    email_notifications?: boolean
    browser_notifications?: boolean
    kitchen_dark_mode?: boolean
    auto_refresh_interval?: 15 | 30 | 60
}

export interface Staff {
    id: string
    restaurant_id: string
    user_id: string | null
    name: string
    email: string | null
    phone: string | null
    role: UserRole
    pin: string | null
    temp_pin: string | null
    needs_setup: boolean
    is_active: boolean
    is_archived: boolean
    invited_at: string | null
    setup_completed_at: string | null
    last_login_at: string | null
    shift: StaffShift | null
    emergency_contact: string | null
    hire_date: string | null
    admin_notes: string | null
    avatar_url: string | null
    created_at: string
    updated_at: string
}

export interface Category {
    id: string
    restaurant_id: string
    name: string
    description: string | null
    image_url: string | null
    icon_key: string | null
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
    cost_price: number
    image_url: string | null
    dietary_tags: string[]
    allergens: string[]
    customizations: MenuCustomization[]
    is_available: boolean
    is_special: boolean
    special_until: string | null
    preparation_time: number | null
    calories: number | null
    display_order: number
    is_active: boolean
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

export interface MenuItemIngredient {
    id: string
    menu_item_id: string
    ingredient_name: string
    quantity: number
    unit: string
    cost_per_unit: number
    created_at: string
}

export interface MenuVersion {
    id: string
    restaurant_id: string
    name: string
    description: string | null
    snapshot: Record<string, unknown>
    is_current: boolean
    created_by: string | null
    created_at: string
}

export interface MenuSchedule {
    id: string
    restaurant_id: string
    category_id: string | null
    menu_item_id: string | null
    day_of_week: number | null
    start_time: string
    end_time: string
    is_active: boolean
    created_at: string
}

export interface Table {
    id: string
    restaurant_id: string
    table_number: string
    capacity: number
    status: TableStatus
    version?: number
    qr_code: string | null
    notes: string | null
    created_at: string
    updated_at: string
}

export interface Order {
    id: string
    restaurant_id: string
    table_id: string | null
    staff_id: string | null
    order_number: number
    status: OrderStatus
    order_type?: 'dine_in' | 'takeaway' | 'delivery'
    subtotal: number
    tax: number
    delivery_fee?: number
    discount: number
    total: number
    notes: string | null
    is_priority: boolean
    customer_name?: string | null
    customer_phone?: string | null
    customer_email?: string | null
    delivery_address?: string | null
    payment_method?: string | null
    payment_status?: string | null
    source?: string | null
    client_order_id?: string | null
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
    menu_item_id: string | null
    quantity: number
    unit_price: number
    subtotal: number
    special_instructions: string | null
    customizations: SelectedCustomization[]
    status: OrderItemStatus
    kitchen_status?: KitchenStatus
    item_name_snapshot?: string
    variant_name_snapshot?: string | null
    unit_cost_snapshot?: number
    tax_rate_snapshot?: number
    tax_amount_snapshot?: number
    created_at: string
    // Joined data
    menu_item?: MenuItem
    modifiers?: OrderItemModifier[]
}

export interface OrderItemModifier {
    id: string
    order_item_id: string
    modifier_option_id?: string | null
    modifier_name_snapshot: string
    price_modifier_snapshot: number
    created_at: string
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
    icon_key?: string
    display_order?: number
    is_active?: boolean
}

export interface CreateMenuItemInput {
    category_id: string
    name: string
    description?: string
    price: number
    cost_price?: number
    image_url?: string
    dietary_tags?: string[]
    allergens?: string[]
    customizations?: MenuCustomization[]
    is_available?: boolean
    is_special?: boolean
    special_until?: string
    preparation_time?: number
    calories?: number
    display_order?: number
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

// Messaging Types

export interface Message {
    id: string
    restaurant_id: string
    sender_id: string
    receiver_id: string | null
    content: string
    message_type: 'direct' | 'broadcast' | 'system'
    is_read: boolean
    created_at: string
    sender?: { name: string; role: string; avatar_url?: string | null }
    receiver?: { name: string; role: string; avatar_url?: string | null }
}

export interface CallLog {
    id: string
    restaurant_id: string
    caller_id: string
    receiver_id: string
    call_type: 'audio' | 'video'
    status: 'initiated' | 'ringing' | 'connected' | 'ended' | 'missed' | 'rejected'
    duration_seconds: number | null
    started_at: string | null
    ended_at: string | null
    created_at: string
    caller?: { name: string; role: string }
    receiver?: { name: string; role: string }
}

export interface Conversation {
    peer_id: string
    peer_name: string
    peer_role: string
    peer_avatar_url: string | null
    peer_phone: string | null
    peer_is_active: boolean
    last_message: string | null
    last_message_at: string | null
    unread_count: number
}

export type CallStatus = 'idle' | 'ringing' | 'connected' | 'ended' | 'missed' | 'rejected'

export interface CallSession {
    callId: string
    peerId: string
    peerName: string
    peerRole: string
    status: CallStatus
    duration: number
    startedAt: Date | null
    localStream: MediaStream | null
    peerConnection: RTCPeerConnection | null
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

// Register, Shifts & Cash Management
export interface CashRegister {
    id: string
    restaurant_id: string
    name: string
    is_active: boolean
    created_at: string
    updated_at: string
}

export type ShiftStatus = 'open' | 'closed' | 'reconciled'

export interface RegisterShift {
    id: string
    restaurant_id: string
    register_id: string
    staff_id: string
    status: ShiftStatus
    opening_float: number
    closing_counted_cash?: number | null
    expected_cash?: number | null
    cash_difference?: number | null
    total_sales_cash: number
    total_sales_card: number
    total_sales_mobile: number
    total_tax_collected: number
    total_refunds: number
    opened_at: string
    closed_at?: string | null
    notes?: string | null
    created_at: string
    updated_at: string
}

export type DrawerMovementType = 'pay_in' | 'pay_out' | 'drop' | 'petty_cash'

export interface CashDrawerMovement {
    id: string
    restaurant_id: string
    shift_id: string
    movement_type: DrawerMovementType
    amount: number
    reason: string
    authorized_by: string
    created_at: string
}

export interface WasteRecord {
    id: string
    restaurant_id: string
    order_id: string
    order_item_id: string
    menu_item_id?: string | null
    item_name: string
    quantity: number
    cost_price: number
    total_cost_wasted: number
    reason: string
    staff_id?: string | null
    created_at: string
}

// Transactional Event Outbox
export interface RestaurantEvent {
    id: number
    restaurant_id: string
    aggregate_type: string
    aggregate_id: string
    event_type: string
    payload: Record<string, any>
    created_at: string
}

// AI Skill & Human-In-The-Loop Action Proposals
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed'
export type ProposalType = 'auto_86_item' | 'flag_cashier_discrepancy' | 'adjust_prep_time' | 'bulk_menu_import' | 'pacing_throttle'

export interface DeliveryAssignment {
    id: string
    restaurant_id: string
    order_id: string
    rider_id?: string | null
    customer_name: string
    customer_phone?: string | null
    delivery_address: string
    status: DeliveryStatus
    cod_amount_collected?: number
    cod_settled?: boolean
    cod_settled_at?: string | null
    created_at: string
    updated_at: string
}

export interface AiActionProposal {
    id: string
    restaurant_id: string
    skill_name: string
    proposal_type: ProposalType
    status: ProposalStatus
    confidence_score: number
    reasoning: string
    proposed_payload: Record<string, any>
    reviewed_by?: string | null
    reviewed_at?: string | null
    created_at: string
}

