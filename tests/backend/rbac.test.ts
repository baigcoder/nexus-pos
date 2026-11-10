import { test, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateRbacPermission } from './test-helpers.ts'

describe('Pillar F: Zero-Trust Multi-Tenant RBAC & RLS Enforcement', () => {
    it('should grant Owner and Manager unrestricted clearance across all resources', () => {
        const roles = ['owner', 'manager'] as const
        const resources = ['expenses', 'daily_reports', 'cash_registers', 'register_shifts', 'drawer_movements', 'waste', 'deliveries', 'ai_proposals'] as const

        for (const role of roles) {
            for (const res of resources) {
                assert.equal(evaluateRbacPermission(role, res, 'read'), true, `${role} should read ${res}`)
                assert.equal(evaluateRbacPermission(role, res, 'write'), true, `${role} should write ${res}`)
                assert.equal(evaluateRbacPermission(role, res, 'approve'), true, `${role} should approve ${res}`)
            }
        }
    })

    it('should strictly bar Waiters from reading or mutating financial reports, expenses, and cash drawers', () => {
        const forbidden = ['expenses', 'daily_reports', 'cash_registers', 'register_shifts', 'drawer_movements', 'ai_proposals'] as const

        for (const res of forbidden) {
            assert.equal(evaluateRbacPermission('waiter', res, 'read'), false, `Waiter must NOT read ${res}`)
            assert.equal(evaluateRbacPermission('waiter', res, 'write'), false, `Waiter must NOT write ${res}`)
            assert.equal(evaluateRbacPermission('waiter', res, 'approve'), false, `Waiter must NOT approve ${res}`)
        }
    })

    it('should permit Cashiers to manage register shifts and movements, but bar them from expenses and reports', () => {
        assert.equal(evaluateRbacPermission('cashier', 'cash_registers', 'read'), true)
        assert.equal(evaluateRbacPermission('cashier', 'register_shifts', 'write'), true)
        assert.equal(evaluateRbacPermission('cashier', 'drawer_movements', 'write'), true)

        // Must be blocked from expenses and profit reports
        assert.equal(evaluateRbacPermission('cashier', 'expenses', 'read'), false)
        assert.equal(evaluateRbacPermission('cashier', 'daily_reports', 'read'), false)
        assert.equal(evaluateRbacPermission('cashier', 'ai_proposals', 'approve'), false)
    })

    it('should permit Kitchen staff to log food waste but restrict them from financial and delivery records', () => {
        assert.equal(evaluateRbacPermission('kitchen', 'waste', 'write'), true)
        assert.equal(evaluateRbacPermission('kitchen', 'expenses', 'read'), false)
        assert.equal(evaluateRbacPermission('kitchen', 'cash_registers', 'read'), false)
        assert.equal(evaluateRbacPermission('kitchen', 'daily_reports', 'read'), false)
    })

    it('should isolate Riders exclusively to delivery assignments', () => {
        assert.equal(evaluateRbacPermission('rider', 'deliveries', 'read'), true)
        assert.equal(evaluateRbacPermission('rider', 'deliveries', 'write'), true)
        assert.equal(evaluateRbacPermission('rider', 'expenses', 'read'), false)
        assert.equal(evaluateRbacPermission('rider', 'daily_reports', 'read'), false)
        assert.equal(evaluateRbacPermission('rider', 'cash_registers', 'read'), false)
    })
})
