'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Utensils,
    Building2,
    MapPin,
    Phone,
    Mail,
    Clock,
    ArrowRight,
    ArrowLeft,
    Check,
    Globe,
    Cpu,
    Activity,
    Lock,
    Sparkles,
    ChefHat,
    CreditCard
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Button, Card, Input, Badge, PremiumLayout } from '@/components/ui/common'
import { cn } from '@/lib/utils'

const steps = [
    { id: 1, title: 'Profile', subtitle: 'Restaurant details', icon: Building2 },
    { id: 2, title: 'Contact', subtitle: 'Business network', icon: Phone },
    { id: 3, title: 'Hours', subtitle: 'Operating schedule', icon: Clock },
]

export default function SetupPage() {
    const router = useRouter()
    const { success, error } = useToast()
    const { user, setRestaurant } = useAuthStore()
    const [currentStep, setCurrentStep] = useState(1)
    const [isLoading, setIsLoading] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone: '',
        email: '',
        currency: 'PKR',
        taxRate: 16,
        operatingHours: {
            monday: { open: '10:00', close: '22:00', closed: false },
            tuesday: { open: '10:00', close: '22:00', closed: false },
            wednesday: { open: '10:00', close: '22:00', closed: false },
            thursday: { open: '10:00', close: '22:00', closed: false },
            friday: { open: '10:00', close: '22:00', closed: false },
            saturday: { open: '10:00', close: '23:00', closed: false },
            sunday: { open: '10:00', close: '23:00', closed: false },
        },
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleHoursChange = (day: string, field: string, value: string | boolean) => {
        setFormData({
            ...formData,
            operatingHours: {
                ...formData.operatingHours,
                [day]: {
                    ...formData.operatingHours[day as keyof typeof formData.operatingHours],
                    [field]: value,
                },
            },
        })
    }

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (currentStep < 3) {
            setCurrentStep(currentStep + 1)
            window.scrollTo({ top: 0, behavior: 'smooth' })
            return
        }

        setIsLoading(true)

        try {
            // Use server-side API to create restaurant (bypasses RLS)
            const response = await fetch('/api/setup/create-restaurant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner_id: user?.id,
                    user_email: user?.email, // Fallback for user lookup
                    name: formData.name,
                    slug: generateSlug(formData.name),
                    address: formData.address,
                    phone: formData.phone,
                    email: formData.email,
                    currency: formData.currency,
                    tax_rate: formData.taxRate,
                    operating_hours: formData.operatingHours,
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create restaurant')
            }

            if (result.restaurant) {
                setRestaurant(result.restaurant)
                success('Restaurant Created', 'Your restaurant setup is complete!')
                router.push('/dashboard')
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create restaurant.'
            error('Setup Error', errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <PremiumLayout className="min-h-screen flex flex-col pt-12 pb-24 px-6 bg-neutral-50 dark:bg-neutral-950">
            <div className="max-w-4xl mx-auto w-full">
                {/* Header Section */}
                <div className="text-center mb-16 space-y-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <div className="w-16 h-16 bg-orange-600 flex items-center justify-center rounded-2xl shadow-xl shadow-orange-600/20">
                            <ChefHat className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <Badge variant="outline" className="px-3 py-1 mb-2 text-orange-600 border-orange-500/30 bg-orange-500/5">
                                <Sparkles className="w-3 h-3 mr-2" />
                                ONBOARDING
                            </Badge>
                            <h1 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tight">Configure Your Restaurant</h1>
                            <p className="text-neutral-500 font-medium mt-2">Just a few steps to get your dashboard ready.</p>
                        </div>
                    </motion.div>
                </div>

                {/* Progress Tracker */}
                <div className="grid grid-cols-3 gap-8 mb-12">
                    {steps.map((step) => {
                        const isActive = currentStep === step.id
                        const isCompleted = currentStep > step.id
                        const Icon = step.icon

                        return (
                            <div key={step.id} className="relative">
                                <div className={cn(
                                    "h-1.5 rounded-full mb-6 transition-all duration-700",
                                    isCompleted ? 'bg-orange-600' : isActive ? 'bg-neutral-200 dark:bg-neutral-800' : 'bg-neutral-100 dark:bg-neutral-900'
                                )}>
                                    {isActive && (
                                        <motion.div
                                            layoutId="setup-progress"
                                            className="h-full bg-orange-600 shadow-[0_0_15px_rgba(249,115,22,0.5)]"
                                            initial={{ width: '0%' }}
                                            animate={{ width: '100%' }}
                                        />
                                    )}
                                </div>
                                <div className={cn(
                                    "flex items-center gap-4 transition-all duration-500",
                                    isActive ? 'opacity-100' : 'opacity-40'
                                )}>
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all",
                                        isCompleted ? 'bg-orange-600 border-orange-600 text-white' :
                                            isActive ? 'border-orange-500 text-orange-600 bg-orange-500/5' :
                                                'border-neutral-200 dark:border-neutral-800 text-neutral-400 bg-transparent'
                                    )}>
                                        {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                    </div>
                                    <div className="hidden sm:block">
                                        <div className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">{isActive ? 'Current' : isCompleted ? 'Done' : 'Pending'}</div>
                                        <div className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-tight">{step.title}</div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Form Card */}
                <form onSubmit={handleSubmit}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="p-8 md:p-12 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl shadow-neutral-200/50 dark:shadow-black/50">
                                {currentStep === 1 && (
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-1 h-8 bg-orange-600 rounded-full" />
                                            <div>
                                                <h2 className="text-2xl font-black text-neutral-900 dark:text-white">Basic Information</h2>
                                                <p className="text-neutral-500 text-sm font-medium">Identify your brand and location.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <Input
                                                label="Restaurant Name"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                placeholder="The Gourmet Kitchen"
                                                required
                                                icon={Building2}
                                                className="bg-neutral-50 dark:bg-neutral-800/50"
                                            />
                                            <Input
                                                label="Address"
                                                name="address"
                                                value={formData.address}
                                                onChange={handleChange}
                                                placeholder="Street Name, City"
                                                icon={MapPin}
                                                required
                                                className="bg-neutral-50 dark:bg-neutral-800/50"
                                            />
                                        </div>

                                        <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-700 flex items-start gap-4">
                                            <div className="p-2 bg-orange-500/10 rounded-lg">
                                                <Lock className="w-5 h-5 text-orange-500" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Your data is secure</h4>
                                                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">Setup data is encrypted and can be updated anytime in settings.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentStep === 2 && (
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-1 h-8 bg-orange-600 rounded-full" />
                                            <div>
                                                <h2 className="text-2xl font-black text-neutral-900 dark:text-white">Contact & Billing</h2>
                                                <p className="text-neutral-500 text-sm font-medium">How customers and staff reach the system.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <Input
                                                label="Business Phone"
                                                name="phone"
                                                type="tel"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                placeholder="+92 XXX XXXXXXX"
                                                icon={Phone}
                                                required
                                                className="bg-neutral-50 dark:bg-neutral-800/50"
                                            />
                                            <Input
                                                label="Business Email"
                                                name="email"
                                                type="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                placeholder="hello@restaurant.com"
                                                icon={Mail}
                                                required
                                                className="bg-neutral-50 dark:bg-neutral-800/50"
                                            />
                                            <div className="space-y-2">
                                                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300">Currency</label>
                                                <div className="relative group">
                                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                                    <select
                                                        name="currency"
                                                        value={formData.currency}
                                                        onChange={handleChange}
                                                        className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 h-12 rounded-xl pl-10 pr-4 text-sm font-bold text-neutral-900 dark:text-white focus:border-orange-500 outline-none transition-all appearance-none"
                                                    >
                                                        <option value="PKR">PKR (₨)</option>
                                                        <option value="USD">USD ($)</option>
                                                        <option value="EUR">EUR (€)</option>
                                                        <option value="GBP">GBP (£)</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <Input
                                                label="Tax Rate (%)"
                                                name="taxRate"
                                                type="number"
                                                value={formData.taxRate}
                                                onChange={handleChange}
                                                placeholder="16"
                                                min="0"
                                                max="100"
                                                icon={CreditCard}
                                                required
                                                className="bg-neutral-50 dark:bg-neutral-800/50"
                                            />
                                        </div>
                                    </div>
                                )}

                                {currentStep === 3 && (
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-1 h-8 bg-orange-600 rounded-full" />
                                            <div>
                                                <h2 className="text-2xl font-black text-neutral-900 dark:text-white">Operating Hours</h2>
                                                <p className="text-neutral-500 text-sm font-medium">Set when your restaurant is open for orders.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {Object.entries(formData.operatingHours).map(([day, hours]) => (
                                                <div key={day} className={cn(
                                                    "flex items-center justify-between p-4 rounded-xl border transition-all",
                                                    hours.closed
                                                        ? 'bg-neutral-50 dark:bg-neutral-900/50 border-transparent opacity-60'
                                                        : 'bg-white dark:bg-neutral-800/30 border-neutral-100 dark:border-neutral-800'
                                                )}>
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-24">
                                                            <span className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-tight">{day}</span>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer group">
                                                            <input
                                                                type="checkbox"
                                                                checked={!hours.closed}
                                                                onChange={(e) => handleHoursChange(day, 'closed', !e.target.checked)}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-10 h-5 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                                                            <span className="ml-3 text-[10px] font-bold text-neutral-400 group-hover:text-orange-500 transition-colors uppercase">
                                                                {hours.closed ? 'Closed' : 'Open'}
                                                            </span>
                                                        </label>
                                                    </div>

                                                    {!hours.closed && (
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="time"
                                                                value={hours.open}
                                                                onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                                                                className="bg-transparent border-b-2 border-orange-500/20 px-2 py-1 text-xs font-bold text-neutral-900 dark:text-white outline-none focus:border-orange-500 transition-all"
                                                            />
                                                            <span className="text-neutral-400 text-[10px]">to</span>
                                                            <input
                                                                type="time"
                                                                value={hours.close}
                                                                onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                                                                className="bg-transparent border-b-2 border-orange-500/20 px-2 py-1 text-xs font-bold text-neutral-900 dark:text-white outline-none focus:border-orange-500 transition-all"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Card Navigation */}
                                <div className="flex items-center justify-between mt-12 pt-8 border-t border-neutral-100 dark:border-neutral-800">
                                    {currentStep > 1 ? (
                                        <Button
                                            type="button"
                                            onClick={() => setCurrentStep(currentStep - 1)}
                                            variant="ghost"
                                            className="h-14 px-8 text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-bold"
                                        >
                                            <ArrowLeft className="w-4 h-4 mr-2" />
                                            Back
                                        </Button>
                                    ) : (
                                        <div />
                                    )}

                                    <Button
                                        type="submit"
                                        isLoading={isLoading}
                                        className="h-14 px-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest text-xs shadow-[0_10px_40px_-10px_rgba(249,115,22,0.4)]"
                                    >
                                        {currentStep === 3 ? (
                                            <>
                                                Finalize Setup
                                                <Check className="w-4 h-4 ml-3" />
                                            </>
                                        ) : (
                                            <>
                                                Next Step
                                                <ArrowRight className="w-4 h-4 ml-3" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </Card>
                        </motion.div>
                    </AnimatePresence>
                </form>

                {/* Secure Badge */}
                <div className="mt-12 text-center opacity-40">
                    <div className="inline-flex items-center gap-2 py-1.5 px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full">
                        <Activity className="w-3 h-3 text-orange-500" />
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Global Node Hosting Active</span>
                    </div>
                </div>
            </div>
        </PremiumLayout>
    )
}
