import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Account, AccountSteps } from '@/components/account/Account'
import styles from '@/components/account/account.module.css'

export default function TrialStartedPage() {
    return (
        <Account area="Owner onboarding" title="Set up your first location" description="Add the information NexusPOS will use for orders, receipts, and service hours.">
            <AccountSteps labels={['Account', 'Verify email', 'Restaurant setup']} current={2} />
            <section className={styles.form} aria-label="Continue to your workspace">
                <Link className={styles.primary} href="/setup">Set up your restaurant <ArrowRight size={17} aria-hidden="true" /></Link>
                <Link className={styles.secondary} href="/dashboard">Open an existing workspace</Link>
            </section>
        </Account>
    )
}
