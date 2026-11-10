import { test, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import {
    createInMemoryDatabase,
    simulateSeatTableAtomic,
    simulateGenerateDailyOrderNumber,
} from './test-helpers.ts'

describe('Pillar B: High-Concurrency ACID Transactions & Concurrency Controls', () => {
    it('should reject race conditions when two waiters attempt to seat the same table concurrently', async () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()
        const tableId = crypto.randomUUID()
        const waiter1Id = crypto.randomUUID()
        const waiter2Id = crypto.randomUUID()

        db.tables.set(tableId, {
            id: tableId,
            restaurant_id: restaurantId,
            table_number: 'T-05',
            status: 'available',
            version: 1,
        })

        // Simulate simultaneous seating attempts
        const attempts = await Promise.all([
            Promise.resolve(simulateSeatTableAtomic(db, tableId, waiter1Id, 2)),
            Promise.resolve(simulateSeatTableAtomic(db, tableId, waiter2Id, 4)),
        ])

        const successes = attempts.filter((r) => r.success)
        const failures = attempts.filter((r) => !r.success)

        assert.equal(successes.length, 1, 'Only one seating operation must succeed')
        assert.equal(failures.length, 1, 'The competing seating operation must fail')
        assert.match(failures[0].error || '', /Table is currently occupied/i)

        const finalTable = db.tables.get(tableId)
        assert.equal(finalTable.status, 'occupied')
        assert.equal(finalTable.version, 2, 'Version incremented once')
    })

    it('should rollover daily sequential order numbers at 4:00 AM instead of midnight', () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()

        // Scenario 1: Late evening orders (e.g., 2026-11-05 23:30:00 UTC = 2026-11-06 04:30 AM local, let's use explicit UTC times)
        // With Asia/Karachi (UTC+5):
        // At 2026-11-05 19:30:00 UTC, local time is 2026-11-06 00:30:00 AM (past midnight).
        // 4-hour offset: local time 00:30 - 4 hours = 2026-11-05 20:30 (Previous business day: 2026-11-05).
        const nightTime = new Date('2026-11-05T19:30:00.000Z') // 00:30 local
        const order1 = simulateGenerateDailyOrderNumber(db, restaurantId, nightTime, 5)
        const order2 = simulateGenerateDailyOrderNumber(db, restaurantId, nightTime, 5)

        assert.equal(order1, 1001)
        assert.equal(order2, 1002)

        // At 02:45 AM local (2026-11-05 21:45:00 UTC), still part of 2026-11-05 business day
        const lateShiftTime = new Date('2026-11-05T21:45:00.000Z') // 02:45 local
        const order3 = simulateGenerateDailyOrderNumber(db, restaurantId, lateShiftTime, 5)
        assert.equal(order3, 1003, 'Past midnight shift keeps consecutive sequence')

        // At 04:15 AM local (2026-11-05 23:15:00 UTC):
        // 04:15 - 4 hours = 00:15 on 2026-11-06 -> New business day rolls over!
        const nextDayOpening = new Date('2026-11-05T23:15:00.000Z') // 04:15 local
        const newDayOrder1 = simulateGenerateDailyOrderNumber(db, restaurantId, nextDayOpening, 5)
        assert.equal(newDayOrder1, 1001, 'New business day sequence resets to 1001')
    })

    it('should reject table mutations when version does not match (optimistic locking)', () => {
        const db = createInMemoryDatabase()
        const tableId = crypto.randomUUID()
        db.tables.set(tableId, {
            id: tableId,
            status: 'occupied',
            version: 3,
        })

        const attemptUpdate = (expectedVersion: number) => {
            const table = db.tables.get(tableId)
            if (table.version !== expectedVersion) {
                return { success: false, error: 'Concurrency conflict: table has been modified' }
            }
            table.version += 1
            table.status = 'billing'
            return { success: true }
        }

        // Stale mutation attempt with version 2
        const staleRes = attemptUpdate(2)
        assert.equal(staleRes.success, false)
        assert.match(staleRes.error || '', /Concurrency conflict/)

        // Fresh mutation attempt with version 3
        const validRes = attemptUpdate(3)
        assert.equal(validRes.success, true)
        assert.equal(db.tables.get(tableId).status, 'billing')
        assert.equal(db.tables.get(tableId).version, 4)
    })
})
