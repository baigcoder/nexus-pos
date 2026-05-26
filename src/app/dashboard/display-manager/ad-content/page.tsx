'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores'
import { useEffect } from 'react'
import { ArrowLeft, Megaphone } from 'lucide-react'
import { AdContentManager } from '@/components/display/AdContentManager'
import Link from 'next/link'

export default function AdContentPage() {
 const router = useRouter()
 const { restaurant, userRole, staff } = useAuthStore()
 const effectiveRole = userRole || staff?.role
 const canManageAds = effectiveRole === 'owner'

 useEffect(() => {
  if (effectiveRole && !['owner', 'manager'].includes(effectiveRole)) {
   router.push('/dashboard')
  }
 }, [effectiveRole, router])

 if (!restaurant?.id) {
  return (
   <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
   </div>
  )
 }

 return (
  <div className="space-y-6">
   {/* Header */}
   <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
     <Link
      href="/dashboard/display-manager"
      className="p-2 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--surface-active)] transition-colors"
     >
      <ArrowLeft className="w-5 h-5 text-[var(--text-primary)]" />
     </Link>
     <div>
      <div className="flex items-center gap-3">
       <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center">
        <Megaphone className="w-5 h-5 text-[var(--text-primary)]" />
       </div>
       <h1 className="text-3xl font-black text-[var(--text-primary)]">Advertisement Content</h1>
      </div>
      <p className="text-[var(--text-muted)] mt-1">Manage slideshow content for digital displays</p>
     </div>
    </div>

    <Link
     href="/dashboard/display-manager"
     className="px-4 py-2 rounded-xl font-bold bg-[var(--surface-active)] hover:bg-[var(--surface-active)] text-[var(--text-primary)] transition-colors"
    >
     Back to Displays
    </Link>
   </div>

   {/* Content Manager */}
   <AdContentManager restaurantId={restaurant.id} canManage={canManageAds} />
  </div>
 )
}
