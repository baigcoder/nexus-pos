import { NextResponse } from 'next/server'
import { clearStaffSessionCookie } from '@/lib/auth/staff-session'

export async function POST() {
    return clearStaffSessionCookie(NextResponse.json({ success: true }))
}
