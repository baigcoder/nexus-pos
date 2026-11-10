import { createAdminClient } from '@/lib/supabase/admin'

export interface StockAlert {
    item_id: string
    item_name: string
    current_stock: number
    min_stock: number
    unit: string
    severity: 'low' | 'critical' | 'out'
}

interface InventoryRow {
    id: string
    name: string
    current_stock: number
    min_stock: number
    unit: string
    cost_per_unit?: number
}

function toAlert(item: InventoryRow, stock: number): StockAlert | null {
    if (stock === 0) {
        return { item_id: item.id, item_name: item.name, current_stock: 0, min_stock: item.min_stock, unit: item.unit, severity: 'out' }
    }
    if (stock < item.min_stock * 0.5) {
        return { item_id: item.id, item_name: item.name, current_stock: stock, min_stock: item.min_stock, unit: item.unit, severity: 'critical' }
    }
    if (stock <= item.min_stock) {
        return { item_id: item.id, item_name: item.name, current_stock: stock, min_stock: item.min_stock, unit: item.unit, severity: 'low' }
    }
    return null
}

export async function deductIngredients(
    restaurantId: string,
    menuItemId: string,
    quantity: number
): Promise<{ success: boolean; alerts?: StockAlert[] }> {
    const supabase = createAdminClient()

    const { data: mappings } = await supabase
        .from('menu_item_ingredients')
        .select('ingredient_id, quantity_per_item')
        .eq('menu_item_id', menuItemId)

    if (!mappings || mappings.length === 0) {
        return { success: true }
    }

    const alerts: StockAlert[] = []

    for (const mapping of mappings) {
        const { data: item } = await supabase
            .from('inventory')
            .select('id, name, current_stock, min_stock, unit')
            .eq('id', mapping.ingredient_id)
            .eq('restaurant_id', restaurantId)
            .maybeSingle()

        if (!item) continue

        const usageAmount = Number(mapping.quantity_per_item) * quantity
        const newStock = Math.max(0, Number(item.current_stock) - usageAmount)

        await supabase
            .from('inventory')
            .update({ current_stock: newStock })
            .eq('id', mapping.ingredient_id)
            .eq('restaurant_id', restaurantId)

        const alert = toAlert(item, newStock)
        if (alert) alerts.push(alert)
    }

    return { success: true, alerts }
}

export async function deductOrderIngredients(restaurantId: string, orderId: string): Promise<void> {
    const supabase = createAdminClient()
    const { data: items } = await supabase
        .from('order_items')
        .select('menu_item_id, quantity')
        .eq('order_id', orderId)

    if (!items) return

    for (const item of items) {
        if (!item.menu_item_id || !item.quantity) continue
        await deductIngredients(restaurantId, item.menu_item_id, Number(item.quantity))
    }
}

export async function getLowStockAlerts(restaurantId: string): Promise<StockAlert[]> {
    const supabase = createAdminClient()
    const { data: items } = await supabase
        .from('inventory')
        .select('id, name, current_stock, min_stock, unit')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)

    if (!items) return []

    return items
        .map((item) => toAlert(item, Number(item.current_stock)))
        .filter((alert): alert is StockAlert => Boolean(alert))
}
