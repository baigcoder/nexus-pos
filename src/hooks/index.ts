// Hooks barrel export
export { useApiQuery, useAuthenticatedQuery } from './use-api-query'
export type { UseApiQueryOptions, UseApiQueryResult } from './use-api-query'

export { useApiMutation, useOptimisticMutation } from './use-api-mutation'
export type { UseApiMutationOptions, UseApiMutationResult } from './use-api-mutation'

export { useRealtime, useOrdersRealtime, useTablesRealtime, useOrderItemsRealtime } from './use-realtime'
export type { ConnectionStatus, RealtimeConfig, UseRealtimeResult } from './use-realtime'

// Dashboard data hooks
export {
    useDashboardStats,
    useRevenueChart,
    useOrdersByStatus,
    useHourlyOrders,
    useCategoryBreakdown,
    useRecentOrders,
} from './use-dashboard-data'

export { useBillingOrders } from './use-billing-orders'
export { useWaiterStats } from './use-waiter-stats'
export { useDeliveryStats } from './use-delivery-stats'
export { usePaginatedQuery } from './use-paginated-query'
export { useDebouncedValue } from './use-debounce'
export { useUnreadNotifications } from './use-unread-notifications'

// Re-export existing hooks from lib
export {
    useLoading,
    useDebounce,
    useCategories,
    useMenuItems,
    useTables,
    useOrders,
    useLocalStorage,
    useTimeElapsed,
    useNotificationSound,
} from '@/lib/hooks'
