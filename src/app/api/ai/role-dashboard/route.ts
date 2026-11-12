import { NextRequest, NextResponse } from 'next/server'
import { STAFF_SESSION_COOKIE, verifyStaffSessionToken } from '@/lib/auth/staff-session'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY || ''
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'liquid/lfm-2.5-1.2b-instruct:free'

interface WaiterTable {
    id: string
    table_number: number
    status: string
    current_order_id?: string
    current_order_total?: number
    wait_time_minutes?: number
    waiter_name?: string
}

interface KitchenOrder {
    id: string
    order_id: string
    items: string[]
    priority: string
    status: string
    received_at: string
    prep_time_seconds: number
    assigned_to?: string
    table_number?: number
}

interface CashierTransaction {
    id: string
    order_id: string
    amount: number
    payment_method: string
    status: string
    staff_name: string
    created_at: string
}

interface DeliveryOrder {
    id: string
    order_id: string
    customer_address: string
    status: string
    rider_name?: string
    estimated_minutes: number
    distance_km: number
    pickup_time?: string
}

// AI-powered real-time analysis
async function getAIAnalysis(type: string, data: any): Promise<any> {
    if (!OPENROUTER_API_KEY) return null

    const prompts: Record<string, { system: string; user: string }> = {
        waiter: {
            system: `You are a Waiter Supervisor AI. Analyze table status and suggest actions.
Pakistani restaurant context: rush hours are 12-2pm and 7-10pm.
Suggest: table rotations, pending orders to check, customers who may need attention.`,
            user: `Tables status: ${JSON.stringify(data)}. What needs immediate attention?`
        },
        kitchen: {
            system: `You are a Kitchen Manager AI. Analyze order queue and prep times.
Alert if orders are delayed (>15min), suggest priority reordering.
Pakistani dishes: Biryani (20min), Karahi (15min), Naan (5min).`,
            user: `Order queue: ${JSON.stringify(data)}. Any delays or issues?`
        },
        cashier: {
            system: `You are a Cashier Supervisor AI. Analyze transactions and cash flow.
Alert on unusual patterns, suggest reconciliation actions.`,
            user: `Transactions today: ${JSON.stringify(data)}. Any concerns?`
        },
        delivery: {
            system: `You are a Delivery Manager AI. Optimize delivery routes and timing.
Consider traffic patterns, distance, customer location.`,
            user: `Deliveries: ${JSON.stringify(data)}. Routing suggestions?`
        }
    }

    const prompt = prompts[type]
    if (!prompt) return null

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                'X-Title': 'OrderFlow POS'
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    { role: 'system', content: prompt.system },
                    { role: 'user', content: prompt.user }
                ],
                temperature: 0.2,
                max_tokens: 256
            })
        })

        if (response.ok) {
            const result = await response.json()
            return { response: result.choices?.[0]?.message?.content, timestamp: new Date().toISOString() }
        }
    } catch (err) {
        console.error('AI analysis error:', err)
    }

    return null
}

// GET - Fetch role-specific real-time data
export async function GET(request: NextRequest) {
    try {
        // Support both cookie auth and header-based staff auth
        const staffId = verifyStaffSessionToken(request.cookies.get(STAFF_SESSION_COOKIE)?.value)
        const targetRestaurantIdHeader = request.headers.get('x-restaurant-id')

        let supabase = await createClient()
        let user: any = null
        let staffData: any = null

        // Try cookie auth first
        const { data: cookieUser } = await supabase.auth.getUser()
        user = cookieUser?.user

        // If no cookie auth, use header-based staff auth
        if (!user && staffId) {
            const adminClient = createAdminClient()
            const { data: staffInfo } = await adminClient
                .from('staff')
                .select('id, role, restaurant_id, name')
                .eq('id', staffId)
                .eq('is_active', true)
                .single()

            if (!staffInfo) {
                return NextResponse.json({ error: 'Staff not found' }, { status: 401 })
            }

            user = { id: staffInfo.id }
            staffData = staffInfo
        }

        // If still no user, return empty data
        if (!user) {
            return NextResponse.json({
                role: 'unknown',
                targetRestaurantId: null,
                lastUpdated: new Date().toISOString(),
                waiter: { tables: [], myTables: [], myActiveOrders: 0, pendingBills: 0, availableTables: 0 },
                kitchen: { queue: [], pendingCount: 0, avgPrepTimeMinutes: 0, readyToServe: 0, preparing: 0 },
                cashier: { todayTransactions: [], pendingPayments: [], summary: { totalSales: 0, cashSales: 0, cardSales: 0, refunds: 0, transactionCount: 0, avgTransaction: 0 } },
                delivery: { activeDeliveries: [], myDeliveries: [], pendingPickup: 0, inTransit: 0 },
                message: 'No authentication'
            })
        }

        // Get staff role and restaurant
        if (!staffData) {
            const adminClient = createAdminClient()
            // First try to find by user_id (for owner login)
            const result = await adminClient
                .from('staff')
                .select('id, role, restaurant_id, name')
                .eq('user_id', user.id)
                .single()

            if (!result.data) {
                // If not found by user_id, try by id (for staff PIN login)
                const byIdResult = await adminClient
                    .from('staff')
                    .select('id, role, restaurant_id, name')
                    .eq('id', user.id)
                    .single()
                staffData = byIdResult.data
            } else {
                staffData = result.data
            }
        }

        // Only an owner may switch restaurants via header, and only to one they own.
        let targetRestaurantId = staffData?.restaurant_id
        if (targetRestaurantIdHeader && targetRestaurantIdHeader !== targetRestaurantId && cookieUser?.user) {
            const { data: owned } = await createAdminClient()
                .from('restaurants')
                .select('id')
                .eq('id', targetRestaurantIdHeader)
                .eq('owner_id', cookieUser.user.id)
                .maybeSingle()
            if (owned) targetRestaurantId = owned.id
        }
        const userRole = staffData?.role
        const staffIdForQuery = staffData?.id

        if (!targetRestaurantId) {
            return NextResponse.json({ error: 'No restaurant found' }, { status: 404 })
        }

        const role = request.nextUrl.searchParams.get('role') || userRole || 'owner'
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        let responseData: any = { role, targetRestaurantId: targetRestaurantId, lastUpdated: new Date().toISOString() }

        // WAITER SPECIFIC DATA
        if (role === 'waiter' || role === 'owner' || role === 'manager') {
            // Get tables with current orders
            const { data: tables } = await supabase
                .from('tables')
                .select('*')
                .eq('restaurant_id', targetRestaurantId)

            const { data: activeOrders } = await supabase
                .from('orders')
                .select('id, table_id, total, status, created_at')
                .eq('restaurant_id', targetRestaurantId)
                .not('status', 'in', '("paid","cancelled")')

            const waiterTables: WaiterTable[] = (tables || []).map(t => {
                const order = (activeOrders || []).find(o => o.table_id === t.id)
                const orderTime = order ? new Date(order.created_at).getTime() : 0
                const waitTime = orderTime ? Math.round((Date.now() - orderTime) / 60000) : 0

                return {
                    id: t.id,
                    table_number: t.table_number,
                    status: t.status,
                    current_order_id: order?.id,
                    current_order_total: order?.total,
                    wait_time_minutes: waitTime > 0 ? waitTime : undefined
                }
            })

            // Get waiter's assigned orders
            const { data: myOrders } = await supabase
                .from('orders')
                .select('*, table:tables(table_number)')
                .eq('restaurant_id', targetRestaurantId)
                .eq('staff_id', staffIdForQuery)
                .gte('created_at', today.toISOString())
                .not('status', 'in', '("paid","cancelled")')

            // My tables (tables with my orders)
            const myTableIds = (myOrders || []).map(o => o.table_id).filter(Boolean)
            const myTables = waiterTables.filter(t => myTableIds.includes(t.id))

            // Get pending bills
            const { data: pendingBills } = await supabase
                .from('orders')
                .select('id, total, table:tables(table_number)')
                .eq('restaurant_id', targetRestaurantId)
                .eq('status', 'served')

            responseData.waiter = {
                tables: waiterTables,
                myTables,
                myActiveOrders: myOrders?.length || 0,
                pendingBills: pendingBills?.length || 0,
                availableTables: waiterTables.filter(t => t.status === 'available').length
            }

            // AI analysis for waiter
            const waiterAI = await getAIAnalysis('waiter', waiterTables)
            if (waiterAI) responseData.waiter.aiSuggestion = waiterAI
        }

        // KITCHEN SPECIFIC DATA
        if (role === 'kitchen' || role === 'owner' || role === 'manager') {
            // Get kitchen queue
            const { data: kitchenQueue } = await supabase
                .from('kitchen_order_queue')
                .select('*')
                .eq('restaurant_id', targetRestaurantId)
                .not('status', 'in', '("served")')
                .order('priority', { ascending: false })
                .order('received_at', { ascending: true })

            // Get pending orders without queue entry
            const queueOrderIds = (kitchenQueue || []).map((k: any) => k.order_id)
            let pendingOrders: any[] = []
            if (queueOrderIds.length > 0) {
                const { data: pendingData } = await supabase
                    .from('orders')
                    .select('id, status, created_at, table:tables(table_number)')
                    .eq('restaurant_id', targetRestaurantId)
                    .eq('status', 'pending')
                    .not('id', 'in', `(${queueOrderIds.join(',')})`)
                pendingOrders = pendingData || []
            } else {
                const { data: pendingData } = await supabase
                    .from('orders')
                    .select('id, status, created_at, table:tables(table_number)')
                    .eq('restaurant_id', targetRestaurantId)
                    .eq('status', 'pending')
                pendingOrders = pendingData || []
            }

            // Get order items
            const allOrderIds = [
                ...(kitchenQueue || []).map(k => k.order_id),
                ...(pendingOrders || []).map(o => o.id)
            ]

            let orderItems: any[] = []
            if (allOrderIds.length > 0) {
                const { data: items } = await supabase
                    .from('order_items')
                    .select('order_id, quantity, notes, menu_item:menu_items(name)')
                    .in('order_id', allOrderIds)

                orderItems = items || []
            }

            const kitchenOrders: KitchenOrder[] = [
                ...(kitchenQueue || []).map(k => {
                    const items = orderItems
                        .filter(i => i.order_id === k.order_id)
                        .map(i => `${i.menu_item?.name || 'Item'} x${i.quantity}`)
                    const table = pendingOrders?.find(o => o.id === k.order_id)?.table ||
                        kitchenQueue?.find(kq => kq.order_id === k.order_id)

                    return {
                        id: k.id,
                        order_id: k.order_id,
                        items,
                        priority: k.priority,
                        status: k.status,
                        received_at: k.received_at,
                        prep_time_seconds: k.prep_time_seconds || 0,
                        assigned_to: k.assigned_to,
                        table_number: (table as any)?.table_number
                    }
                })
            ]

            // Calculate average prep time
            const { data: completedToday } = await supabase
                .from('kitchen_order_queue')
                .select('actual_prep_time_seconds')
                .eq('restaurant_id', targetRestaurantId)
                .eq('status', 'served')
                .gte('created_at', today.toISOString())

            const avgPrepTime = completedToday && completedToday.length > 0
                ? Math.round(completedToday.reduce((sum, o) => sum + (o.actual_prep_time_seconds || 0), 0) / completedToday.length / 60)
                : 0

            responseData.kitchen = {
                queue: kitchenOrders,
                pendingCount: pendingOrders?.length || 0,
                avgPrepTimeMinutes: avgPrepTime,
                readyToServe: kitchenOrders.filter(o => o.status === 'ready').length,
                preparing: kitchenOrders.filter(o => o.status === 'preparing').length
            }

            // AI analysis for kitchen
            const kitchenAI = await getAIAnalysis('kitchen', kitchenOrders)
            if (kitchenAI) responseData.kitchen.aiSuggestion = kitchenAI
        }

        // CASHIER SPECIFIC DATA
        if (role === 'cashier' || role === 'owner' || role === 'manager') {
            const { data: transactions } = await supabase
                .from('cashier_transactions')
                .select('*')
                .eq('restaurant_id', targetRestaurantId)
                .gte('created_at', today.toISOString())
                .order('created_at', { ascending: false })
                .limit(50)

            const { data: pendingPayments } = await supabase
                .from('orders')
                .select('id, total, table:tables(table_number), staff:staff(name)')
                .eq('restaurant_id', targetRestaurantId)
                .eq('status', 'served')

            const totalCash = (transactions || [])
                .filter(t => t.payment_method === 'cash' && t.transaction_type === 'sale')
                .reduce((sum, t) => sum + Number(t.amount), 0)

            const totalCard = (transactions || [])
                .filter(t => t.payment_method === 'card' && t.transaction_type === 'sale')
                .reduce((sum, t) => sum + Number(t.amount), 0)

            const totalRefunds = (transactions || [])
                .filter(t => t.transaction_type === 'refund')
                .reduce((sum, t) => sum + Number(t.amount), 0)

            responseData.cashier = {
                todayTransactions: transactions || [],
                pendingPayments: pendingPayments || [],
                summary: {
                    totalSales: (transactions || [])
                        .filter(t => t.transaction_type === 'sale')
                        .reduce((sum, t) => sum + Number(t.amount), 0),
                    cashSales: totalCash,
                    cardSales: totalCard,
                    refunds: totalRefunds,
                    transactionCount: (transactions || []).filter(t => t.transaction_type === 'sale').length,
                    avgTransaction: transactions && transactions.length > 0
                        ? Math.round(((transactions || []).filter(t => t.transaction_type === 'sale').reduce((sum, t) => sum + Number(t.amount), 0)) /
                            (transactions || []).filter(t => t.transaction_type === 'sale').length)
                        : 0
                }
            }

            // AI analysis for cashier
            const cashierAI = await getAIAnalysis('cashier', transactions)
            if (cashierAI) responseData.cashier.aiSuggestion = cashierAI
        }

        // DELIVERY SPECIFIC DATA
        if (role === 'delivery' || role === 'owner' || role === 'manager') {
            const { data: deliveries } = await supabase
                .from('delivery_tracking')
                .select('*')
                .eq('restaurant_id', targetRestaurantId)
                .not('status', 'in', '("delivered","failed")')
                .order('status', { ascending: true })

            // Get rider's own deliveries
            const { data: myDeliveries } = await supabase
                .from('delivery_tracking')
                .select('*')
                .eq('rider_id', staffIdForQuery)
                .not('status', 'in', '("delivered","failed")')

            const { data: orders } = await supabase
                .from('orders')
                .select('id, total, customer_name, customer_phone, delivery_address')
                .eq('restaurant_id', targetRestaurantId)
                .eq('order_type', 'delivery')
                .not('status', 'in', '("paid","cancelled")')

            const deliveryOrders: DeliveryOrder[] = (deliveries || []).map(d => {
                const order = (orders || []).find(o => o.id === d.order_id)
                return {
                    id: d.id,
                    order_id: d.order_id,
                    customer_address: order?.delivery_address || 'No address',
                    status: d.status,
                    rider_name: d.rider_id ? 'Assigned' : 'Unassigned',
                    estimated_minutes: d.estimated_minutes,
                    distance_km: d.distance_km,
                    pickup_time: d.pickup_time
                }
            })

            responseData.delivery = {
                activeDeliveries: deliveryOrders,
                myDeliveries: myDeliveries || [],
                pendingPickup: deliveryOrders.filter(d => d.status === 'ready').length,
                inTransit: deliveryOrders.filter(d => d.status === 'in_transit').length,
                availableRiders: 0 // Would query staff with role='delivery'
            }

            // AI analysis for delivery
            const deliveryAI = await getAIAnalysis('delivery', deliveryOrders)
            if (deliveryAI) responseData.delivery.aiSuggestion = deliveryAI
        }

        // MANAGER OVERVIEW
        if (role === 'manager' || role === 'owner') {
            // Staff alerts
            const { data: alerts } = await supabase
                .from('staff_alerts')
                .select('*')
                .eq('restaurant_id', targetRestaurantId)
                .eq('is_read', false)
                .order('priority', { ascending: false })
                .limit(10)

            // Recent activity
            const { data: recentActivity } = await supabase
                .from('staff_activity_logs')
                .select('*')
                .eq('restaurant_id', targetRestaurantId)
                .order('created_at', { ascending: false })
                .limit(20)

            responseData.manager = {
                alerts: alerts || [],
                recentActivity: recentActivity || [],
                alertCount: (alerts || []).filter(a => !a.is_resolved).length
            }
        }

        // OWNER COMPREHENSIVE VIEW
        if (role === 'owner') {
            // Staff summary
            const { data: allStaff } = await supabase
                .from('staff')
                .select('id, name, role, is_active')
                .eq('restaurant_id', targetRestaurantId)

            const { data: todayMetrics } = await supabase
                .from('staff_metrics')
                .select('*')
                .eq('date', today.toISOString().split('T')[0])

            responseData.owner = {
                staffCount: allStaff?.length || 0,
                activeStaff: allStaff?.filter(s => s.is_active).length || 0,
                staffByRole: allStaff?.reduce((acc, s) => {
                    acc[s.role] = (acc[s.role] || 0) + 1
                    return acc
                }, {} as Record<string, number>) || {},
                todayStaffMetrics: todayMetrics || [],
                aiMonitoringEnabled: !!OPENROUTER_API_KEY
            }
        }

        return NextResponse.json(responseData)
    } catch (err) {
        console.error('Role dashboard API error:', err)
        return NextResponse.json({ error: 'Failed to fetch role data' }, { status: 500 })
    }
}
