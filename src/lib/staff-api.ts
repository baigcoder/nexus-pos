'use client'

import { useAuthStore } from '@/stores'

export function withStaffAuthHeaders(headers: HeadersInit = {}): HeadersInit {
    const staffId = useAuthStore.getState().staff?.id

    if (!staffId) {
        return headers
    }

    return {
        ...headers,
        'x-staff-id': staffId,
    }
}
