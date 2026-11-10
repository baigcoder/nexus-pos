import { test, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import {
    createInMemoryDatabase,
    simulateCreateOrderAtomic,
} from './test-helpers.ts'

describe('Pillar A: Immutable Financial & Catalog Snapshots', () => {
    it('should freeze item name, cost, tax, and modifier snapshots at purchase time', () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()
        const menuItemId = crypto.randomUUID()
        const tableId = crypto.randomUUID()

        db.restaurants.set(restaurantId, {
            id: restaurantId,
            name: 'Artisan Bistro',
            tax_rate: 16.0,
            currency: 'PKR',
        })

        db.tables.set(tableId, {
            id: tableId,
            restaurant_id: restaurantId,
            table_number: 'T-01',
            status: 'available',
            version: 1,
        })

        db.menu_items.set(menuItemId, {
            id: menuItemId,
            restaurant_id: restaurantId,
            name: 'Wagyu Smash Burger',
            price: 1200,
            cost_price: 450,
            is_available: true,
        })

        const result = simulateCreateOrderAtomic(db, {
            restaurant_id: restaurantId,
            table_id: tableId,
            items: [
                {
                    menu_item_id: menuItemId,
                    quantity: 2,
                    modifiers: [
                        { name: 'Extra Cheddar', price_modifier: 150 },
                        { name: 'Truffle Mayo', price_modifier: 100 },
                    ],
                },
            ],
        })

        assert.equal(result.success, true)
        assert.ok(result.order)
        const order = result.order

        // Check calculations:
        // Base price: 1200 + 150 + 100 = 1450
        // Quantity 2: 1450 * 2 = 2900
        // Tax 16%: 2900 * 0.16 = 464
        // Total: 3364
        assert.equal(order.subtotal, 2900)
        assert.equal(order.tax, 464)
        assert.equal(order.total, 3364)

        const item = order.items[0]
        assert.equal(item.item_name_snapshot, 'Wagyu Smash Burger')
        assert.equal(item.unit_cost_snapshot, 450)
        assert.equal(item.tax_rate_snapshot, 16.0)
        assert.equal(item.tax_amount_snapshot, 464)
        assert.equal(item.modifiers.length, 2)
        assert.equal(item.modifiers[0].modifier_name_snapshot, 'Extra Cheddar')
        assert.equal(item.modifiers[0].price_modifier_snapshot, 150)
    })

    it('should preserve order history and totals when a menu item is permanently deleted (ON DELETE SET NULL)', () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()
        const menuItemId = crypto.randomUUID()
        const tableId = crypto.randomUUID()

        db.restaurants.set(restaurantId, { id: restaurantId, tax_rate: 10 })
        db.tables.set(tableId, { id: tableId, restaurant_id: restaurantId, status: 'available' })
        db.menu_items.set(menuItemId, {
            id: menuItemId,
            restaurant_id: restaurantId,
            name: 'Seasonal Truffle Risotto',
            price: 2500,
            cost_price: 900,
            is_available: true,
        })

        const res = simulateCreateOrderAtomic(db, {
            restaurant_id: restaurantId,
            table_id: tableId,
            items: [{ menu_item_id: menuItemId, quantity: 1 }],
        })

        assert.equal(res.success, true)
        const orderId = res.order.id

        // Simulate deleting the menu item from catalog
        db.menu_items.delete(menuItemId)

        // Simulate PostgreSQL ON DELETE SET NULL on order_items.menu_item_id
        for (const item of db.order_items.values()) {
            if (item.menu_item_id === menuItemId) {
                item.menu_item_id = null
            }
        }

        // Verify order record and item snapshots remain 100% intact
        const order = db.orders.get(orderId)
        assert.ok(order, 'Order must still exist')
        assert.equal(order.total, 2750) // 2500 + 10% tax = 2750

        const items = Array.from(db.order_items.values()).filter((i: any) => i.order_id === orderId)
        assert.equal(items.length, 1)
        assert.equal(items[0].menu_item_id, null, 'Foreign key set to NULL')
        assert.equal(items[0].item_name_snapshot, 'Seasonal Truffle Risotto', 'Historical name preserved')
        assert.equal(items[0].unit_cost_snapshot, 900, 'Cost price preserved')
        assert.equal(items[0].tax_amount_snapshot, 250, 'Tax calculation preserved')
    })

    it('should not mutate historical order snapshots if menu item price increases later', () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()
        const menuItemId = crypto.randomUUID()
        const tableId = crypto.randomUUID()

        db.restaurants.set(restaurantId, { id: restaurantId, tax_rate: 0 })
        db.tables.set(tableId, { id: tableId, restaurant_id: restaurantId, status: 'available' })
        const menuItem = {
            id: menuItemId,
            restaurant_id: restaurantId,
            name: 'Margherita Pizza',
            price: 1000,
            cost_price: 300,
            is_available: true,
        }
        db.menu_items.set(menuItemId, menuItem)

        const res = simulateCreateOrderAtomic(db, {
            restaurant_id: restaurantId,
            table_id: tableId,
            items: [{ menu_item_id: menuItemId, quantity: 1 }],
        })
        assert.equal(res.success, true)

        // Menu price increase 2 months later
        menuItem.price = 1500
        menuItem.name = 'Artisan Margherita Pizza D.O.P.'

        // Verify that past order item snapshot remains completely unchanged
        const orderItem = Array.from(db.order_items.values())[0]
        assert.equal(orderItem.item_name_snapshot, 'Margherita Pizza')
        assert.equal(orderItem.unit_price, 1000)
    })
})
