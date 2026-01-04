'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Store,
    ChevronDown,
    Plus,
    Check,
    Utensils
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'
import type { Restaurant } from '@/types'

export default function RestaurantSwitcher() {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const { restaurant, setRestaurant, user } = useAuthStore()

    useEffect(() => {
        loadRestaurants()
    }, [user])

    async function loadRestaurants() {
        if (!user) return

        const supabase = createClient()

        // Get all restaurants the user has access to
        const { data: staffRecords } = await supabase
            .from('staff')
            .select(`
                restaurant_id,
                role,
                restaurants (*)
            `)
            .eq('user_id', user.id)

        if (staffRecords) {
            const uniqueRestaurants = staffRecords
                .filter(s => s.restaurants)
                .map(s => s.restaurants as unknown as Restaurant)
            setRestaurants(uniqueRestaurants)
        }

        setIsLoading(false)
    }

    const handleSwitch = (selectedRestaurant: Restaurant) => {
        setRestaurant(selectedRestaurant)
        setIsOpen(false)
        // Reload page to reflect new restaurant
        window.location.reload()
    }

    if (isLoading || restaurants.length <= 1) {
        return null // Don't show switcher if only one restaurant
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                    "bg-neutral-900/50 border-neutral-800 hover:border-neutral-700",
                    isOpen && "border-purple-500/50 bg-purple-500/5"
                )}
            >
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Store className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-left">
                    <p className="text-sm font-bold text-white">
                        {restaurant?.name || 'Select Location'}
                    </p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
                        {restaurants.length} locations
                    </p>
                </div>
                <ChevronDown className={cn(
                    "w-4 h-4 text-neutral-500 transition-transform ml-2",
                    isOpen && "rotate-180"
                )} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 z-50 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl"
                    >
                        <div className="p-2 max-h-64 overflow-y-auto">
                            {restaurants.map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => handleSwitch(r)}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-3 rounded-lg transition-all",
                                        r.id === restaurant?.id
                                            ? "bg-purple-500/10 border border-purple-500/30"
                                            : "hover:bg-neutral-800"
                                    )}
                                >
                                    <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center overflow-hidden">
                                        {r.logo_url ? (
                                            <img src={r.logo_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <Utensils className="w-5 h-5 text-neutral-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-bold text-white">{r.name}</p>
                                        {r.address && (
                                            <p className="text-[10px] text-neutral-500 truncate">{r.address}</p>
                                        )}
                                    </div>
                                    {r.id === restaurant?.id && (
                                        <Check className="w-4 h-4 text-purple-500" />
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="p-2 border-t border-neutral-800">
                            <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-800 transition-all text-neutral-400">
                                <Plus className="w-4 h-4" />
                                <span className="text-sm font-medium">Add New Location</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
