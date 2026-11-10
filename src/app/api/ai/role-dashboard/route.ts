import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedStaff } from '@/lib/api-auth'

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
        const auth = await getAuthenticatedStaff(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const role = auth.role
        const requestedRole = request.nextUrl.searchParams.get('role')
        const isDeliveryAlias = role === 'rider' && requestedRole === 'delivery'
        if (requestedRole !== null && requestedRole !== role && !isDeliveryAlias) {
            return NextResponse.json({ error: 'Access denied for this dashboard role' }, { status: 403 })
        }
        const targetRestaurantId = auth.restaurantId
        const staffIdForQuery = auth.staffId
        const supabase = createAdminClient()

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

        // Delivery workers only see their assignments. The provider receives aggregate data.
        if (role === 'delivery' || role === 'rider' || role === 'owner' || role === 'manager') {
            const isRider = role === 'delivery' || role === 'rider'
            let query = supabase.from('delivery_assignments')
                .select('id, order_id, rider_id, delivery_address, status, estimated_minutes, distance_km, actual_pickup_time, order:orders!inner(restaurant_id,status)')
                .eq('restaurant_id', targetRestaurantId)
                .eq('order.restaurant_id', targetRestaurantId)
                .not('status', 'in', '(delivered,cancelled,dispatch_exception)')
                .order('created_at', { ascending: false })
                .limit(100)
            if (isRider) query = query.eq('rider_id', staffIdForQuery)
            const { data: deliveries, error: deliveryError } = await query
            if (deliveryError) throw deliveryError

            const deliveryOrders: DeliveryOrder[] = (deliveries ?? []).map(assignment => {
                const order = Array.isArray(assignment.order) ? assignment.order[0] : assignment.order
                return {
                    id: assignment.id,
                    order_id: assignment.order_id,
                    customer_address: assignment.delivery_address || 'No address',
                    status: assignment.status === 'assigned' && order?.status === 'ready' ? 'ready'
                        : ['en_route', 'arrived'].includes(assignment.status) ? 'in_transit' : assignment.status,
                    rider_name: assignment.rider_id ? 'Assigned' : 'Unassigned',
                    estimated_minutes: assignment.estimated_minutes,
                    distance_km: assignment.distance_km,
                    pickup_time: assignment.actual_pickup_time,
                }
            })
            const pendingPickup = deliveryOrders.filter(delivery => delivery.status === 'ready').length
            const inTransit = deliveryOrders.filter(delivery => delivery.status === 'in_transit').length

            responseData.delivery = {
                activeDeliveries: deliveryOrders,
                myDeliveries: deliveryOrders.filter((_, index) => deliveries?.[index].rider_id === staffIdForQuery),
                pendingPickup,
                inTransit,
                availableRiders: 0,
            }

            const deliveryAI = await getAIAnalysis('delivery', {
                active: deliveryOrders.length, pendingPickup, inTransit,
            })
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
