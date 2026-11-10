export const STARTER_STAFF_CAP = 3

export type RestaurantPlan = 'starter' | 'professional' | 'enterprise'

export interface PlanFields {
    plan?: string | null
    trial_ends_at?: string | null
}

export function normalizePlan(plan?: string | null): RestaurantPlan {
    if (plan === 'professional' || plan === 'enterprise') return plan
    return 'starter'
}

export function isPaidPlan(plan?: string | null): boolean {
    const normalized = normalizePlan(plan)
    return normalized === 'professional' || normalized === 'enterprise'
}

export function isTrialExpired(restaurant: PlanFields | null | undefined): boolean {
    if (!restaurant) return false
    if (isPaidPlan(restaurant.plan)) return false
    if (!restaurant.trial_ends_at) return false
    return new Date(restaurant.trial_ends_at).getTime() < Date.now()
}

export function canCreateOrders(restaurant: PlanFields | null | undefined): boolean {
    if (!restaurant) return true
    return isPaidPlan(restaurant.plan) || !isTrialExpired(restaurant)
}

export function trialDaysRemaining(restaurant: PlanFields | null | undefined): number | null {
    if (!restaurant?.trial_ends_at || isPaidPlan(restaurant.plan)) return null
    const ms = new Date(restaurant.trial_ends_at).getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}
