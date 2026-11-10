import { NextResponse } from 'next/server'
import { clearStaffSessionCookie } from '@/lib/staff-session'

export async function POST() {
    const response = NextResponse.json({ success: true })
    return clearStaffSessionCookie(response)
}
