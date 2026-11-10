'use client'

import { ArrowLeft, Monitor } from 'lucide-react'
import Link from 'next/link'
import { AdContentManager } from '@/components/display/AdContentManager'
import { useAuthStore } from '@/stores'
import styles from '@/components/display/signage.module.css'
import work from '@/components/service/service-order.module.css'

export default function AdContentPage() {
    const { restaurant, userRole, staff } = useAuthStore()
    const role = userRole || staff?.role
    return <main className={`${work.page} ${styles.page}`}>
        <header className={styles.head}>
            <div><p className={work.kicker}>Restaurant displays</p><h1>Signage Studio</h1>
                <p>Put your promotions on the window, at the counter, or in the waiting area.</p></div>
            <Link href="/dashboard/display-manager" className={work.secondary}><ArrowLeft size={16} aria-hidden="true" /> Manage screens</Link>
        </header>
        {restaurant?.id && (role === 'owner' || role === 'manager')
            ? <AdContentManager key={`${restaurant.id}:${role}`} restaurantId={restaurant.id} canManage={role === 'owner'} />
            : <p className={styles.notice}><Monitor size={18} aria-hidden="true" /> Sign in as an owner or manager to view your signage.</p>}
    </main>
}
