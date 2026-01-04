'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion } from 'framer-motion'
import {
    CalendarDays,
    Clock,
    Users,
    Phone,
    Mail,
    User,
    CheckCircle2,
    ArrowRight,
    MapPin,
    Utensils
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Card, Button, Input, Badge } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface BookingForm {
    name: string
    phone: string
    email: string
    partySize: number
    date: string
    time: string
    specialRequests: string
}

const timeSlots = [
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'
]

function BookTableContent() {
    const searchParams = useSearchParams()
    const restaurantSlug = searchParams.get('restaurant') || 'demo-restaurant'

    const [step, setStep] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [form, setForm] = useState<BookingForm>({
        name: '',
        phone: '',
        email: '',
        partySize: 2,
        date: '',
        time: '',
        specialRequests: ''
    })

    // Get tomorrow's date as default
    useEffect(() => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        setForm(f => ({ ...f, date: tomorrow.toISOString().split('T')[0] }))
    }, [])

    const handleSubmit = async () => {
        setIsSubmitting(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500))
        setIsSubmitting(false)
        setIsSuccess(true)
    }

    const handleChange = (field: keyof BookingForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [field]: e.target.value })
    }

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }
    const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full text-center"
                >
                    <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-8">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-4">Reservation Confirmed!</h1>
                    <p className="text-neutral-400 mb-6">
                        We've reserved a table for <span className="text-white font-bold">{form.partySize} guests</span> on{' '}
                        <span className="text-white font-bold">{new Date(form.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span> at{' '}
                        <span className="text-white font-bold">{form.time}</span>.
                    </p>
                    <Card className="p-6 bg-neutral-900 border-neutral-800 text-left space-y-4">
                        <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-orange-500" />
                            <span className="text-white font-bold">{form.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-orange-500" />
                            <span className="text-neutral-400">{form.phone}</span>
                        </div>
                        {form.email && (
                            <div className="flex items-center gap-3">
                                <Mail className="w-5 h-5 text-orange-500" />
                                <span className="text-neutral-400">{form.email}</span>
                            </div>
                        )}
                    </Card>
                    <p className="text-[10px] text-neutral-600 uppercase tracking-widest mt-6">
                        A confirmation SMS has been sent to your phone
                    </p>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-neutral-950">
            {/* Hero */}
            <div className="relative h-64 bg-gradient-to-b from-orange-600/20 to-neutral-950 flex items-center justify-center">
                <div className="text-center">
                    <Badge className="bg-orange-600/10 text-orange-500 border-none font-bold text-[10px] uppercase tracking-widest mb-4">
                        <Utensils className="w-3 h-3 mr-1" /> Reserve a Table
                    </Badge>
                    <h1 className="text-4xl lg:text-5xl font-bold text-white uppercase tracking-tight">
                        Book Your <span className="text-orange-500">Experience</span>
                    </h1>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-6 -mt-8 pb-24">
                <motion.div variants={container} initial="hidden" animate="show">
                    {/* Progress */}
                    <motion.div variants={item} className="flex items-center justify-center gap-2 mb-12">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all",
                                    s <= step ? 'bg-orange-600 text-white' : 'bg-neutral-800 text-neutral-500'
                                )}>
                                    {s}
                                </div>
                                {s < 3 && <div className={cn("w-16 h-1 rounded-full", s < step ? 'bg-orange-600' : 'bg-neutral-800')} />}
                            </div>
                        ))}
                    </motion.div>

                    <Card className="p-8 bg-neutral-900 border-neutral-800">
                        {/* Step 1: Date & Party */}
                        {step === 1 && (
                            <motion.div variants={item} className="space-y-8">
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold text-white mb-2">When are you visiting?</h2>
                                    <p className="text-neutral-500">Select your preferred date and party size</p>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Date</label>
                                        <input
                                            type="date"
                                            value={form.date}
                                            onChange={handleChange('date')}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white font-bold focus:border-orange-600 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-3 block">Party Size</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                                <button
                                                    key={n}
                                                    onClick={() => setForm({ ...form, partySize: n })}
                                                    className={cn(
                                                        "w-14 h-14 rounded-xl font-bold text-lg transition-all",
                                                        form.partySize === n
                                                            ? 'bg-orange-600 text-white'
                                                            : 'bg-black border border-neutral-800 text-neutral-500 hover:border-neutral-700'
                                                    )}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-neutral-600 mt-2 uppercase tracking-widest">For larger parties, call us directly</p>
                                    </div>
                                </div>

                                <Button
                                    onClick={() => setStep(2)}
                                    disabled={!form.date}
                                    className="w-full h-16 bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase tracking-widest"
                                >
                                    Continue <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </motion.div>
                        )}

                        {/* Step 2: Time */}
                        {step === 2 && (
                            <motion.div variants={item} className="space-y-8">
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold text-white mb-2">Select a Time</h2>
                                    <p className="text-neutral-500">
                                        {new Date(form.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} • {form.partySize} guests
                                    </p>
                                </div>

                                <div className="grid grid-cols-4 gap-3">
                                    {timeSlots.map((time) => (
                                        <button
                                            key={time}
                                            onClick={() => setForm({ ...form, time })}
                                            className={cn(
                                                "h-14 rounded-xl font-bold transition-all",
                                                form.time === time
                                                    ? 'bg-orange-600 text-white'
                                                    : 'bg-black border border-neutral-800 text-neutral-400 hover:border-neutral-700'
                                            )}
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep(1)}
                                        className="flex-1 h-16 border-neutral-800 text-neutral-500"
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        onClick={() => setStep(3)}
                                        disabled={!form.time}
                                        className="flex-1 h-16 bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase tracking-widest"
                                    >
                                        Continue <ArrowRight className="ml-2 w-5 h-5" />
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 3: Contact Info */}
                        {step === 3 && (
                            <motion.div variants={item} className="space-y-8">
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold text-white mb-2">Your Details</h2>
                                    <p className="text-neutral-500">Almost there! Enter your contact information</p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Name *</label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={handleChange('name')}
                                            placeholder="Your full name"
                                            className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white placeholder:text-neutral-700 focus:border-orange-600 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Phone *</label>
                                        <input
                                            type="tel"
                                            value={form.phone}
                                            onChange={handleChange('phone')}
                                            placeholder="+92 300 1234567"
                                            className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white placeholder:text-neutral-700 focus:border-orange-600 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Email (Optional)</label>
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={handleChange('email')}
                                            placeholder="email@example.com"
                                            className="w-full h-14 bg-black border border-neutral-800 rounded-xl px-4 text-white placeholder:text-neutral-700 focus:border-orange-600 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 block">Special Requests</label>
                                        <textarea
                                            value={form.specialRequests}
                                            onChange={handleChange('specialRequests')}
                                            placeholder="Birthday celebration, dietary requirements, etc."
                                            rows={3}
                                            className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white placeholder:text-neutral-700 focus:border-orange-600 outline-none resize-none"
                                        />
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="p-4 bg-black border border-neutral-800 rounded-xl">
                                    <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-3">Reservation Summary</p>
                                    <div className="flex items-center gap-6 text-sm">
                                        <span className="flex items-center gap-2 text-neutral-400">
                                            <CalendarDays className="w-4 h-4 text-orange-500" />
                                            {new Date(form.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className="flex items-center gap-2 text-neutral-400">
                                            <Clock className="w-4 h-4 text-orange-500" />
                                            {form.time}
                                        </span>
                                        <span className="flex items-center gap-2 text-neutral-400">
                                            <Users className="w-4 h-4 text-orange-500" />
                                            {form.partySize} guests
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep(2)}
                                        className="flex-1 h-16 border-neutral-800 text-neutral-500"
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={!form.name || !form.phone || isSubmitting}
                                        className="flex-1 h-16 bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase tracking-widest disabled:opacity-50"
                                    >
                                        {isSubmitting ? 'Booking...' : 'Confirm Booking'}
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}

export default function BookTablePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full" />
            </div>
        }>
            <BookTableContent />
        </Suspense>
    )
}
