export {
    useAuthStore,
    hasPermission,
    hasAnyPermission,
    getRolePermissions,
    useHasPermission,
    useHasAnyPermission,
    useRolePermissions,
    useRestaurantId,
    useRestaurantName,
    useUserRole,
    useIsOwner,
    useIsManagerOrOwner,
    useIsStaff,
    useCurrentStaff,
    useStaffName,
    useAuthActions,
    useIsFullyAuthenticated,
    useIsHydrated,
} from './auth-store'
export type { Permission } from './auth-store'
export { useOrderStore } from './order-store'
