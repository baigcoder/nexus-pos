import { test, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import {
    createInMemoryDatabase,
    simulateCreateOrderAtomic,
    simulateSettlePaymentAtomic,
    simulateTransferTableAtomic,
    simulateAdvanceKdsItemAtomic,
} from './test-helpers.ts'
import { menuCache, getMenuCacheKey, invalidateRestaurantMenuCache } from '../../src/lib/cache/menu-cache.ts'

describe('Scalable Backend Engine: ACID Settlement, Table Routing & High-Throughput Caching', () => {
    it('should atomically settle payment, update cashier shift ledger, and release dining table', () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()
        const tableId = crypto.randomUUID()
        const menuItemId = crypto.randomUUID()
        const cashierId = crypto.randomUUID()
        const shiftId = crypto.randomUUID()

        db.restaurants.set(restaurantId, { id: restaurantId, tax_rate: 10 })
        db.tables.set(tableId, {
            id: tableId,
            restaurant_id: restaurantId,
            table_number: 'T-10',
            status: 'occupied',
            version: 1,
        })
        db.menu_items.set(menuItemId, {
            id: menuItemId,
            name: 'Beef Tenderloin',
            price: 2000,
            cost_price: 700,
            is_available: true,
        })

        // Active open shift for cashier
        const shift = {
            id: shiftId,
            restaurant_id: restaurantId,
            staff_id: cashierId,
            status: 'open',
            opening_float: 5000,
            total_sales_cash: 0,
            total_sales_card: 0,
            total_tax_collected: 0,
        }
        db.register_shifts.set(shiftId, shift)

        // Create order: Total = 2000 + 10% tax = 2200
        const orderRes = simulateCreateOrderAtomic(db, {
            restaurant_id: restaurantId,
            table_id: tableId,
            staff_id: cashierId,
            items: [{ menu_item_id: menuItemId, quantity: 1 }],
        })
        assert.equal(orderRes.success, true)
        const orderId = orderRes.order.id

        // Settle payment with cash
        const settleRes = simulateSettlePaymentAtomic(db, {
            order_id: orderId,
            staff_id: cashierId,
            payment_method: 'cash',
            amount: 2200,
            cash_received: 2500,
        })

        assert.equal(settleRes.success, true)
        assert.equal(settleRes.order.status, 'paid')
        assert.equal(settleRes.order.payment_status, 'paid')
        assert.equal(settleRes.table_released, true)

        // Verify cashier shift ledger was updated with cash total & tax
        assert.equal(shift.total_sales_cash, 2200)
        assert.equal(shift.total_tax_collected, 200)

        // Verify table was released back to 'available' with version incremented
        const table = db.tables.get(tableId)
        assert.equal(table.status, 'available')
        assert.equal(table.version, 3) // Initial 1 -> order 2 -> payment release 3

        // Verify outbox event was recorded
        assert.equal(db.restaurant_events.length, 2)
        assert.equal(db.restaurant_events[1].event_type, 'ORDER_PAID')
    })

    it('should hold table in "billing" status during partial payments and release only on zero balance', () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()
        const tableId = crypto.randomUUID()
        const menuItemId = crypto.randomUUID()

        db.restaurants.set(restaurantId, { id: restaurantId, tax_rate: 0 })
        db.tables.set(tableId, { id: tableId, restaurant_id: restaurantId, status: 'occupied' })
        db.menu_items.set(menuItemId, { id: menuItemId, name: 'Combo Meal', price: 1000, is_available: true })

        const orderRes = simulateCreateOrderAtomic(db, {
            restaurant_id: restaurantId,
            table_id: tableId,
            items: [{ menu_item_id: menuItemId, quantity: 1 }],
        })
        const orderId = orderRes.order.id

        // First installment: Rs. 400
        const part1 = simulateSettlePaymentAtomic(db, {
            order_id: orderId,
            payment_method: 'card',
            amount: 400,
        })
        assert.equal(part1.success, true)
        assert.equal(part1.order.status, 'partial_paid')
        assert.equal(part1.table_released, false)
        assert.equal(db.tables.get(tableId).status, 'billing', 'Table held in billing mode')

        // Final installment: Rs. 600
        const part2 = simulateSettlePaymentAtomic(db, {
            order_id: orderId,
            payment_method: 'cash',
            amount: 600,
        })
        assert.equal(part2.success, true)
        assert.equal(part2.order.status, 'paid')
        assert.equal(part2.table_released, true)
        assert.equal(db.tables.get(tableId).status, 'available', 'Table released on final payment')
    })

    it('should atomically transfer table with active orders and reject moves to occupied tables', () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()
        const table1Id = crypto.randomUUID()
        const table2Id = crypto.randomUUID()
        const occupiedTableId = crypto.randomUUID()
        const menuItemId = crypto.randomUUID()
        const waiterId = crypto.randomUUID()

        db.restaurants.set(restaurantId, { id: restaurantId, tax_rate: 0 })
        db.tables.set(table1Id, {
            id: table1Id,
            restaurant_id: restaurantId,
            table_number: 'T-01',
            status: 'occupied',
            customer_count: 4,
            current_waiter_id: waiterId,
            version: 1,
        })
        db.tables.set(table2Id, {
            id: table2Id,
            restaurant_id: restaurantId,
            table_number: 'T-02',
            status: 'available',
            customer_count: 1,
            version: 1,
        })
        db.tables.set(occupiedTableId, {
            id: table2Id,
            restaurant_id: restaurantId,
            table_number: 'T-99',
            status: 'occupied',
            version: 1,
        })
        db.menu_items.set(menuItemId, { id: menuItemId, name: 'Pasta', price: 1200, is_available: true })

        const orderRes = simulateCreateOrderAtomic(db, {
            restaurant_id: restaurantId,
            table_id: table1Id,
            items: [{ menu_item_id: menuItemId, quantity: 2 }],
        })
        const order = db.orders.get(orderRes.order.id)
        assert.equal(order.table_id, table1Id)

        // Attempt transfer to already occupied table -> must fail
        const badTransfer = simulateTransferTableAtomic(db, table1Id, occupiedTableId, waiterId)
        assert.equal(badTransfer.success, false)
        assert.match(badTransfer.error || '', /currently occupied/i)

        // Valid transfer to Table 2
        const goodTransfer = simulateTransferTableAtomic(db, table1Id, table2Id, waiterId)
        assert.equal(goodTransfer.success, true)
        assert.equal(goodTransfer.from_table_number, 'T-01')
        assert.equal(goodTransfer.to_table_number, 'T-02')

        // Verify order moved to Table 2
        assert.equal(order.table_id, table2Id)

        // Verify Table 1 is now available and Table 2 is occupied
        assert.equal(db.tables.get(table1Id).status, 'available')
        assert.equal(db.tables.get(table2Id).status, 'occupied')
        assert.equal(db.tables.get(table2Id).customer_count, 4)
    })

    it('should aggregate multi-station KDS item updates and auto-advance order to "ready" when all items are plated', () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()
        const tableId = crypto.randomUUID()
        const item1Id = crypto.randomUUID()
        const item2Id = crypto.randomUUID()

        db.restaurants.set(restaurantId, { id: restaurantId, tax_rate: 0 })
        db.tables.set(tableId, { id: tableId, status: 'occupied' })
        db.menu_items.set(item1Id, { id: item1Id, name: 'Grill Steak', price: 2000, is_available: true })
        db.menu_items.set(item2Id, { id: item2Id, name: 'Bar Milkshake', price: 500, is_available: true })

        const orderRes = simulateCreateOrderAtomic(db, {
            restaurant_id: restaurantId,
            table_id: tableId,
            items: [
                { menu_item_id: item1Id, quantity: 1 },
                { menu_item_id: item2Id, quantity: 1 },
            ],
        })
        const orderId = orderRes.order.id
        const orderItems = Array.from(db.order_items.values()).filter((oi: any) => oi.order_id === orderId)
        assert.equal(orderItems.length, 2)

        const steakItem = orderItems[0]
        const shakeItem = orderItems[1]

        // Barista finishes milkshake first -> plated
        const step1 = simulateAdvanceKdsItemAtomic(db, shakeItem.id, 'plated')
        assert.equal(step1.success, true)
        assert.equal(step1.order_ready, false, 'Order is not ready yet because steak is still cooking')
        assert.equal(db.orders.get(orderId).status, 'pending')

        // Grill chef finishes steak -> plated
        const step2 = simulateAdvanceKdsItemAtomic(db, steakItem.id, 'plated')
        assert.equal(step2.success, true)
        assert.equal(step2.order_ready, true, 'All station items are plated -> order auto-advances to ready')
        assert.equal(db.orders.get(orderId).status, 'ready')
    })

    it('should serve high-frequency menu reads from cache and invalidate on mutation', () => {
        const restaurantId = 'rest-cache-test-123'
        const key = getMenuCacheKey(restaurantId)

        const sampleMenu = {
            categories: [{ id: 'cat-1', name: 'Drinks', items: [{ name: 'Espresso', price: 400 }] }],
        }

        // Initially empty
        assert.equal(menuCache.get(key).data, null)

        // Cache write
        menuCache.set(key, sampleMenu, 1000)
        const cached = menuCache.get<typeof sampleMenu>(key)
        assert.ok(cached.data)
        assert.equal(cached.isStale, false)
        assert.equal(cached.data.categories[0].name, 'Drinks')

        // Invalidate on catalog mutation
        invalidateRestaurantMenuCache(restaurantId)
        assert.equal(menuCache.get(key).data, null, 'Cache must be cleanly purged')
    })
})

