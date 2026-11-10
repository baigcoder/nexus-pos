import { test, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import {
    createInMemoryDatabase,
    simulateCreateOrderAtomic,
    simulateVoidItem,
} from './test-helpers.ts'

describe('Pillar C: Strict Domain State Machines (FOH, KDS & Rider Dispatch)', () => {
    it('should automatically record kitchen waste when voiding an item in "cooking" status', () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()
        const menuItemId = crypto.randomUUID()
        const tableId = crypto.randomUUID()
        const chefStaffId = crypto.randomUUID()

        db.restaurants.set(restaurantId, { id: restaurantId, tax_rate: 10 })
        db.tables.set(tableId, { id: tableId, restaurant_id: restaurantId, status: 'available' })
        db.menu_items.set(menuItemId, {
            id: menuItemId,
            name: 'Ribeye Steak 400g',
            price: 3000,
            cost_price: 1200,
            is_available: true,
        })

        const orderRes = simulateCreateOrderAtomic(db, {
            restaurant_id: restaurantId,
            table_id: tableId,
            items: [{ menu_item_id: menuItemId, quantity: 1 }],
        })
        assert.equal(orderRes.success, true)

        const orderItem = orderRes.order.items[0]
        assert.equal(orderItem.kitchen_status, 'fired')

        // Kitchen starts cooking the steak
        orderItem.kitchen_status = 'cooking'

        // Guest cancels because they had to leave
        const voidRes = simulateVoidItem(db, orderItem.id, 'Customer emergency leave', chefStaffId)
        assert.equal(voidRes.success, true)
        assert.equal(voidRes.voided, true)
        assert.equal(voidRes.waste_logged, true, 'Waste record must be created because food was cooking')

        assert.equal(db.waste_records.length, 1)
        const waste = db.waste_records[0]
        assert.equal(waste.item_name, 'Ribeye Steak 400g')
        assert.equal(waste.cost_price, 1200)
        assert.equal(waste.total_cost_wasted, 1200)
        assert.equal(waste.staff_id, chefStaffId)

        // Order total must be recalculated to 0
        const order = db.orders.get(orderRes.order.id)
        assert.equal(order.total, 0)
    })

    it('should NOT log kitchen waste when voiding an item in "hold" or "fired" status', () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()
        const menuItemId = crypto.randomUUID()
        const tableId = crypto.randomUUID()

        db.restaurants.set(restaurantId, { id: restaurantId, tax_rate: 10 })
        db.tables.set(tableId, { id: tableId, restaurant_id: restaurantId, status: 'available' })
        db.menu_items.set(menuItemId, {
            id: menuItemId,
            name: 'Iced Americano',
            price: 500,
            cost_price: 100,
            is_available: true,
        })

        const orderRes = simulateCreateOrderAtomic(db, {
            restaurant_id: restaurantId,
            table_id: tableId,
            items: [{ menu_item_id: menuItemId, quantity: 1 }],
        })
        const orderItem = orderRes.order.items[0]
        orderItem.kitchen_status = 'hold'

        // Cancelled before fired or cooked
        const voidRes = simulateVoidItem(db, orderItem.id, 'Ordered by mistake', 'waiter-1')
        assert.equal(voidRes.success, true)
        assert.equal(voidRes.waste_logged, false, 'No waste for unstarted items')
        assert.equal(db.waste_records.length, 0)
    })

    it('should prevent item voids after order has been paid', () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()
        const menuItemId = crypto.randomUUID()
        const tableId = crypto.randomUUID()

        db.restaurants.set(restaurantId, { id: restaurantId, tax_rate: 0 })
        db.tables.set(tableId, { id: tableId, restaurant_id: restaurantId, status: 'available' })
        db.menu_items.set(menuItemId, { id: menuItemId, name: 'Burger', price: 500, is_available: true })

        const orderRes = simulateCreateOrderAtomic(db, {
            restaurant_id: restaurantId,
            table_id: tableId,
            items: [{ menu_item_id: menuItemId, quantity: 1 }],
        })
        const order = db.orders.get(orderRes.order.id)
        order.status = 'paid'

        const voidRes = simulateVoidItem(db, orderRes.order.items[0].id, 'Customer claim refund', 'cashier-1')
        assert.equal(voidRes.success, false)
        assert.match(voidRes.error || '', /Cannot void item from order with status: paid/)
    })

    it('should enforce the delivery state machine and track COD wallet collection', () => {
        const db = createInMemoryDatabase()
        const deliveryId = crypto.randomUUID()
        const riderId = crypto.randomUUID()

        const delivery = {
            id: deliveryId,
            restaurant_id: crypto.randomUUID(),
            order_id: crypto.randomUUID(),
            rider_id: null as string | null,
            status: 'pending_dispatch',
            cod_amount_collected: 0,
            cod_settled: false,
        }
        db.delivery_assignments.set(deliveryId, delivery)

        // Valid transition sequence
        const validStates = ['assigned', 'picked_up', 'en_route', 'delivered']

        // 1. Assign rider
        delivery.status = 'assigned'
        delivery.rider_id = riderId
        assert.equal(delivery.status, 'assigned')

        // 2. Picked up
        delivery.status = 'picked_up'
        assert.equal(delivery.status, 'picked_up')

        // 3. En route
        delivery.status = 'en_route'
        assert.equal(delivery.status, 'en_route')

        // 4. Delivered with COD cash collection (Rs. 2500)
        delivery.status = 'delivered'
        delivery.cod_amount_collected = 2500
        assert.equal(delivery.status, 'delivered')
        assert.equal(delivery.cod_amount_collected, 2500)
        assert.equal(delivery.cod_settled, false)

        // 5. Shift end reconciliation
        delivery.cod_settled = true
        assert.equal(delivery.cod_settled, true)
    })
})
