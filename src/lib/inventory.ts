import { createClient } from '@/lib/supabase/server'

/**
 * Inventory Management Service
 * Handles stock tracking, ingredient deduction, and low-stock alerts
 */

export interface IngredientUsage {
    ingredient_id: string
    quantity_used: number
}

export interface StockAlert {
    item_id: string
    item_name: string
    current_stock: number
    min_stock: number
    unit: string
    severity: 'low' | 'critical' | 'out'
}

/**
 * Deduct ingredients from stock when order is completed
 */
export async function deductIngredients(
    restaurantId: string,
    menuItemId: string,
    quantity: number
): Promise<{ success: boolean; alerts?: StockAlert[] }> {
    const supabase = await createClient()

    // Get ingredient mappings for this menu item
    const { data: mappings } = await supabase
        .from('menu_item_ingredients')
        .select(`
            ingredient_id,
            quantity_per_item,
            inventory_items (
                id,
                name,
                current_stock,
                min_stock,
                unit
            )
        `)
        .eq('menu_item_id', menuItemId)

    if (!mappings || mappings.length === 0) {
        // No ingredient mappings, skip deduction
        return { success: true }
    }

    const alerts: StockAlert[] = []

    // Deduct each ingredient
    for (const mapping of mappings) {
        const usageAmount = mapping.quantity_per_item * quantity
        const item = mapping.inventory_items as any

        if (!item) continue

        const newStock = Math.max(0, item.current_stock - usageAmount)

        // Update stock
        await supabase
            .from('inventory_items')
            .update({ current_stock: newStock })
            .eq('id', mapping.ingredient_id)

        // Check for low stock alerts
        if (newStock === 0) {
            alerts.push({
                item_id: item.id,
                item_name: item.name,
                current_stock: 0,
                min_stock: item.min_stock,
                unit: item.unit,
                severity: 'out',
            })
        } else if (newStock < item.min_stock * 0.5) {
            alerts.push({
                item_id: item.id,
                item_name: item.name,
                current_stock: newStock,
                min_stock: item.min_stock,
                unit: item.unit,
                severity: 'critical',
            })
        } else if (newStock < item.min_stock) {
            alerts.push({
                item_id: item.id,
                item_name: item.name,
                current_stock: newStock,
                min_stock: item.min_stock,
                unit: item.unit,
                severity: 'low',
            })
        }
    }

    return { success: true, alerts }
}

/**
 * Get all low stock alerts for a restaurant
 */
export async function getLowStockAlerts(restaurantId: string): Promise<StockAlert[]> {
    const supabase = await createClient()

    const { data: items } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)

    if (!items) return []

    return items
        .filter(item => item.current_stock <= item.min_stock)
        .map(item => ({
            item_id: item.id,
            item_name: item.name,
            current_stock: item.current_stock,
            min_stock: item.min_stock,
            unit: item.unit,
            severity: item.current_stock === 0 ? 'out' as const :
                item.current_stock < item.min_stock * 0.5 ? 'critical' as const :
                    'low' as const,
        }))
}

/**
 * Restock an inventory item
 */
export async function restockItem(
    itemId: string,
    quantity: number,
    costPerUnit?: number
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    // Get current stock
    const { data: item, error: fetchError } = await supabase
        .from('inventory_items')
        .select('current_stock')
        .eq('id', itemId)
        .single()

    if (fetchError || !item) {
        return { success: false, error: 'Item not found' }
    }

    const updateData: any = {
        current_stock: item.current_stock + quantity,
        last_restocked: new Date().toISOString(),
    }

    if (costPerUnit !== undefined) {
        updateData.cost_per_unit = costPerUnit
    }

    const { error: updateError } = await supabase
        .from('inventory_items')
        .update(updateData)
        .eq('id', itemId)

    if (updateError) {
        return { success: false, error: updateError.message }
    }

    return { success: true }
}

/**
 * Get inventory value summary
 */
export async function getInventoryValue(restaurantId: string): Promise<{
    totalValue: number
    itemCount: number
    lowStockCount: number
    outOfStockCount: number
}> {
    const supabase = await createClient()

    const { data: items } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)

    if (!items) {
        return { totalValue: 0, itemCount: 0, lowStockCount: 0, outOfStockCount: 0 }
    }

    let totalValue = 0
    let lowStockCount = 0
    let outOfStockCount = 0

    for (const item of items) {
        totalValue += item.current_stock * item.cost_per_unit
        if (item.current_stock === 0) {
            outOfStockCount++
        } else if (item.current_stock < item.min_stock) {
            lowStockCount++
        }
    }

    return {
        totalValue,
        itemCount: items.length,
        lowStockCount,
        outOfStockCount,
    }
}
