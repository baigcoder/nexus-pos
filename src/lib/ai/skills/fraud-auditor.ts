import { createAdminClient } from '../../supabase/admin.ts'
import type {
    AiSkillExecutionResult,
    FraudAnomaly,
    FraudAuditOutput,
} from '../../../types/ai.ts'

export class FraudAuditorSkill {
    /**
     * Scans shift closures, cash drawer movements, and post-cook voids for financial
     * theft patterns, cash drawer shortfalls, and suspicious void spikes.
     */
    static async auditShifts(restaurantId: string): Promise<AiSkillExecutionResult<FraudAuditOutput>> {
        if (!restaurantId) {
            return {
                success: false,
                skill_name: 'fraud_auditor',
                confidence_score: 0,
                error: 'restaurant_id is required',
            }
        }

        try {
            const supabase = createAdminClient()
            const anomalies: FraudAnomaly[] = []

            // 1. Audit closed shifts with cash shortfalls
            const { data: shifts } = await supabase
                .from('register_shifts')
                .select('id, staff_id, opening_float, total_sales_cash, closing_counted_cash, cash_difference, closed_at')
                .eq('restaurant_id', restaurantId)
                .order('opened_at', { ascending: false })
                .limit(20)

            for (const shift of shifts || []) {
                const diff = Number(shift.cash_difference) || 0
                const expected = Number(shift.opening_float) + Number(shift.total_sales_cash)
                const shortfall = -diff

                // Flag if negative variance exceeds 500 currency units or 3% of cash expected
                if (shortfall > 500 || (expected > 0 && shortfall / expected > 0.03)) {
                    anomalies.push({
                        type: 'cash_drawer_shortage',
                        severity: shortfall > 2000 ? 'high' : 'medium',
                        description: `Shift ${shift.id.slice(0, 8)} ended with an unexplained cash shortage of ${shortfall.toFixed(2)} (Counted: ${shift.closing_counted_cash}, Expected: ${expected.toFixed(2)})`,
                        staff_id: shift.staff_id,
                        shift_id: shift.id,
                        amount: shortfall,
                    })
                }
            }

            // 2. Audit post-cook voids in waste_records (Cooking food then voiding from bill)
            const { data: waste } = await supabase
                .from('waste_records')
                .select('id, order_id, item_name, quantity, total_cost_wasted, reason, staff_id, created_at')
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: false })
                .limit(50)

            // Group waste by staff member to detect spike patterns
            const staffWasteCount: Record<string, { count: number; totalCost: number; items: string[] }> = {}
            for (const record of waste || []) {
                const staffId = record.staff_id || 'unknown'
                if (!staffWasteCount[staffId]) {
                    staffWasteCount[staffId] = { count: 0, totalCost: 0, items: [] }
                }
                staffWasteCount[staffId].count += record.quantity || 1
                staffWasteCount[staffId].totalCost += Number(record.total_cost_wasted) || 0
                staffWasteCount[staffId].items.push(record.item_name)
            }

            for (const [staffId, stats] of Object.entries(staffWasteCount)) {
                if (stats.count >= 4 || stats.totalCost > 3000) {
                    anomalies.push({
                        type: 'post_cook_void_spike',
                        severity: stats.totalCost > 5000 ? 'high' : 'medium',
                        description: `Staff member ${staffId.slice(0, 8)} recorded ${stats.count} post-cook voids totaling ${stats.totalCost.toFixed(2)} in wasted inventory. Possible unrecorded cash collections.`,
                        staff_id: staffId !== 'unknown' ? staffId : undefined,
                        amount: stats.totalCost,
                        evidence: { items: stats.items },
                    })
                }
            }

            // Compute overall risk score
            let riskScore = 0.05
            if (anomalies.some((a) => a.severity === 'high')) {
                riskScore = 0.88
            } else if (anomalies.length > 0) {
                riskScore = 0.55
            }

            const riskLevel: 'low' | 'medium' | 'high' | 'critical' = 
                riskScore >= 0.90 ? 'critical' : riskScore >= 0.70 ? 'high' : riskScore >= 0.35 ? 'medium' : 'low'

            const output: FraudAuditOutput = {
                risk_score: riskScore,
                risk_level: riskLevel,
                anomalies,
                requires_manager_intervention: riskLevel === 'high' || riskLevel === 'critical',
                confidence: 0.95,
            }

            let proposal = null
            if (output.requires_manager_intervention) {
                const { data: createdProp } = await supabase
                    .from('ai_action_proposals')
                    .insert({
                        restaurant_id: restaurantId,
                        skill_name: 'fraud_auditor',
                        proposal_type: 'flag_cashier_discrepancy',
                        status: 'pending',
                        confidence_score: 0.95,
                        reasoning: `Critical audit anomaly detected: ${anomalies.map((a) => a.description).join('; ')}. Immediate manager inspection recommended.`,
                        proposed_payload: output,
                    })
                    .select('*')
                    .single()

                if (createdProp) proposal = createdProp
            }

            return {
                success: true,
                skill_name: 'fraud_auditor',
                confidence_score: 0.95,
                data: output,
                proposal,
            }
        } catch (err: any) {
            console.error('[FraudAuditorSkill] Error:', err)
            return {
                success: false,
                skill_name: 'fraud_auditor',
                confidence_score: 0,
                error: err.message || 'Failed to execute fraud audit',
            }
        }
    }
}
