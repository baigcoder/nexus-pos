// Hooks barrel export
export { useApiQuery, useAuthenticatedQuery } from './use-api-query'
export type { UseApiQueryOptions, UseApiQueryResult } from './use-api-query'

export { useApiMutation, useOptimisticMutation } from './use-api-mutation'
export type { UseApiMutationOptions, UseApiMutationResult } from './use-api-mutation'

export { useRealtime, useOrdersRealtime, useTablesRealtime, useOrderItemsRealtime } from './use-realtime'
export type { ConnectionStatus, RealtimeConfig, UseRealtimeResult } from './use-realtime'

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
