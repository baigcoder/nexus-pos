// Extended API functions for all modules
import { createClient } from '@/lib/supabase/client'

// ============================================
// INVENTORY API
// ============================================

export interface InventoryItem {
    id: string
    restaurant_id: string
    name: string
    unit: string
    current_stock: number
    min_stock: number
    cost_per_unit: number
    supplier_name: string | null
    supplier_contact: string | null
    last_restocked: string | null
    is_active: boolean
    created_at: string
}

export async function fetchInventory(restaurantId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('name')

    if (error) throw error
    return data as InventoryItem[]
}

export async function createInventoryItem(restaurantId: string, item: Partial<InventoryItem>) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('inventory')
        .insert({ ...item, restaurant_id: restaurantId })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateInventoryItem(id: string, updates: Partial<InventoryItem>) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('inventory')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function restockItem(id: string, quantity: number) {
    const supabase = createClient()
    const { data: item } = await supabase.from('inventory').select('current_stock').eq('id', id).single()
    const newStock = (item?.current_stock || 0) + quantity

    const { data, error } = await supabase
        .from('inventory')
        .update({ current_stock: newStock, last_restocked: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

// ============================================
// RESERVATIONS API
// ============================================

export interface Reservation {
    id: string
    restaurant_id: string
    table_id: string | null
    customer_name: string
    customer_phone: string | null
    customer_email: string | null
    party_size: number
    reservation_date: string
    reservation_time: string
    duration_minutes: number
    status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show'
    special_requests: string | null
    created_at: string
}

export async function fetchReservations(restaurantId: string, date?: string) {
    const supabase = createClient()
    let query = supabase
        .from('reservations')
        .select('*, table:tables(table_number)')
        .eq('restaurant_id', restaurantId)
        .order('reservation_date', { ascending: true })
        .order('reservation_time', { ascending: true })

    if (date) {
        query = query.eq('reservation_date', date)
    }

    const { data, error } = await query
    if (error) throw error
    return data as Reservation[]
}

export async function createReservation(restaurantId: string, reservation: Partial<Reservation>) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('reservations')
        .insert({ ...reservation, restaurant_id: restaurantId })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateReservationStatus(id: string, status: Reservation['status']) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('reservations')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

// ============================================
// DISCOUNT CODES API
// ============================================

export interface DiscountCode {
    id: string
    restaurant_id: string
    code: string
    description: string | null
    type: 'percentage' | 'fixed'
    value: number
    min_order_amount: number
    max_discount: number | null
    usage_limit: number | null
    times_used: number
    valid_from: string
    valid_until: string | null
    is_active: boolean
    created_at: string
}

export async function fetchDiscountCodes(restaurantId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data as DiscountCode[]
}

export async function createDiscountCode(restaurantId: string, code: Partial<DiscountCode>) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('discount_codes')
        .insert({ ...code, restaurant_id: restaurantId })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function validateDiscountCode(restaurantId: string, code: string, orderTotal: number) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single()

    if (error || !data) return { valid: false, error: 'Invalid code' }

    const discount = data as DiscountCode

    // Check validity period
    const now = new Date()
    if (new Date(discount.valid_from) > now) return { valid: false, error: 'Code not yet active' }
    if (discount.valid_until && new Date(discount.valid_until) < now) return { valid: false, error: 'Code expired' }

    // Check usage limit
    if (discount.usage_limit && discount.times_used >= discount.usage_limit) {
        return { valid: false, error: 'Code usage limit reached' }
    }

    // Check minimum order
    if (orderTotal < discount.min_order_amount) {
        return { valid: false, error: `Minimum order Rs.${discount.min_order_amount} required` }
    }

    // Calculate discount amount
    let discountAmount = discount.type === 'percentage'
        ? (orderTotal * discount.value / 100)
        : discount.value

    if (discount.max_discount && discountAmount > discount.max_discount) {
        discountAmount = discount.max_discount
    }

    return { valid: true, discount, discountAmount }
}

export async function useDiscountCode(id: string) {
    const supabase = createClient()
    const { error } = await supabase.rpc('increment_discount_usage', { discount_id: id })
    if (error) throw error
}

// ============================================
// LOYALTY MEMBERS API
// ============================================

export interface LoyaltyMember {
    id: string
    restaurant_id: string
    name: string
    phone: string
    email: string | null
    points: number
    tier: 'bronze' | 'silver' | 'gold' | 'platinum'
    total_spent: number
    visits: number
    last_visit: string | null
    is_active: boolean
    created_at: string
}

export async function fetchLoyaltyMembers(restaurantId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('loyalty_members')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('points', { ascending: false })

    if (error) throw error
    return data as LoyaltyMember[]
}

export async function createLoyaltyMember(restaurantId: string, member: Partial<LoyaltyMember>) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('loyalty_members')
        .insert({ ...member, restaurant_id: restaurantId })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function addLoyaltyPoints(memberId: string, points: number, spentAmount: number) {
    const supabase = createClient()
    const { data: member } = await supabase.from('loyalty_members').select('*').eq('id', memberId).single()

    if (!member) throw new Error('Member not found')

    const { data, error } = await supabase
        .from('loyalty_members')
        .update({
            points: member.points + points,
            total_spent: member.total_spent + spentAmount,
            visits: member.visits + 1,
            last_visit: new Date().toISOString()
        })
        .eq('id', memberId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function redeemLoyaltyPoints(memberId: string, points: number) {
    const supabase = createClient()
    const { data: member } = await supabase.from('loyalty_members').select('points').eq('id', memberId).single()

    if (!member || member.points < points) throw new Error('Insufficient points')

    const { data, error } = await supabase
        .from('loyalty_members')
        .update({ points: member.points - points })
        .eq('id', memberId)
        .select()
        .single()

    if (error) throw error
    return data
}

// ============================================
// FEEDBACK API
// ============================================

export interface Feedback {
    id: string
    restaurant_id: string
    order_id: string | null
    customer_name: string | null
    customer_email: string | null
    overall_rating: number
    food_rating: number | null
    service_rating: number | null
    ambiance_rating: number | null
    comment: string | null
    waiter_name: string | null
    is_resolved: boolean
    created_at: string
}

export async function fetchFeedback(restaurantId: string, filter?: 'all' | 'positive' | 'negative') {
    const supabase = createClient()
    let query = supabase
        .from('feedback')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

    if (filter === 'positive') {
        query = query.gte('overall_rating', 4)
    } else if (filter === 'negative') {
        query = query.lte('overall_rating', 2)
    }

    const { data, error } = await query
    if (error) throw error
    return data as Feedback[]
}

export async function createFeedback(restaurantId: string, feedback: Partial<Feedback>) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('feedback')
        .insert({ ...feedback, restaurant_id: restaurantId })
        .select()
        .single()

    if (error) throw error
    return data
}

// ============================================
// SHIFTS API
// ============================================

export interface Shift {
    id: string
    restaurant_id: string
    staff_id: string
    shift_date: string
    start_time: string
    end_time: string | null
    break_minutes: number
    status: 'scheduled' | 'active' | 'completed' | 'absent'
    notes: string | null
    created_at: string
    staff?: { name: string; role: string }
}

export async function fetchShifts(restaurantId: string, date: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('shifts')
        .select('*, staff:staff(name, role)')
        .eq('restaurant_id', restaurantId)
        .eq('shift_date', date)
        .order('start_time')

    if (error) throw error
    return data as Shift[]
}

export async function createShift(restaurantId: string, shift: Partial<Shift>) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('shifts')
        .insert({ ...shift, restaurant_id: restaurantId })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function clockIn(shiftId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('shifts')
        .update({ status: 'active', start_time: new Date().toTimeString().slice(0, 5) })
        .eq('id', shiftId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function clockOut(shiftId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('shifts')
        .update({ status: 'completed', end_time: new Date().toTimeString().slice(0, 5) })
        .eq('id', shiftId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function addBreak(shiftId: string, minutes: number = 15) {
    const supabase = createClient()
    const { data: shift } = await supabase.from('shifts').select('break_minutes').eq('id', shiftId).single()

    const { data, error } = await supabase
        .from('shifts')
        .update({ break_minutes: (shift?.break_minutes || 0) + minutes })
        .eq('id', shiftId)
        .select()
        .single()

    if (error) throw error
    return data
}

// ============================================
// EXPENSES API
// ============================================

export interface Expense {
    id: string
    restaurant_id: string
    category: 'ingredients' | 'utilities' | 'salary' | 'supplies' | 'maintenance' | 'other'
    description: string
    amount: number
    vendor: string | null
    expense_date: string
    payment_method: 'cash' | 'card' | 'transfer'
    receipt_url: string | null
    created_at: string
}

export async function fetchExpenses(restaurantId: string, startDate?: string, endDate?: string) {
    const supabase = createClient()
    let query = supabase
        .from('expenses')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('expense_date', { ascending: false })

    if (startDate) query = query.gte('expense_date', startDate)
    if (endDate) query = query.lte('expense_date', endDate)

    const { data, error } = await query
    if (error) throw error
    return data as Expense[]
}

export async function createExpense(restaurantId: string, expense: Partial<Expense>) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('expenses')
        .insert({ ...expense, restaurant_id: restaurantId })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteExpense(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw error
}

// ============================================
// DAILY SPECIALS API
// ============================================

export interface DailySpecial {
    id: string
    restaurant_id: string
    menu_item_id: string
    discount_percentage: number
    special_date: string
    is_active: boolean
    created_at: string
    menu_item?: { name: string; price: number; image_url: string | null }
}

export async function fetchDailySpecials(restaurantId: string, date?: string) {
    const supabase = createClient()
    const targetDate = date || new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('daily_specials')
        .select('*, menu_item:menu_items(name, price, image_url)')
        .eq('restaurant_id', restaurantId)
        .eq('special_date', targetDate)
        .eq('is_active', true)

    if (error) throw error
    return data as DailySpecial[]
}

export async function createDailySpecial(restaurantId: string, special: Partial<DailySpecial>) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('daily_specials')
        .insert({ ...special, restaurant_id: restaurantId })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function removeDailySpecial(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('daily_specials').delete().eq('id', id)
    if (error) throw error
}

// ============================================
// STAFF API
// ============================================

export interface StaffMember {
    id: string
    restaurant_id: string
    user_id: string | null
    name: string
    email: string | null
    pin: string | null
    role: 'owner' | 'manager' | 'waiter' | 'kitchen' | 'cashier'
    is_active: boolean
    created_at: string
}

export async function fetchStaff(restaurantId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name')

    if (error) throw error
    return data as StaffMember[]
}

export async function createStaffMember(restaurantId: string, staff: Partial<StaffMember>) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('staff')
        .insert({ ...staff, restaurant_id: restaurantId })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateStaffMember(id: string, updates: Partial<StaffMember>) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('staff')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteStaffMember(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('staff').delete().eq('id', id)
    if (error) throw error
}

// ============================================
// REPORTS API
// ============================================

export async function fetchDailyReport(restaurantId: string, date: string) {
    const supabase = createClient()

    // Try to get cached report first
    const { data: cached } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('report_date', date)
        .single()

    if (cached) return cached

    // Generate report from orders
    const { data: orders } = await supabase
        .from('orders')
        .select('*, items:order_items(*, menu_item:menu_items(name))')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', `${date}T00:00:00`)
        .lt('created_at', `${date}T23:59:59`)
        .eq('status', 'paid')

    if (!orders) return null

    const report = {
        total_orders: orders.length,
        total_revenue: orders.reduce((sum, o) => sum + o.total, 0),
        total_tax: orders.reduce((sum, o) => sum + o.tax, 0),
        total_discounts: orders.reduce((sum, o) => sum + o.discount, 0),
        avg_order_value: orders.length > 0 ? orders.reduce((sum, o) => sum + o.total, 0) / orders.length : 0
    }

    return report
}

export async function fetchRevenueByDateRange(restaurantId: string, startDate: string, endDate: string) {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('orders')
        .select('created_at, total')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('status', 'paid')

    if (error) throw error
    return data
}
