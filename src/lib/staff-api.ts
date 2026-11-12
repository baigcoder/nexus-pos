'use client'

// Staff identity now travels in the httpOnly `staff_session` cookie (sent automatically on same-origin fetch).
// Kept so existing callers compile; the old `x-staff-id` header was spoofable and is ignored by the server.
export function withStaffAuthHeaders(headers: HeadersInit = {}): HeadersInit {
    return headers
}
