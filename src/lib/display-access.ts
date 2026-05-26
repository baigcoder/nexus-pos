import type { UserRole } from '@/types/database'
import type { DisplayType } from '@/types/display'

type DisplayRole = Exclude<UserRole, 'delivery' | 'rider'>

interface DisplaySyncRule {
  label: string
  description: string
  roles: DisplayRole[]
}

export const DISPLAY_SYNC_RULES: Record<DisplayType, DisplaySyncRule> = {
  kitchen: {
    label: 'Kitchen station',
    description: 'Synced with kitchen dashboard and kitchen staff accounts.',
    roles: ['owner', 'manager', 'kitchen'],
  },
  bar: {
    label: 'Bar station',
    description: 'Synced with manager and kitchen prep accounts.',
    roles: ['owner', 'manager', 'kitchen'],
  },
  counter: {
    label: 'Counter handoff',
    description: 'Synced with waiter, manager, and kitchen staff accounts.',
    roles: ['owner', 'manager', 'waiter', 'kitchen'],
  },
  cashier: {
    label: 'Cashier terminal',
    description: 'Synced with cashier dashboard and manager accounts.',
    roles: ['owner', 'manager', 'cashier'],
  },
  waiting: {
    label: 'Waiting area',
    description: 'Managed by owner and manager for guest-facing status.',
    roles: ['owner', 'manager', 'waiter'],
  },
  qr: {
    label: 'QR ordering',
    description: 'Managed by owner and manager for table ordering screens.',
    roles: ['owner', 'manager', 'waiter'],
  },
  advertisement: {
    label: 'Advertisement',
    description: 'Managed by owner and manager for promotional playback.',
    roles: ['owner', 'manager'],
  },
}

export function canManageDisplays(role?: string | null) {
  return role === 'owner' || role === 'manager'
}

export function getDisplaySyncRule(type: DisplayType) {
  return DISPLAY_SYNC_RULES[type]
}

export function getDisplayRoleLabels(type: DisplayType) {
  return DISPLAY_SYNC_RULES[type].roles.map(role => role.charAt(0).toUpperCase() + role.slice(1))
}
