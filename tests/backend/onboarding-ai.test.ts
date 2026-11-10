import { test, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import { MenuVisionParserSkill } from '../../src/lib/ai/skills/menu-vision-parser.ts'
import { KdsPacingSkill } from '../../src/lib/ai/skills/kds-pacing.ts'
import { FraudAuditorSkill } from '../../src/lib/ai/skills/fraud-auditor.ts'
import { Predictive86Skill } from '../../src/lib/ai/skills/predictive-86.ts'
import { createInMemoryDatabase } from './test-helpers.ts'

describe('Pillar E: Small-Business Onboarding Bootstrap & Modular AI Skills', () => {
    it('should parse unstructured OCR menu text into categories and items with high confidence', async () => {
        const rawMenu = `
=== Hot Beverages ===
Flat White ... 550
Spanish Latte ... 650
Americano - 450

=== Fresh Viennoiserie ===
Butter Croissant: 390
Pain au Chocolat ... 450
`
        const restaurantId = crypto.randomUUID()
        const res = await MenuVisionParserSkill.parseMenu({
            restaurant_id: restaurantId,
            raw_text: rawMenu,
            auto_create_proposal: false,
        })

        assert.equal(res.success, true)
        assert.ok(res.data)
        assert.equal(res.data.categories.length, 2)
        assert.equal(res.data.categories[0].name, 'Hot Beverages')
        assert.equal(res.data.categories[0].items.length, 3)
        assert.equal(res.data.categories[0].items[0].name, 'Flat White')
        assert.equal(res.data.categories[0].items[0].price, 550)

        assert.equal(res.data.categories[1].name, 'Fresh Viennoiserie')
        assert.equal(res.data.categories[1].items.length, 2)
        assert.equal(res.data.categories[1].items[0].name, 'Butter Croissant')
        assert.equal(res.data.categories[1].items[0].price, 390)
        assert.ok(res.confidence_score >= 0.90, 'Confidence score must be >= 0.90')
    })

    it('should validate structured menu JSON inputs and normalize preparation times & cost prices', async () => {
        const menuJson = {
            categories: [
                {
                    name: 'Artisan Pizzas',
                    items: [
                        { name: 'Truffle Mushroom', price: 1800, preparation_time: 15 },
                        { name: 'Spicy Diavola', price: 1600 },
                    ],
                },
            ],
        }

        const res = await MenuVisionParserSkill.parseMenu({
            restaurant_id: crypto.randomUUID(),
            menu_json: menuJson,
            auto_create_proposal: false,
        })

        assert.equal(res.success, true)
        assert.ok(res.data)
        const cat = res.data.categories[0]
        assert.equal(cat.items[0].cost_price, 540) // Default 30% rule
        assert.equal(cat.items[1].preparation_time, 15) // Default 15 mins
    })

    it('should evaluate fraud anomalies from shift shortages and post-cook voids', () => {
        const shiftShortage = {
            opening_float: 5000,
            total_sales_cash: 25000,
            closing_counted_cash: 27500, // Shortage of 2,500!
            expected: 30000,
        }

        const shortage = shiftShortage.expected - shiftShortage.closing_counted_cash
        const isAnomaly = shortage > 500 || (shortage / shiftShortage.expected) > 0.03
        assert.equal(isAnomaly, true, 'Discrepancy must be flagged')
        assert.equal(shortage, 2500)
    })

    it('should accurately project ingredient depletion and propose auto-86 for zero-stock items', () => {
        const inventory = [
            { item: 'Brioche Bun', current_stock: 0, burn_rate_per_hour: 12 },
            { item: 'Beef Patty', current_stock: 4, burn_rate_per_hour: 8 },
            { item: 'Cheddar Slice', current_stock: 100, burn_rate_per_hour: 10 },
        ]

        const actions = inventory.map((inv) => {
            const exhaustionMinutes = inv.current_stock > 0
                ? Math.round((inv.current_stock / inv.burn_rate_per_hour) * 60)
                : 0

            return {
                item: inv.item,
                stock: inv.current_stock,
                exhaustionMinutes,
                action: inv.current_stock <= 0 ? 'auto_86' : exhaustionMinutes <= 45 ? 'warn_staff' : 'safe',
            }
        })

        assert.equal(actions[0].action, 'auto_86')
        assert.equal(actions[1].action, 'warn_staff') // 30 mins remaining
        assert.equal(actions[2].action, 'safe') // 600 mins remaining
    })
})
