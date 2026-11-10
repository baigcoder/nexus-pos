import { createAdminClient } from '../../supabase/admin.ts'
import type {
    AiSkillExecutionResult,
    KdsPacingOutput,
    StationLoadMetrics,
} from '../../../types/ai.ts'

export class KdsPacingSkill {
    /**
     * Dynamically computes active ticket backlog across stations (Grill, Fry, Bar, Pantry/Dessert)
     * and recommends pacing delays to prevent station overloading during peak rush.
     */
    static async estimatePacing(restaurantId: string): Promise<AiSkillExecutionResult<KdsPacingOutput>> {
        if (!restaurantId) {
            return {
                success: false,
                skill_name: 'kds_pacing',
                confidence_score: 0,
                error: 'restaurant_id is required',
            }
        }

        try {
            const supabase = createAdminClient()

            // Fetch active kitchen items
            const { data: activeItems, error } = await supabase
                .from('order_items')
                .select(`
                    id,
                    quantity,
                    kitchen_status,
                    item_name_snapshot,
                    order:orders(id, status, is_priority, created_at)
                `)
                .eq('order.restaurant_id', restaurantId)
                .in('kitchen_status', ['fired', 'cooking'])

            if (error) {
                console.error('[KdsPacingSkill] Query error:', error)
                return {
                    success: false,
                    skill_name: 'kds_pacing',
                    confidence_score: 0,
                    error: 'Failed to retrieve active kitchen workload',
                }
            }

            const items = (activeItems || []).filter((oi: any) => oi.order && oi.order.status !== 'cancelled')

            // Route items to logical stations heuristically
            const stationCounts: Record<string, number> = {
                'Grill Station': 0,
                'Fry Station': 0,
                'Bar & Beverage': 0,
                'Pantry & Dessert': 0,
            }

            for (const item of items) {
                const name = (item.item_name_snapshot || '').toLowerCase()
                const qty = item.quantity || 1

                if (name.includes('steak') || name.includes('burger') || name.includes('chicken') || name.includes('patty') || name.includes('ribeye')) {
                    stationCounts['Grill Station'] += qty
                } else if (name.includes('fry') || name.includes('fries') || name.includes('wing') || name.includes('tempura') || name.includes('nugget')) {
                    stationCounts['Fry Station'] += qty
                } else if (name.includes('coffee') || name.includes('latte') || name.includes('tea') || name.includes('drink') || name.includes('shake') || name.includes('beverage')) {
                    stationCounts['Bar & Beverage'] += qty
                } else {
                    stationCounts['Pantry & Dessert'] += qty
                }
            }

            const stationMetrics: StationLoadMetrics[] = [
                {
                    station: 'Grill Station',
                    active_items: stationCounts['Grill Station'],
                    avg_prep_time_minutes: 18,
                    estimated_wait_minutes: Math.ceil((stationCounts['Grill Station'] * 18) / 3),
                    is_bottleneck: stationCounts['Grill Station'] >= 8,
                },
                {
                    station: 'Fry Station',
                    active_items: stationCounts['Fry Station'],
                    avg_prep_time_minutes: 8,
                    estimated_wait_minutes: Math.ceil((stationCounts['Fry Station'] * 8) / 2),
                    is_bottleneck: stationCounts['Fry Station'] >= 10,
                },
                {
                    station: 'Bar & Beverage',
                    active_items: stationCounts['Bar & Beverage'],
                    avg_prep_time_minutes: 4,
                    estimated_wait_minutes: Math.ceil((stationCounts['Bar & Beverage'] * 4) / 2),
                    is_bottleneck: stationCounts['Bar & Beverage'] >= 12,
                },
                {
                    station: 'Pantry & Dessert',
                    active_items: stationCounts['Pantry & Dessert'],
                    avg_prep_time_minutes: 7,
                    estimated_wait_minutes: Math.ceil((stationCounts['Pantry & Dessert'] * 7) / 2),
                    is_bottleneck: stationCounts['Pantry & Dessert'] >= 10,
                },
            ]

            const bottlenecks = stationMetrics
                .filter((m) => m.is_bottleneck)
                .map((m) => `${m.station} backed up (${m.active_items} items, ~${m.estimated_wait_minutes}m wait)`)

            const maxWait = Math.max(...stationMetrics.map((m) => m.estimated_wait_minutes))
            let kitchenStatus: 'optimal' | 'busy' | 'backed_up' = 'optimal'
            let recommendedOffset = 0

            if (maxWait > 25 || bottlenecks.length >= 2) {
                kitchenStatus = 'backed_up'
                recommendedOffset = 15
            } else if (maxWait > 12 || bottlenecks.length === 1) {
                kitchenStatus = 'busy'
                recommendedOffset = 5
            }

            const output: KdsPacingOutput = {
                station_metrics: stationMetrics,
                kitchen_status: kitchenStatus,
                bottlenecks,
                recommended_pacing_offset_minutes: recommendedOffset,
                confidence: 0.92,
            }

            let proposal = null
            if (kitchenStatus === 'backed_up') {
                const { data: createdProp } = await supabase
                    .from('ai_action_proposals')
                    .insert({
                        restaurant_id: restaurantId,
                        skill_name: 'kds_pacing',
                        proposal_type: 'pacing_throttle',
                        status: 'pending',
                        confidence_score: 0.92,
                        reasoning: `Severe kitchen bottleneck detected across: ${bottlenecks.join('; ')}. Propose pacing delay of +${recommendedOffset} minutes on new online and table orders.`,
                        proposed_payload: output,
                    })
                    .select('*')
                    .single()

                if (createdProp) proposal = createdProp
            }

            return {
                success: true,
                skill_name: 'kds_pacing',
                confidence_score: 0.92,
                data: output,
                proposal,
            }
        } catch (err: any) {
            console.error('[KdsPacingSkill] Execution error:', err)
            return {
                success: false,
                skill_name: 'kds_pacing',
                confidence_score: 0,
                error: err.message || 'Failed to analyze KDS pacing',
            }
        }
    }
}
