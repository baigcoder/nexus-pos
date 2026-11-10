import { test, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import { hashIdempotencyKey } from '../../src/lib/idempotency.ts'
import { createInMemoryDatabase } from './test-helpers.ts'

describe('Pillar D: Idempotency Deduplication & Transactional Event Outbox Sync', () => {
    it('should generate consistent SHA-256 hashes scoped to request path', () => {
        const key = 'idem-req-9988'
        const path = '/api/v1/orders'
        const hash1 = hashIdempotencyKey(key, path)
        const hash2 = hashIdempotencyKey(key, path)

        assert.equal(hash1, hash2)
        assert.equal(hash1.length, 64)

        // Different path produces different hash
        const hashDiffPath = hashIdempotencyKey(key, '/api/v1/billing')
        assert.notEqual(hash1, hashDiffPath)
    })

    it('should deduplicate mutations and replay cached responses on duplicate idempotency keys', () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()
        const idempotencyKey = 'order-post-5544'
        const path = '/api/v1/orders'
        const keyHash = hashIdempotencyKey(idempotencyKey, path)

        // Simulation of idempotent handler execution
        const executeMutation = (runCount: { val: number }) => {
            const cached = db.idempotency_keys.get(keyHash)
            if (cached) {
                return {
                    status: cached.response_status,
                    body: cached.response_body,
                    isReplay: true,
                }
            }

            // Real business execution: increment counter & return response
            runCount.val += 1
            const responseBody = {
                success: true,
                order_id: crypto.randomUUID(),
                order_number: 1042,
            }

            db.idempotency_keys.set(keyHash, {
                restaurant_id: restaurantId,
                key_hash: keyHash,
                request_path: path,
                response_status: 201,
                response_body: responseBody,
                expires_at: new Date(Date.now() + 86400000).toISOString(),
            })

            return {
                status: 201,
                body: responseBody,
                isReplay: false,
            }
        }

        const runCount = { val: 0 }

        // First attempt (initial execution)
        const first = executeMutation(runCount)
        assert.equal(first.isReplay, false)
        assert.equal(first.status, 201)
        assert.equal(first.body.order_number, 1042)
        assert.equal(runCount.val, 1)

        // Second duplicate attempt (network retry)
        const second = executeMutation(runCount)
        assert.equal(second.isReplay, true)
        assert.equal(second.status, 201)
        assert.equal(second.body.order_id, first.body.order_id, 'Must return same order ID')
        assert.equal(runCount.val, 1, 'Underlying business logic must NOT execute twice')
    })

    it('should replay outbox events strictly in monotonic sequence with cursor filtering', () => {
        const db = createInMemoryDatabase()
        const restaurantId = crypto.randomUUID()

        // Populate outbox events
        for (let i = 1; i <= 5; i++) {
            db.restaurant_events.push({
                id: i,
                restaurant_id: restaurantId,
                aggregate_type: 'ORDER',
                aggregate_id: crypto.randomUUID(),
                event_type: i % 2 === 0 ? 'ITEM_FIRED' : 'ORDER_CREATED',
                payload: { seq: i },
                created_at: new Date().toISOString(),
            })
        }

        // Simulate cursor-based sync API: GET /api/v1/events/sync?since_seq=2&limit=2
        const syncEvents = (sinceSeq: number, limit: number) => {
            const filtered = db.restaurant_events.filter(
                (e) => e.restaurant_id === restaurantId && e.id > sinceSeq
            )
            const hasMore = filtered.length > limit
            const events = hasMore ? filtered.slice(0, limit) : filtered
            const latestSeq = events.length > 0 ? events[events.length - 1].id : sinceSeq
            return { events, latestSeq, hasMore }
        }

        const page1 = syncEvents(2, 2)
        assert.equal(page1.events.length, 2)
        assert.equal(page1.events[0].id, 3)
        assert.equal(page1.events[1].id, 4)
        assert.equal(page1.latestSeq, 4)
        assert.equal(page1.hasMore, true)

        const page2 = syncEvents(page1.latestSeq, 2)
        assert.equal(page2.events.length, 1)
        assert.equal(page2.events[0].id, 5)
        assert.equal(page2.latestSeq, 5)
        assert.equal(page2.hasMore, false)
    })
})
