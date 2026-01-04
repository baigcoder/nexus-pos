'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
    Utensils,
    ArrowRight,
    CheckCircle2,
    Sparkles,
    LayoutDashboard,
    Settings,
    Rocket
} from 'lucide-react'
import { Button, Badge, Card } from '@/components/ui/common'

export default function TrialStartedPage() {
    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-orange-600/10 blur-[150px] rounded-full" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[400px] bg-orange-500/5 blur-[100px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full max-w-lg relative z-10 text-center"
            >
                {/* Success Icon */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="mb-8"
                >
                    <div className="w-24 h-24 mx-auto bg-orange-600 rounded-3xl flex items-center justify-center shadow-[0_20px_60px_-15px_rgba(249,115,22,0.5)] relative">
                        <CheckCircle2 className="w-12 h-12 text-white" />
                        <motion.div
                            className="absolute inset-0 rounded-3xl border-2 border-orange-400/50"
                            animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    </div>
                </motion.div>

                {/* Headline */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-4"
                >
                    <Badge variant="outline" className="px-4 py-2 text-orange-600 border-orange-500/30 bg-orange-500/5 mb-4">
                        <Sparkles className="w-4 h-4 mr-2" />
                        TRIAL ACTIVATED
                    </Badge>
                    <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white mb-3">
                        Your Free Trial is Live!
                    </h1>
                    <p className="text-neutral-500 text-lg">
                        Welcome to OrderFlow. You have <span className="font-bold text-orange-600">14 days</span> to explore all features.
                    </p>
                </motion.div>

                {/* Feature Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="grid grid-cols-2 gap-4 my-8"
                >
                    <Card className="p-4 text-left bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                        <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center mb-3">
                            <LayoutDashboard className="w-5 h-5 text-orange-500" />
                        </div>
                        <h3 className="font-bold text-neutral-900 dark:text-white text-sm">Dashboard</h3>
                        <p className="text-neutral-400 text-xs mt-1">Real-time order tracking</p>
                    </Card>
                    <Card className="p-4 text-left bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                        <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center mb-3">
                            <Settings className="w-5 h-5 text-orange-500" />
                        </div>
                        <h3 className="font-bold text-neutral-900 dark:text-white text-sm">Setup</h3>
                        <p className="text-neutral-400 text-xs mt-1">Configure your restaurant</p>
                    </Card>
                </motion.div>

                {/* CTA Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-4"
                >
                    <Link href="/setup" className="block">
                        <Button className="w-full h-14 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm uppercase font-bold tracking-widest shadow-[0_10px_40px_-10px_rgba(249,115,22,0.4)]">
                            <Rocket className="w-4 h-4 mr-2" />
                            Set Up Your Restaurant
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </Link>
                    <Link href="/dashboard" className="block">
                        <Button variant="ghost" className="w-full h-12 rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white text-sm font-bold">
                            Skip to Dashboard →
                        </Button>
                    </Link>
                </motion.div>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-12 flex items-center justify-center gap-3"
                >
                    <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                        <Utensils className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-neutral-400 text-xs font-bold uppercase tracking-widest">OrderFlow · Restaurant Management</span>
                </motion.div>
            </motion.div>
        </div>
    )
}
