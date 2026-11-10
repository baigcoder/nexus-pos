import type { AiActionProposal, ProposalStatus, ProposalType } from './database.ts'

export type AiSkillName = 
    | 'menu_vision_parser'
    | 'kds_pacing'
    | 'fraud_auditor'
    | 'predictive_86'

export interface AiSkillExecutionResult<T> {
    success: boolean
    skill_name: AiSkillName
    confidence_score: number
    data?: T
    proposal?: AiActionProposal | null
    error?: string
}

// 1. Menu Vision Parser Types
export interface ParsedModifierOption {
    name: string
    price_modifier: number
}

export interface ParsedCustomization {
    name: string
    type: 'single' | 'multiple'
    options: ParsedModifierOption[]
}

export interface ParsedMenuItem {
    name: string
    description?: string
    price: number
    cost_price?: number
    preparation_time?: number
    customizations?: ParsedCustomization[]
}

export interface ParsedCategory {
    name: string
    description?: string
    items: ParsedMenuItem[]
}

export interface MenuVisionParseOutput {
    categories: ParsedCategory[]
    total_items_detected: number
    confidence: number
}

// 2. KDS Pacing Estimator Types
export interface StationLoadMetrics {
    station: string
    active_items: number
    avg_prep_time_minutes: number
    estimated_wait_minutes: number
    is_bottleneck: boolean
}

export interface KdsPacingOutput {
    station_metrics: StationLoadMetrics[]
    kitchen_status: 'optimal' | 'busy' | 'backed_up'
    bottlenecks: string[]
    recommended_pacing_offset_minutes: number
    confidence: number
}

// 3. Fraud & Discrepancy Auditor Types
export interface FraudAnomaly {
    type: 'post_cook_void_spike' | 'cash_drawer_shortage' | 'excessive_refunds' | 'off_hour_drawer_drop'
    severity: 'low' | 'medium' | 'high'
    description: string
    staff_id?: string
    shift_id?: string
    amount?: number
    evidence?: Record<string, any>
}

export interface FraudAuditOutput {
    risk_score: number // 0.0 - 1.0
    risk_level: 'low' | 'medium' | 'high' | 'critical'
    anomalies: FraudAnomaly[]
    requires_manager_intervention: boolean
    confidence: number
}

// 4. Predictive 86 Engine Types
export interface DepletionAlert {
    menu_item_id: string
    item_name: string
    ingredient_name: string
    current_stock: number
    unit: string
    burn_rate_per_hour: number
    estimated_exhaustion_minutes: number
    action_suggested: 'auto_86' | 'warn_staff' | 'safe'
}

export interface Predictive86Output {
    depletion_alerts: DepletionAlert[]
    items_to_auto_86: string[]
    confidence: number
}
