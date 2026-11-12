// Run: node --test src/lib/auth/staff-session.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.STAFF_SESSION_SECRET = 'test-secret'
const { createStaffSessionToken, verifyStaffSessionToken } = await import('./staff-session.ts')

test('valid token round-trips', () => {
    assert.equal(verifyStaffSessionToken(createStaffSessionToken('staff-1')), 'staff-1')
})

test('rejects tampered, forged, expired and empty tokens', () => {
    const token = createStaffSessionToken('staff-1')
    const [payload, sig] = token.split('.')
    const forgedPayload = Buffer.from(JSON.stringify({ sid: 'staff-2', exp: Date.now() + 1e9 })).toString('base64url')

    assert.equal(verifyStaffSessionToken(`${forgedPayload}.${sig}`), null)
    assert.equal(verifyStaffSessionToken(`${payload}.AAAA`), null)
    assert.equal(verifyStaffSessionToken('staff-1'), null)
    assert.equal(verifyStaffSessionToken(''), null)
    assert.equal(verifyStaffSessionToken(createStaffSessionToken('staff-1', 0)), null)
})
