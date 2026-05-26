import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireManagerOrOwner } from '@/lib/api-auth'

const REPORT_TYPE_MAP: Record<string, 'daily' | 'weekly' | 'monthly'> = {
    day: 'daily',
    daily: 'daily',
    week: 'weekly',
    weekly: 'weekly',
    month: 'monthly',
    monthly: 'monthly',
}

function normalizeReportType(type: unknown) {
    if (typeof type !== 'string') return null
    return REPORT_TYPE_MAP[type.toLowerCase()] || null
}

/**
 * Auto-generate reports: daily, weekly, monthly
 * Called by cron job or manually by owner
 */
export async function POST(request: NextRequest) {
    try {
        const { auth, response } = await requireManagerOrOwner()(request)
        if (response) return response

        const { restaurantId, type, date } = await request.json()

        const reportType = normalizeReportType(type)
        const targetRestaurantId = restaurantId || auth.restaurantId

        if (!targetRestaurantId || !reportType) {
            return NextResponse.json({
                success: false,
                error: 'restaurantId and valid type required',
                acceptedTypes: ['day', 'week', 'month', 'daily', 'weekly', 'monthly'],
            }, { status: 400 })
        }

        if (targetRestaurantId !== auth.restaurantId && auth.role !== 'owner') {
            return NextResponse.json({ success: false, error: 'Cannot generate reports for another restaurant' }, { status: 403 })
        }

        const supabase = createAdminClient()

        // Determine date range based on type
        let startDate: Date
        let endDate: Date = new Date()
        endDate.setHours(23, 59, 59, 999)

        switch (reportType) {
            case 'daily':
                startDate = new Date(date || new Date())
                startDate.setHours(0, 0, 0, 0)
                break
            case 'weekly':
                const today = new Date()
                const dayOfWeek = today.getDay()
                startDate = new Date(today)
                startDate.setDate(today.getDate() - dayOfWeek)
                startDate.setHours(0, 0, 0, 0)
                endDate = new Date(today)
                endDate.setHours(23, 59, 59, 999)
                break
            case 'monthly':
                startDate = new Date(date || new Date())
                startDate.setDate(1)
                startDate.setHours(0, 0, 0, 0)
                endDate = new Date(startDate)
                endDate.setMonth(endDate.getMonth() + 1)
                endDate.setDate(0)
                endDate.setHours(23, 59, 59, 999)
                break
            default:
                return NextResponse.json({ success: false, error: 'Invalid type. Use: daily, weekly, monthly' }, { status: 400 })
        }

        // Fetch orders for the period
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select(`
                id,
                total,
                subtotal,
                tax,
                discount,
                created_at,
                status,
                staff_id,
                order_items (
                    id,
                    quantity,
                    subtotal,
                    menu_item:menu_items(name)
                )
            `)
            .eq('restaurant_id', targetRestaurantId)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())

        if (ordersError) {
            console.error('Orders error:', ordersError)
            return NextResponse.json({ error: ordersError.message }, { status: 500 })
        }

        const completedOrders = (orders || []).filter((o: any) =>
            ['paid', 'served', 'completed'].includes(o.status)
        )

        const totalOrders = completedOrders.length
        const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0)
        const totalTax = completedOrders.reduce((sum: number, o: any) => sum + Number(o.tax || 0), 0)
        const totalDiscounts = completedOrders.reduce((sum: number, o: any) => sum + Number(o.discount || 0), 0)
        const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

        // Top items
        const itemStats: Record<string, { name: string; quantity: number; revenue: number }> = {}
        completedOrders.forEach((order: any) => {
            (order.order_items || []).forEach((item: any) => {
                const name = item.menu_item?.name || 'Unknown'
                if (!itemStats[name]) {
                    itemStats[name] = { name, quantity: 0, revenue: 0 }
                }
                itemStats[name].quantity += item.quantity || 0
                itemStats[name].revenue += item.subtotal || 0
            })
        })

        const topItems = Object.values(itemStats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10)

        // Hourly sales
        const hourlySales: Record<number, number> = {}
        completedOrders.forEach((order: any) => {
            const hour = new Date(order.created_at).getHours()
            hourlySales[hour] = (hourlySales[hour] || 0) + Number(order.total || 0)
        })

        // Staff performance for the period
        const staffStats: Record<string, { orders: number; revenue: number }> = {}
        completedOrders.forEach((order: any) => {
            if (order.staff_id) {
                if (!staffStats[order.staff_id]) {
                    staffStats[order.staff_id] = { orders: 0, revenue: 0 }
                }
                staffStats[order.staff_id].orders++
                staffStats[order.staff_id].revenue += Number(order.total || 0)
            }
        })

        // Insert or update daily report
        const reportDate = type === 'daily'
            ? new Date(startDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]

        const reportPayload = {
            restaurant_id: targetRestaurantId,
            report_date: reportDate,
            report_type: reportType,
            total_orders: totalOrders,
            total_revenue: totalRevenue,
            total_tax: totalTax,
            total_discounts: totalDiscounts,
            avg_order_value: avgOrderValue,
            top_items: topItems,
            top_selling_items: topItems,
            hourly_sales: hourlySales,
            staff_stats: staffStats,
            generated_at: new Date().toISOString()
        }

        const { data: savedReport, error: saveError } = await supabase
            .from('daily_reports')
            .upsert(reportPayload, {
                onConflict: 'restaurant_id,report_date'
            })
            .select()
            .single()

        let saved = !!savedReport && !saveError
        if (saveError) {
            console.error('Save report error:', saveError)
            const { data: fallbackSaved, error: fallbackError } = await supabase
                .from('daily_reports')
                .upsert({
                    restaurant_id: targetRestaurantId,
                    report_date: reportDate,
                    total_orders: totalOrders,
                    total_revenue: totalRevenue,
                    total_tax: totalTax,
                    total_discounts: totalDiscounts,
                    avg_order_value: avgOrderValue,
                    top_selling_items: topItems,
                    payment_breakdown: {},
                }, {
                    onConflict: 'restaurant_id,report_date'
                })
                .select()
                .single()

            if (fallbackError) console.error('Fallback save report error:', fallbackError)
            saved = !!fallbackSaved && !fallbackError
        }

        return NextResponse.json({
            success: true,
            report: {
                type: reportType,
                date: reportDate,
                totalOrders,
                totalRevenue,
                avgOrderValue,
                topItems: topItems.slice(0, 5),
                staffStats: Object.entries(staffStats).slice(0, 5),
                hourlySales
            },
            saved
        })

    } catch (error) {
        console.error('Report generation error:', error)
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
    }
}

/**
 * Get existing reports
 */
export async function GET(request: NextRequest) {
    try {
        const { auth, response } = await requireManagerOrOwner()(request)
        if (response) return response

        const { searchParams } = new URL(request.url)
        const restaurantId = searchParams.get('restaurant_id')
        const type = normalizeReportType(searchParams.get('type') || 'daily') || 'daily'
        const startDate = searchParams.get('start')
        const endDate = searchParams.get('end')

        const targetRestaurantId = restaurantId || auth.restaurantId

        if (!targetRestaurantId) {
            return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
        }

        if (targetRestaurantId !== auth.restaurantId && auth.role !== 'owner') {
            return NextResponse.json({ success: false, error: 'Cannot access another restaurant reports' }, { status: 403 })
        }

        const supabase = createAdminClient()

        let query = supabase
            .from('daily_reports')
            .select('*')
            .eq('restaurant_id', targetRestaurantId)
            .order('report_date', { ascending: false })

        if (startDate) {
            query = query.gte('report_date', startDate)
        }
        if (endDate) {
            query = query.lte('report_date', endDate)
        }

        const { data: reports, error } = await query.limit(90)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, reports })

    } catch (error) {
        console.error('Get reports error:', error)
        return NextResponse.json({ error: 'Failed to get reports' }, { status: 500 })
    }
}
