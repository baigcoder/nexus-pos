import assert from 'node:assert/strict'
import test from 'node:test'
import { issueOrderAccessToken, verifyOrderAccessToken } from '../../src/lib/order-access.ts'

const secret = 'test-only-order-access-signing-secret'
const orderId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const otherOrderId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'

test('an order link is valid only for the signed order', () => {
    const token = issueOrderAccessToken(orderId, secret)
    assert.equal(verifyOrderAccessToken(`Bearer ${token}`, secret), orderId)
    assert.equal(verifyOrderAccessToken(`Bearer ${token.replace(orderId, otherOrderId)}`, secret), null)
    assert.equal(verifyOrderAccessToken(`Bearer ${token}`, 'wrong-key'), null)
})

test('order access rejects missing, malformed, and expired credentials', () => {
    const token = issueOrderAccessToken(orderId, secret)
    const expiresAt = Number(token.split('.')[1])
    assert.equal(verifyOrderAccessToken(null, secret), null)
    assert.equal(verifyOrderAccessToken(orderId, secret), null)
    assert.equal(verifyOrderAccessToken(`Bearer ${token}.extra`, secret), null)
    assert.equal(verifyOrderAccessToken(`Bearer ${token}`, secret, expiresAt - 1), orderId)
    assert.equal(verifyOrderAccessToken(`Bearer ${token}`, secret, expiresAt), null)
})
