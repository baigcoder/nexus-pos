'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function HeroAnimation() {
    return (
        <div className="relative w-full aspect-[16/10] bg-white dark:bg-neutral-900 rounded-[2rem] border-8 border-neutral-100 dark:border-neutral-800 shadow-2xl overflow-hidden flex">
            {/* Sidebar Skeleton */}
            <div className="w-[20%] border-r border-neutral-100 dark:border-neutral-800 p-6 space-y-6 hidden sm:block">
                <div className="w-8 h-8 bg-primary/10 rounded-lg" />
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={cn("h-2 rounded-full bg-neutral-100 dark:bg-neutral-800", i === 1 && "bg-primary/20")} style={{ width: `${Math.random() * 40 + 40}%` }} />
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-8 space-y-8">
                {/* Top bar header */}
                <div className="flex justify-between items-center">
                    <div className="h-4 w-32 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
                    <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800" />
                        <div className="w-20 h-8 rounded-lg bg-primary/10" />
                    </div>
                </div>

                {/* Dynamic Charts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-4">
                        <div className="h-2 w-20 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
                        <div className="flex items-end gap-2 h-24 pt-4">
                            {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ height: 0 }}
                                    animate={{ height: `${h}%` }}
                                    transition={{ duration: 1, delay: i * 0.1, repeat: Infinity, repeatType: 'reverse' }}
                                    className="flex-1 bg-primary/20 rounded-t-md"
                                />
                            ))}
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-4">
                        <div className="h-2 w-24 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="h-2 w-24 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
                                    <div className="h-2 w-12 bg-primary/10 rounded-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Live Orders List */}
                <div className="space-y-4">
                    <div className="h-2 w-28 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
                    <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.2 }}
                                className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 flex items-center justify-between border border-neutral-100 dark:border-neutral-800"
                            >
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-700" />
                                    <div className="space-y-2">
                                        <div className="h-2 w-24 bg-neutral-200 dark:bg-neutral-600 rounded-full" />
                                        <div className="h-2 w-16 bg-neutral-100 dark:bg-neutral-700 rounded-full" />
                                    </div>
                                </div>
                                <motion.div
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="px-3 py-1 rounded-full bg-primary/10 text-[0.6rem] font-bold text-primary uppercase tracking-wider"
                                >
                                    Ready
                                </motion.div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Decorative Glows (Colder Blues) */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -ml-32 -mb-32" />
        </div>
    )
}
