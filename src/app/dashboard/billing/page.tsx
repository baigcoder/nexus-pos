'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    CreditCard,
    Banknote,
    Smartphone,
    Printer,
    Check,
    Receipt,
    DollarSign,
    Percent,
    Calculator,
    CheckCircle2,
    Users,
    ArrowUpRight,
    Tag,
    X,
    Loader2,
    Sparkles
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Card, Button, Badge, Input, StatCard } from '@/components/ui/common'
import { SplitBillModal, type SplitPaymentData } from '@/components/billing/SplitBillModal'
import { cn } from '@/lib/utils'
import type { Order, OrderItem } from '@/types'

const unpaidOrders = [
    { id: '1', order_number: 1001, table_number: 'Table 3', items: [{ name: 'Butter Chicken', quantity: 2, price: 650 }, { name: 'Garlic Naan', quantity: 4, price: 80 }, { name: 'Mango Lassi', quantity: 2, price: 180 }], subtotal: 1980, tax: 317, total: 2297, waiter: 'Ahmed' },
    { id: '2', order_number: 1002, table_number: 'Table 7', items: [{ name: 'Chicken Biryani', quantity: 1, price: 550 }, { name: 'Raita', quantity: 1, price: 100 }], subtotal: 650, tax: 104, total: 754, waiter: 'Sara' },
]

type PaymentMethod = 'cash' | 'card' | 'mobile'

export default function BillingPage() {
    const { success } = useToast()
    const [orders] = useState(unpaidOrders)
    const [selectedOrder, setSelectedOrder] = useState<typeof unpaidOrders[0] | null>(null)
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
    const [discount, setDiscount] = useState(0)
    const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent')
    const [cashReceived, setCashReceived] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [showSplitModal, setShowSplitModal] = useState(false)

    // Promo code state
    const [promoCode, setPromoCode] = useState('')
    const [isValidatingCode, setIsValidatingCode] = useState(false)
    const [appliedPromo, setAppliedPromo] = useState<{
        code: string
        type: 'percentage' | 'fixed'
        value: number
        description: string
    } | null>(null)
    const [promoError, setPromoError] = useState('')

    // Sample promo codes for validation
    const validPromoCodes = [
        { code: 'WELCOME20', type: 'percentage' as const, value: 20, description: 'Welcome discount', minOrder: 500 },
        { code: 'FLAT100', type: 'fixed' as const, value: 100, description: 'Rs.100 off', minOrder: 800 },
        { code: 'VIP50', type: 'percentage' as const, value: 50, description: 'VIP discount', minOrder: 2000 },
        { code: 'WEEKEND15', type: 'percentage' as const, value: 15, description: 'Weekend special', minOrder: 0 },
    ]

    const validatePromoCode = async () => {
        if (!promoCode.trim() || !selectedOrder) return
        setIsValidatingCode(true)
        setPromoError('')

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800))

        const found = validPromoCodes.find(p => p.code === promoCode.toUpperCase())
        if (found) {
            if (selectedOrder.subtotal < found.minOrder) {
                setPromoError(`Minimum order Rs.${found.minOrder} required`)
            } else {
                setAppliedPromo(found)
                // Apply to discount state
                setDiscount(found.value)
                setDiscountType(found.type === 'percentage' ? 'percent' : 'fixed')
                success('Promo Applied!', `${found.description} - ${found.type === 'percentage' ? found.value + '% OFF' : 'Rs.' + found.value + ' OFF'}`)
            }
        } else {
            setPromoError('Invalid promo code')
        }
        setIsValidatingCode(false)
    }

    const removePromo = () => {
        setAppliedPromo(null)
        setPromoCode('')
        setDiscount(0)
        setPromoError('')
    }

    const handleSplitComplete = (splits: SplitPaymentData[]) => {
        success('Split Payment Complete', `Order split into ${splits.length} payments successfully.`)
        setShowSplitModal(false)
        setSelectedOrder(null)
    }

    const calculateDiscount = () => {
        if (!selectedOrder) return 0
        if (discountType === 'percent') return Math.round(selectedOrder.subtotal * (discount / 100))
        return discount
    }

    const calculateTotal = () => {
        if (!selectedOrder) return 0
        return selectedOrder.total - calculateDiscount()
    }

    const calculateChange = () => {
        const received = parseFloat(cashReceived) || 0
        return Math.max(0, received - calculateTotal())
    }

    const handleProcessPayment = async () => {
        if (!selectedOrder) return
        setIsProcessing(true)
        await new Promise(resolve => setTimeout(resolve, 1000))
        success('Payment Complete', `Order #${selectedOrder.order_number} has been paid.`)
        setSelectedOrder(null)
        setDiscount(0)
        setCashReceived('')
        setIsProcessing(false)
    }

    const quickAmounts = [500, 1000, 5000]

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
    }

    return (
        <div className="relative min-h-screen">
            {/* Background Orbs */}
            <div className="fixed inset-0 pointer-events-none -z-10 bg-black">
                <motion.div
                    animate={{
                        x: [0, 100, 0],
                        y: [0, -50, 0],
                        scale: [1, 1.2, 1]
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-orange-600/10 blur-[120px] rounded-full"
                />
                <motion.div
                    animate={{
                        x: [0, -80, 0],
                        y: [0, 100, 0],
                        scale: [1, 1.3, 1]
                    }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-purple-600/10 blur-[150px] rounded-full"
                />
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="px-2 lg:px-4 space-y-10 pb-24 relative z-10"
            >
                {/* Header */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pt-4">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="px-4 py-1.5 bg-orange-600/10 border border-orange-600/20 rounded-full flex items-center gap-2"
                            >
                                <span className="w-1.5 h-1.5 bg-orange-600 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em]">Checkout Station</span>
                            </motion.div>
                            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Live Management</span>
                        </div>

                        <motion.h1
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-5xl lg:text-7xl font-black text-white tracking-tight leading-[0.9]"
                        >
                            CHECKOUT & <br />
                            <span className="bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 bg-clip-text text-transparent italic">
                                BILLING
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="text-neutral-500 font-bold text-lg max-w-xl"
                        >
                            Manage restaurant transactions and settlements. Currently processing <span className="text-white underline decoration-orange-600/50 underline-offset-4">{orders.length} unpaid orders</span>.
                        </motion.p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <motion.button
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            className="h-14 px-8 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center gap-3 text-neutral-400 hover:text-white transition-all group shadow-xl"
                        >
                            <Calculator className="w-5 h-5" />
                            <span className="text-xs font-black uppercase tracking-widest text-[10px]">Daily Report</span>
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            className="group relative h-14 px-10 bg-orange-600 rounded-2xl flex items-center gap-3 overflow-hidden shadow-2xl shadow-orange-600/20"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                            <Receipt className="w-5 h-5 text-white" />
                            <span className="text-xs font-black text-white uppercase tracking-widest">Billing History</span>
                            <ArrowUpRight className="w-4 h-4 text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </motion.button>
                    </div>
                </header>

                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: "Unpaid Orders", value: orders.length.toString(), icon: Receipt, change: undefined, color: "from-orange-500/20 to-orange-600/5" },
                        { label: "Daily Revenue", value: "Rs. 45.6K", icon: DollarSign, change: 12.5, color: "from-emerald-500/20 to-emerald-600/5" },
                        { label: "Average Bill", value: "Rs. 1,525", icon: Calculator, change: undefined, color: "from-blue-500/20 to-blue-600/5" },
                        { label: "Paid Today", value: "28", icon: CheckCircle2, change: 8.2, color: "from-purple-500/20 to-purple-600/5" },
                    ].map((stat) => (
                        <motion.div
                            key={stat.label}
                            variants={item}
                            whileHover={{ y: -5, scale: 1.02 }}
                            className="group"
                        >
                            <div className="relative h-full p-8 rounded-[2.5rem] bg-neutral-900/40 backdrop-blur-3xl border border-neutral-800/50 overflow-hidden transition-all duration-500 hover:border-orange-500/30 shadow-2xl">
                                {/* Internal Glow */}
                                <div className={cn("absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700", stat.color)} />

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="w-12 h-12 rounded-2xl bg-black/40 border border-neutral-800/50 flex items-center justify-center text-neutral-400 group-hover:text-white group-hover:border-orange-500/50 transition-all duration-500 shadow-inner">
                                            <stat.icon className="w-6 h-6" />
                                        </div>
                                        {stat.change !== undefined && (
                                            <div className={cn(
                                                "px-3 py-1 rounded-full text-[10px] font-black tracking-widest border transition-all duration-500",
                                                stat.change >= 0
                                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-black"
                                                    : "bg-rose-500/10 border-rose-500/20 text-rose-500 group-hover:bg-rose-500 group-hover:text-black"
                                            )}>
                                                {stat.change >= 0 ? '↑' : '↓'} {Math.abs(stat.change)}%
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-auto">
                                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-4xl font-black text-white tracking-tighter leading-none">{stat.value}</h3>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                    {/* Orders List */}
                    <motion.div variants={item} className="xl:col-span-4 space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Unpaid Orders</h2>
                            <Badge className="bg-neutral-900 text-neutral-400 border-neutral-800 font-bold">{orders.length}</Badge>
                        </div>
                        <div className="space-y-4">
                            {orders.map((order) => (
                                <motion.div
                                    key={order.id}
                                    whileHover={{ x: 5 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSelectedOrder(order)}
                                    className={cn(
                                        'p-8 cursor-pointer transition-all duration-500 rounded-[2.5rem] border relative overflow-hidden group',
                                        selectedOrder?.id === order.id
                                            ? 'bg-orange-600 border-orange-500 shadow-2xl shadow-orange-600/40'
                                            : 'bg-neutral-900/40 backdrop-blur-3xl border-neutral-800/50 hover:border-neutral-700'
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-8 relative z-10">
                                        <div className="flex items-center gap-5">
                                            <div className={cn(
                                                "w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl transition-all duration-500 shadow-2xl",
                                                selectedOrder?.id === order.id
                                                    ? "bg-white text-orange-600 rotate-3"
                                                    : "bg-black/60 border border-neutral-800 text-neutral-500 group-hover:text-white shadow-inner"
                                            )}>
                                                {order.table_number.split(' ')[1]}
                                            </div>
                                            <div>
                                                <span className={cn("font-black text-2xl tracking-tighter", selectedOrder?.id === order.id ? "text-white" : "text-white")}>#{order.order_number}</span>
                                                <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mt-1", selectedOrder?.id === order.id ? "text-white/70" : "text-neutral-500")}>{order.table_number}</p>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl",
                                            selectedOrder?.id === order.id ? "bg-white/20 text-white" : "bg-orange-600/10 text-orange-600"
                                        )}>
                                            {order.waiter}
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "pt-8 border-t flex justify-between items-center relative z-10",
                                        selectedOrder?.id === order.id ? "border-white/20" : "border-neutral-800/50"
                                    )}>
                                        <span className={cn("text-[10px] font-black uppercase tracking-[0.2em]", selectedOrder?.id === order.id ? "text-white/70" : "text-neutral-500")}>{order.items.length} Items</span>
                                        <span className={cn("text-2xl font-black tracking-tighter", selectedOrder?.id === order.id ? "text-white" : "text-white")}>Rs. {order.total.toLocaleString()}</span>
                                    </div>

                                    {selectedOrder?.id === order.id && (
                                        <motion.div
                                            layoutId="order-glow"
                                            className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/10 to-transparent pointer-none"
                                        />
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Checkout Panel */}
                    <motion.div variants={item} className="xl:col-span-8">
                        {selectedOrder ? (
                            <motion.div
                                key={selectedOrder.id}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="space-y-10"
                            >
                                <div className="p-8 lg:p-12 rounded-[3.5rem] bg-neutral-900/40 backdrop-blur-3xl border border-neutral-800/50 shadow-2xl relative overflow-hidden group">
                                    {/* Ambient Glow */}
                                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-600/[0.03] blur-[100px] rounded-full -z-0 pointer-events-none" />

                                    {/* Order Details Header */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 pb-12 border-b border-neutral-800/50 relative z-10">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-4">
                                                <div className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Ready for Settlement</span>
                                                </div>
                                                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">#{selectedOrder.order_number}</span>
                                            </div>

                                            <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter leading-tight">
                                                ORDER <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent italic">SETTLEMENT</span>
                                            </h2>

                                            <div className="flex items-center gap-3">
                                                <div className="px-4 py-2 bg-neutral-800 rounded-xl text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                                                    Table {selectedOrder.table_number.split(' ')[1]}
                                                </div>
                                                <div className="w-1 h-1 bg-neutral-800 rounded-full" />
                                                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Server: {selectedOrder.waiter}</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <motion.button
                                                whileHover={{ scale: 1.05, y: -2 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => setShowSplitModal(true)}
                                                className="h-14 px-8 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center gap-3 text-neutral-400 hover:text-white transition-all shadow-xl group/btn"
                                            >
                                                <Users className="w-5 h-5 group-hover/btn:text-orange-600 transition-colors" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Split Bill</span>
                                            </motion.button>

                                            <motion.button
                                                whileHover={{ scale: 1.05, y: -2 }}
                                                whileTap={{ scale: 0.95 }}
                                                className="h-14 px-8 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center gap-3 text-neutral-400 hover:text-white transition-all shadow-xl group/btn"
                                            >
                                                <Printer className="w-5 h-5 group-hover/btn:text-blue-500 transition-colors" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Print Receipt</span>
                                            </motion.button>
                                        </div>
                                    </div>

                                    {/* Items & Totals Grid */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 py-12 relative z-10">
                                        {/* Items List */}
                                        <div className="space-y-8">
                                            <div className="flex items-center justify-between px-2">
                                                <h3 className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em]">Itemized Summary</h3>
                                                <span className="text-[10px] font-black text-neutral-700 uppercase tracking-widest">{selectedOrder.items.length} Unique Items</span>
                                            </div>

                                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                                {selectedOrder.items.map((item, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.05 }}
                                                        className="flex justify-between items-center p-6 bg-black/40 border border-neutral-800/50 rounded-3xl group/item hover:border-orange-500/30 transition-all duration-500 shadow-inner"
                                                    >
                                                        <div className="flex items-center gap-5">
                                                            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-orange-600 font-black text-sm transition-all shadow-2xl">
                                                                {item.quantity}
                                                            </div>
                                                            <div>
                                                                <span className="font-black text-white text-base tracking-tight leading-tight">{item.name}</span>
                                                                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mt-1">Rs. {item.price.toLocaleString()} ea</p>
                                                            </div>
                                                        </div>
                                                        <span className="font-black text-neutral-400 text-base tracking-tighter">Rs. {(item.price * item.quantity).toLocaleString()}</span>
                                                    </motion.div>
                                                ))}
                                            </div>

                                            {/* Totals Breakdown */}
                                            <div className="pt-10 space-y-4 border-t border-neutral-800/50 mt-10">
                                                <div className="flex justify-between text-xs font-black uppercase tracking-[0.2em] text-neutral-500 px-2">
                                                    <span>Subtotal</span><span className="text-white tracking-tighter">Rs. {selectedOrder.subtotal.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-xs font-black uppercase tracking-[0.2em] text-neutral-500 px-6 py-4 bg-neutral-900/50 rounded-2xl border border-neutral-800/30">
                                                    <span>Sales Tax (16%)</span><span className="text-white tracking-tighter">Rs. {selectedOrder.tax.toLocaleString()}</span>
                                                </div>
                                                {discount > 0 && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="flex justify-between text-xs font-black uppercase tracking-[0.2em] text-emerald-500 px-6 py-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 shadow-2xl shadow-emerald-500/5"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Tag className="w-4 h-4" />
                                                            <span>Reward Discount</span>
                                                        </div>
                                                        <span className="tracking-tighter">-Rs. {calculateDiscount().toLocaleString()}</span>
                                                    </motion.div>
                                                )}
                                                <div className="flex justify-between items-center pt-10 border-t border-neutral-800/50 mt-8">
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 italic block mb-1">Settlement Total</span>
                                                        <span className="text-[10px] font-black text-neutral-700 uppercase tracking-widest">NET PAYABLE AMOUNT</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <h3 className="text-6xl font-black text-orange-600 tracking-tighter block [text-shadow:_0_0_30px_rgb(234_88_12_/_0.15)] shadow-orange-600/10">Rs. {calculateTotal().toLocaleString()}</h3>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Payment Controls */}
                                        <div className="space-y-12">
                                            {/* Promo Code Card */}
                                            <div className="p-8 bg-black/60 rounded-[3rem] border border-neutral-800/80 shadow-inner space-y-8 relative overflow-hidden group/promo">
                                                <div className="absolute inset-0 bg-gradient-to-br from-orange-600/[0.02] to-transparent pointer-events-none" />
                                                <div className="flex items-center justify-between relative z-10">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em] block">Loyalty & Promos</label>
                                                        <p className="text-[8px] font-black text-neutral-700 uppercase tracking-widest">Apply member discounts</p>
                                                    </div>
                                                    <Sparkles className="w-5 h-5 text-orange-600 animate-pulse" />
                                                </div>

                                                {appliedPromo ? (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="flex items-center justify-between p-8 bg-emerald-500/10 border border-emerald-500/30 rounded-[2.5rem] relative group/applied shadow-2xl shadow-emerald-500/10"
                                                    >
                                                        <div className="flex items-center gap-5">
                                                            <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-2xl">
                                                                <CheckCircle2 className="w-7 h-7 text-black" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <span className="font-black text-emerald-400 tracking-[0.1em] uppercase text-base block">{appliedPromo.code}</span>
                                                                <p className="text-[10px] text-emerald-500/70 uppercase tracking-widest font-black line-clamp-1">{appliedPromo.description}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right">
                                                                <span className="text-2xl font-black text-emerald-400 tracking-tighter">
                                                                    {appliedPromo.type === 'percentage' ? `${appliedPromo.value}%` : `Rs.${appliedPromo.value}`}
                                                                </span>
                                                                <p className="text-[8px] font-black text-emerald-500/50 uppercase tracking-widest mt-1">APPLIED</p>
                                                            </div>
                                                            <motion.button
                                                                whileHover={{ scale: 1.1, rotate: 90 }}
                                                                whileTap={{ scale: 0.9 }}
                                                                onClick={removePromo}
                                                                className="w-12 h-12 rounded-2xl bg-black/60 border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-rose-500 hover:border-rose-500 transition-all shadow-2xl"
                                                            >
                                                                <X className="w-6 h-6" />
                                                            </motion.button>
                                                        </div>
                                                    </motion.div>
                                                ) : (
                                                    <div className="space-y-6 relative z-10">
                                                        <div className="flex gap-4">
                                                            <div className="relative flex-1 group/input">
                                                                <Tag className="w-5 h-5 absolute left-6 top-1/2 -translate-y-1/2 text-neutral-700 group-focus-within/input:text-orange-600 transition-colors" />
                                                                <input
                                                                    type="text"
                                                                    value={promoCode}
                                                                    onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
                                                                    onKeyDown={(e) => e.key === 'Enter' && validatePromoCode()}
                                                                    className="h-16 w-full bg-neutral-900 rounded-3xl pl-16 pr-6 text-base font-black tracking-[0.2em] uppercase outline-none border border-neutral-800/80 focus:border-orange-600 focus:ring-8 focus:ring-orange-600/5 transition-all text-white placeholder:text-neutral-800 shadow-inner"
                                                                    placeholder="PROMO CODE"
                                                                />
                                                            </div>
                                                            <motion.button
                                                                whileHover={{ scale: 1.05 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                onClick={validatePromoCode}
                                                                disabled={isValidatingCode || !promoCode.trim()}
                                                                className="h-16 px-10 bg-orange-600 hover:bg-orange-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-3xl transition-all shadow-2xl shadow-orange-600/30 flex items-center justify-center min-w-[140px]"
                                                            >
                                                                {isValidatingCode ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Apply'}
                                                            </motion.button>
                                                        </div>
                                                        {promoError && (
                                                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-rose-500 font-black uppercase tracking-widest pl-4 flex items-center gap-2">
                                                                <span className="w-1 h-1 bg-rose-500 rounded-full animate-ping" />
                                                                {promoError}
                                                            </motion.p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Manual Discount Control */}
                                                <div className="pt-10 border-t border-neutral-800/50 relative z-10">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-neutral-700 uppercase tracking-widest pl-1">Adjustable Rebate</label>
                                                            <p className="text-[8px] font-black text-neutral-800 uppercase tracking-widest pl-1">Manual discount injection</p>
                                                        </div>
                                                        <div className="flex bg-neutral-900 rounded-2xl p-1.5 gap-2 border border-neutral-800/50 shadow-inner">
                                                            <button
                                                                onClick={() => setDiscountType('percent')}
                                                                disabled={!!appliedPromo}
                                                                className={cn("px-5 py-2.5 rounded-xl flex items-center justify-center font-black text-[10px] transition-all", discountType === 'percent' ? "bg-orange-600 text-white shadow-xl" : "text-neutral-600 hover:text-white")}
                                                            >%</button>
                                                            <button
                                                                onClick={() => setDiscountType('fixed')}
                                                                disabled={!!appliedPromo}
                                                                className={cn("px-5 py-2.5 rounded-xl flex items-center justify-center font-black text-[10px] transition-all", discountType === 'fixed' ? "bg-orange-600 text-white shadow-xl" : "text-neutral-600 hover:text-white")}
                                                            >RS</button>
                                                        </div>
                                                    </div>
                                                    <div className="relative group/input">
                                                        <Calculator className="w-5 h-5 absolute left-6 top-1/2 -translate-y-1/2 text-neutral-700 group-focus-within/input:text-orange-600 transition-colors" />
                                                        <input
                                                            type="number"
                                                            value={discount || ''}
                                                            onChange={(e) => { setDiscount(parseFloat(e.target.value) || 0); setAppliedPromo(null); }}
                                                            className="h-16 w-full bg-neutral-900 rounded-3xl pl-16 pr-6 text-base font-black outline-none border border-neutral-800/80 focus:border-orange-600 focus:ring-8 focus:ring-orange-600/5 transition-all text-white placeholder:text-neutral-800 shadow-inner tracking-tight"
                                                            placeholder="0.00"
                                                            disabled={!!appliedPromo}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Payment Method Selection */}
                                            <div className="space-y-8">
                                                <div className="flex items-center justify-between px-1">
                                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em] block">Settlement Channel</label>
                                                    <div className="h-0.5 flex-1 mx-6 bg-gradient-to-r from-neutral-800 to-transparent opacity-30" />
                                                </div>

                                                <div className="grid grid-cols-3 gap-6">
                                                    {([
                                                        { id: 'cash', label: 'CASH', icon: Banknote, color: "orange" },
                                                        { id: 'card', label: 'CARD', icon: CreditCard, color: "blue" },
                                                        { id: 'mobile', label: 'MOBILE', icon: Smartphone, color: "purple" },
                                                    ] as const).map((method) => (
                                                        <motion.button
                                                            whileHover={{ scale: 1.05, y: -5 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            key={method.id}
                                                            onClick={() => setPaymentMethod(method.id)}
                                                            className={cn(
                                                                'p-8 h-32 rounded-[2.5rem] border flex flex-col items-center justify-center gap-4 transition-all duration-500 relative overflow-hidden group shadow-xl',
                                                                paymentMethod === method.id
                                                                    ? 'border-orange-500 bg-orange-600/10 text-orange-500 shadow-orange-600/20'
                                                                    : 'border-neutral-800/60 bg-black/40 text-neutral-600 hover:border-neutral-700'
                                                            )}
                                                        >
                                                            {paymentMethod === method.id && (
                                                                <motion.div layoutId="payment-glow" className="absolute inset-0 bg-orange-600 opacity-[0.03] shadow-[0_0_50px_rgba(234,88,12,0.4)]" />
                                                            )}
                                                            <method.icon className={cn("w-8 h-8 transition-all duration-500", paymentMethod === method.id ? "scale-125 rotate-6 text-orange-500" : "group-hover:text-white")} />
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{method.label}</span>
                                                        </motion.button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Cash Flow Logic */}
                                            <AnimatePresence mode="wait">
                                                {paymentMethod === 'cash' && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                                                        className="space-y-8 overflow-hidden"
                                                    >
                                                        <div className="p-10 bg-black/40 rounded-[3rem] border border-neutral-800/80 shadow-inner relative group/cash">
                                                            <div className="flex items-center justify-between mb-8">
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em]">Cash Tendered</label>
                                                                    <p className="text-[8px] font-black text-neutral-700 uppercase tracking-widest pl-1">Amount payload from guest</p>
                                                                </div>
                                                                <div className="px-3 py-1 bg-emerald-500/10 rounded-lg text-[8px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Live change calculation</div>
                                                            </div>

                                                            <div className="relative group/input mb-8">
                                                                <Banknote className="w-7 h-7 absolute left-8 top-1/2 -translate-y-1/2 text-neutral-700 group-focus-within/input:text-emerald-500 transition-all duration-500" />
                                                                <input
                                                                    type="number"
                                                                    value={cashReceived || ''}
                                                                    onChange={(e) => setCashReceived(e.target.value)}
                                                                    placeholder="0.00"
                                                                    className="h-24 w-full bg-neutral-900/50 rounded-[2.5rem] pl-20 pr-10 text-4xl font-black outline-none border border-neutral-800/80 focus:border-emerald-500/50 focus:ring-8 focus:ring-emerald-500/5 transition-all text-white placeholder:text-neutral-800 shadow-inner tracking-tighter"
                                                                />
                                                            </div>

                                                            <div className="flex flex-wrap gap-3">
                                                                {quickAmounts.map((amt) => (
                                                                    <motion.button
                                                                        whileHover={{ y: -4, scale: 1.05 }}
                                                                        whileTap={{ scale: 0.95 }}
                                                                        key={amt}
                                                                        onClick={() => setCashReceived(amt.toString())}
                                                                        className="h-14 px-8 rounded-2xl border border-neutral-800 bg-neutral-950 text-xs font-black text-neutral-500 uppercase hover:border-orange-500/50 hover:text-white transition-all shadow-2xl"
                                                                    >Rs. {amt}</motion.button>
                                                                ))}
                                                                <motion.button
                                                                    whileHover={{ y: -4, scale: 1.05 }}
                                                                    whileTap={{ scale: 0.95 }}
                                                                    onClick={() => setCashReceived(calculateTotal().toString())}
                                                                    className="h-14 px-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-black text-emerald-500 uppercase hover:bg-emerald-500 hover:text-white transition-all shadow-xl ml-auto"
                                                                >EXACT AMOUNT</motion.button>
                                                            </div>
                                                        </div>

                                                        {parseFloat(cashReceived) >= calculateTotal() && (
                                                            <motion.div
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                className="p-10 bg-emerald-500/10 border border-emerald-500/30 rounded-[3rem] flex items-center justify-between shadow-2xl shadow-emerald-500/10 relative overflow-hidden group/refund"
                                                            >
                                                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.05] to-transparent pointer-none" />
                                                                <div className="flex items-center gap-6 relative z-10">
                                                                    <div className="w-16 h-16 bg-emerald-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-500/40 rotate-12 transition-transform group-hover/refund:rotate-0 duration-500">
                                                                        <Check className="w-8 h-8 text-black font-black" />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Refundable Balance</span>
                                                                        <p className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest block">Change to return to guest</p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right relative z-10">
                                                                    <span className="text-5xl font-black text-emerald-500 tracking-tighter block shadow-emerald-500/10 [text-shadow:_0_0_30px_rgb(16_185_129_/_0.2)]">Rs. {calculateChange().toLocaleString()}</span>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Final Execution Button */}
                                            <div className="pt-4">
                                                <motion.button
                                                    whileHover={{ scale: 1.02, y: -4 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    disabled={isProcessing || (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < calculateTotal()))}
                                                    onClick={handleProcessPayment}
                                                    className={cn(
                                                        "w-full h-28 rounded-[3.5rem] font-black uppercase tracking-[0.4em] text-base relative overflow-hidden transition-all duration-700 shadow-2xl flex items-center justify-center gap-6",
                                                        (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < calculateTotal()))
                                                            ? "bg-neutral-800 text-neutral-600 grayscale cursor-not-allowed border border-neutral-700/50"
                                                            : "bg-orange-600 text-white shadow-orange-600/40 hover:bg-orange-500 border border-orange-400/20"
                                                    )}
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] hover:animate-[shimmer_2s_infinite] pointer-events-none" />

                                                    {isProcessing ? (
                                                        <Loader2 className="w-10 h-10 animate-spin" />
                                                    ) : (
                                                        <>
                                                            COMPLETE SETTLEMENT <CheckCircle2 className="w-7 h-7" />
                                                        </>
                                                    )}
                                                </motion.button>
                                                <p className="text-[8px] font-black text-neutral-700 uppercase tracking-[0.5em] text-center mt-6">Secure Cloud Processing • Nexus Premium Engine</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="h-full flex items-center justify-center p-12">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-center space-y-8"
                                >
                                    <div className="relative inline-block">
                                        <div className="absolute inset-0 bg-orange-600/20 blur-[60px] rounded-full animate-pulse" />
                                        <div className="relative w-32 h-32 bg-neutral-900/50 backdrop-blur-3xl border border-neutral-800 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl">
                                            <Receipt className="w-12 h-12 text-neutral-700" />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <h3 className="text-3xl font-black text-white tracking-tighter">SELECT AN <span className="text-orange-600 italic">ORDER</span></h3>
                                        <p className="text-neutral-500 font-bold max-w-xs mx-auto text-sm leading-relaxed">
                                            Choose an active unpaid order from the sidebar to begin the checkout process.
                                        </p>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* Split Bill Modal wrapper */}
                {selectedOrder && (
                    <SplitBillModal
                        isOpen={showSplitModal}
                        onClose={() => setShowSplitModal(false)}
                        order={{
                            id: selectedOrder.id,
                            restaurant_id: '',
                            table_id: '',
                            staff_id: null,
                            order_number: selectedOrder.order_number,
                            status: 'pending',
                            subtotal: selectedOrder.subtotal,
                            tax: selectedOrder.tax,
                            discount: 0,
                            total: selectedOrder.total,
                            notes: null,
                            is_priority: false,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                            items: selectedOrder.items.map((item, i) => ({
                                id: `item-${i}`,
                                order_id: selectedOrder.id,
                                menu_item_id: `menu-${i}`,
                                quantity: item.quantity,
                                unit_price: item.price,
                                subtotal: item.price * item.quantity,
                                special_instructions: null,
                                customizations: [],
                                status: 'pending',
                                created_at: new Date().toISOString(),
                                menu_item: {
                                    id: `menu-${i}`,
                                    restaurant_id: '',
                                    category_id: '',
                                    name: item.name,
                                    price: item.price,
                                    description: null,
                                    image_url: null,
                                    dietary_tags: [],
                                    customizations: [],
                                    is_available: true,
                                    is_special: false,
                                    special_until: null,
                                    preparation_time: null,
                                    display_order: 0,
                                    created_at: '',
                                    updated_at: ''
                                }
                            })) as OrderItem[]
                        } as Order}
                        onComplete={handleSplitComplete}
                    />
                )}
            </motion.div>
        </div>
    )
}
