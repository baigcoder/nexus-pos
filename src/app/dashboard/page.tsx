'use client'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import RoleBasedDashboard from './RoleDashboard'

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <RoleBasedDashboard />
    </ErrorBoundary>
  )
}
