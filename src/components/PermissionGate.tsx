'use client'

import { ReactNode } from 'react'
import { useHasPermission, useHasAnyPermission, type Permission } from '@/stores'

interface PermissionGateProps {
    required?: Permission
    requiredAny?: Permission[]
    children: ReactNode
    fallback?: ReactNode
}

export function PermissionGate({ required, requiredAny, children, fallback = null }: PermissionGateProps) {
    const hasRequired = useHasPermission(required || 'page:dashboard')
    const hasAny = useHasAnyPermission(requiredAny || ['page:dashboard'])

    if (required && !hasRequired) {
        return fallback
    }
    if (requiredAny && !hasAny) {
        return fallback
    }

    return children
}
