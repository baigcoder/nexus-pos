import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireManagerOrOwner, tenantMismatchResponse } from '@/lib/api-auth'
import { MenuVisionParserSkill } from '@/lib/ai/skills/menu-vision-parser'
import { KdsPacingSkill } from '@/lib/ai/skills/kds-pacing'
import { FraudAuditorSkill } from '@/lib/ai/skills/fraud-auditor'
import { Predictive86Skill } from '@/lib/ai/skills/predictive-86'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/ai/proposals
 * List AI proposals requiring Human-In-The-Loop review (Owner or Manager only).
 */
export async function GET(request: NextRequest) {
    try {
        const { auth, response } = await requireManagerOrOwner()(request)
        if (response) return response
        const targetRestaurantId = auth.restaurantId
        const paramRestaurantId = request.nextUrl.searchParams.get('restaurant_id')
        if (paramRestaurantId !== null && paramRestaurantId !== targetRestaurantId) return tenantMismatchResponse()

        const status = request.nextUrl.searchParams.get('status') || 'pending'
        const supabase = createAdminClient()

        let query = supabase
            .from('ai_action_proposals')
            .select('*')
            .eq('restaurant_id', targetRestaurantId)
            .order('created_at', { ascending: false })
            .limit(100)

        if (status !== 'all') {
            query = query.eq('status', status)
        }

        const { data: proposals, error } = await query

        if (error) {
            return NextResponse.json(
                { success: false, error: 'Failed to retrieve AI proposals' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            proposals: proposals || [],
            count: (proposals || []).length,
        }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (err) {
        return NextResponse.json(
            { success: false, error: 'AI proposal operation failed' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/v1/ai/proposals
 * Approves, rejects, or triggers AI skill evaluations.
 */
export async function POST(request: NextRequest) {
    try {
        const { auth, response } = await requireManagerOrOwner()(request)
        if (response) return response

        const body = await request.json().catch(() => null)
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
        }

        const { action, proposal_id, restaurant_id, skill_name, payload } = body
        const targetRestaurantId = auth.restaurantId
        if (restaurant_id !== undefined && restaurant_id !== targetRestaurantId) return tenantMismatchResponse()

        // 1. Trigger Skill Execution
        if (action === 'trigger_skill') {
            let result: any = null

            if (skill_name === 'menu_vision_parser') {
                result = await MenuVisionParserSkill.parseMenu({
                    restaurant_id: targetRestaurantId,
                    raw_text: payload?.raw_text,
                    menu_json: payload?.menu_json,
                })
            } else if (skill_name === 'kds_pacing') {
                result = await KdsPacingSkill.estimatePacing(targetRestaurantId)
            } else if (skill_name === 'fraud_auditor') {
                result = await FraudAuditorSkill.auditShifts(targetRestaurantId)
            } else if (skill_name === 'predictive_86') {
                result = await Predictive86Skill.evaluateInventory(targetRestaurantId)
            } else {
                return NextResponse.json(
                    { success: false, error: `Unknown skill: ${skill_name}` },
                    { status: 400 }
                )
            }

            return NextResponse.json({
                success: result.success,
                result,
            })
        }

        if (action !== 'approve' && action !== 'reject') {
            return NextResponse.json({ success: false, error: 'Invalid proposal action' }, { status: 400 })
        }

        if (typeof proposal_id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(proposal_id)) {
            return NextResponse.json({ success: false, error: 'Valid proposal_id is required' }, { status: 400 })
        }

        const { data, error } = await createAdminClient().rpc('review_ai_proposal', {
            p_restaurant_id: targetRestaurantId,
            p_staff_id: auth.staffId,
            p_proposal_id: proposal_id,
            p_action: action,
        })
        if (error) throw error
        if (!data.success) {
            const status = data.code === 'forbidden' ? 403 : data.code === 'not_found' ? 404 :
                data.code === 'conflict' ? 409 : 400
            return NextResponse.json({ success: false, error: data.error }, { status })
        }
        return NextResponse.json({ success: true, proposal: data.proposal })

    } catch (err) {
        console.error('[AiProposalsRoute] Error:', err)
        return NextResponse.json(
            { success: false, error: 'AI proposal operation failed' },
            { status: 500 }
        )
    }
}

