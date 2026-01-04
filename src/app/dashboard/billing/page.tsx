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
    Loader2
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
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-12 pb-24"
        >
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <Badge variant="outline" className="bg-orange-600/10 text-orange-600 border-orange-600/20 px-3 py-1 font-bold uppercase text-[10px] tracking-widest">
                            ● Checkout Station
                        </Badge>
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Payments</span>
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white mb-2 uppercase">
                        Checkout <span className="text-orange-600">& Billing</span>
                    </h1>
                    <p className="text-neutral-500 font-medium text-lg">
                        Processing <span className="text-white font-bold">{orders.length} unpaid orders</span>.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        className="h-14 px-8 border-neutral-800 text-neutral-400 font-bold text-xs uppercase tracking-widest hover:bg-white hover:text-neutral-900 hover:border-white transition-all"
                        icon={Calculator}
                    >
                        Daily Report
                    </Button>
                    <Button className="h-14 px-10 bg-orange-600 hover:bg-orange-500 text-white shadow-lg font-bold uppercase tracking-widest text-xs border-none group">
                        Billing History <ArrowUpRight className="ml-2 w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </Button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Unpaid Orders", value: orders.length.toString(), icon: Receipt, change: undefined },
                    { label: "Daily Revenue", value: "Rs. 45.6K", icon: DollarSign, change: 12.5 },
                    { label: "Average Bill", value: "Rs. 1,525", icon: Calculator, change: undefined },
                    { label: "Paid Today", value: "28", icon: CheckCircle2, change: 8.2 },
                ].map((stat) => (
                    <motion.div key={stat.label} variants={item}>
                        <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-xl relative overflow-hidden group h-full">
                            <div className="relative z-10 flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4">{stat.label}</p>
                                    <h3 className="text-3xl font-bold text-white tracking-tight">{stat.value}</h3>
                                    {stat.change !== undefined && (
                                        <div className="flex items-center gap-2 mt-4">
                                            <span className={cn("text-[10px] font-bold uppercase tracking-widest", stat.change >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                                {stat.change >= 0 ? '+' : '-'}{Math.abs(stat.change)}%
                                            </span>
                                            <span className="text-[10px] font-medium text-neutral-600">from yesterday</span>
                                        </div>
                                    )}
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-orange-600 group-hover:border-orange-600 transition-all shadow-inner">
                                    <stat.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </Card>
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
                            <Card
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className={cn(
                                    'p-6 cursor-pointer transition-all border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 group relative',
                                    selectedOrder?.id === order.id ? 'border-orange-600 bg-neutral-900 shadow-xl' : 'hover:border-neutral-700'
                                )}
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg transition-colors",
                                            selectedOrder?.id === order.id ? "bg-orange-600 text-white" : "bg-black border border-neutral-800 text-neutral-500 group-hover:text-white"
                                        )}>
                                            {order.table_number.split(' ')[1]}
                                        </div>
                                        <div>
                                            <span className="font-bold text-white text-lg">#{order.order_number}</span>
                                            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mt-1">{order.table_number}</p>
                                        </div>
                                    </div>
                                    <Badge className="bg-orange-500/10 text-orange-600 border-none font-bold text-[10px] uppercase">{order.waiter}</Badge>
                                </div>
                                <div className="pt-6 border-t border-neutral-800/50 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{order.items.length} Items</span>
                                    <span className="text-xl font-bold text-white">Rs. {order.total.toLocaleString()}</span>
                                </div>
                                {selectedOrder?.id === order.id && (
                                    <motion.div layoutId="active-indicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-orange-600 rounded-r-full" />
                                )}
                            </Card>
                        ))}
                    </div>
                </motion.div>

                {/* Payment Panel */}
                <motion.div variants={item} className="xl:col-span-8">
                    <AnimatePresence mode="wait">
                        {selectedOrder ? (
                            <motion.div
                                key={selectedOrder.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <Card className="bg-neutral-900 border-neutral-800 p-6 lg:p-8 shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/[0.02] rounded-bl-full -z-0" />

                                    {/* Order Details */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-8 border-b border-neutral-800 relative z-10">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <Badge className="bg-orange-600 text-white border-none font-bold text-[10px] uppercase tracking-widest">Ready for Payment</Badge>
                                                <h2 className="text-3xl font-bold text-white tracking-tight">Order <span className="text-orange-600">#{selectedOrder.order_number}</span></h2>
                                            </div>
                                            <p className="text-sm text-neutral-500 font-bold uppercase tracking-widest">{selectedOrder.table_number} • Waiter: {selectedOrder.waiter}</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <Button variant="outline" className="h-12 px-6 border-neutral-800 text-neutral-400 font-bold text-[10px] uppercase tracking-widest hover:bg-white hover:text-black transition-all" icon={Users} onClick={() => setShowSplitModal(true)}>Split Bill</Button>
                                            <Button variant="outline" className="h-12 px-6 border-neutral-800 text-neutral-400 font-bold text-[10px] uppercase tracking-widest hover:bg-white hover:text-black transition-all" icon={Printer}>Print Bill</Button>
                                        </div>
                                    </div>

                                    {/* Items & Totals Grid */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 py-10 relative z-10">
                                        {/* Items */}
                                        <div className="space-y-6">
                                            <h3 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-6">Order Summary</h3>
                                            <div className="space-y-3">
                                                {selectedOrder.items.map((item, i) => (
                                                    <div key={i} className="flex justify-between items-center p-5 bg-black border border-neutral-800 rounded-xl group hover:border-orange-600/50 transition-colors">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-orange-600 font-bold text-[10px] transition-all">
                                                                x{item.quantity}
                                                            </div>
                                                            <span className="font-bold text-white text-sm">{item.name}</span>
                                                        </div>
                                                        <span className="font-bold text-neutral-400 text-sm">Rs. {(item.price * item.quantity).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Totals */}
                                            <div className="pt-8 space-y-3 border-t border-neutral-800/50">
                                                <div className="flex justify-between text-[11px] font-bold uppercase text-neutral-500">
                                                    <span>Subtotal</span><span>Rs. {selectedOrder.subtotal.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-[11px] font-bold uppercase text-neutral-500">
                                                    <span>Sales Tax (16%)</span><span>Rs. {selectedOrder.tax.toLocaleString()}</span>
                                                </div>
                                                {discount > 0 && (
                                                    <div className="flex justify-between text-[11px] font-bold uppercase text-emerald-500">
                                                        <span>Discount</span><span>-Rs. {calculateDiscount().toLocaleString()}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-3xl font-bold text-white pt-6 border-t border-neutral-800 mt-4">
                                                    <span className="text-xs uppercase tracking-widest text-neutral-500 self-center">Grand Total</span>
                                                    <span className="text-orange-600">Rs. {calculateTotal().toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Payment Controls */}
                                        <div className="space-y-8">
                                            {/* Promo Code & Discount Control */}
                                            <div className="p-6 bg-black rounded-2xl border border-neutral-800 space-y-4">
                                                <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest block">Promo Code</label>

                                                {appliedPromo ? (
                                                    <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-emerald-400 tracking-widest">{appliedPromo.code}</span>
                                                                <p className="text-[10px] text-emerald-500/70 uppercase tracking-widest">{appliedPromo.description}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-lg font-bold text-emerald-400">
                                                                {appliedPromo.type === 'percentage' ? `${appliedPromo.value}% OFF` : `Rs.${appliedPromo.value} OFF`}
                                                            </span>
                                                            <button onClick={removePromo} className="w-8 h-8 rounded-lg bg-black border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-rose-500 hover:border-rose-500 transition-all">
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex gap-3">
                                                            <div className="relative flex-1 group">
                                                                <Tag className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-700 group-focus-within:text-orange-600 transition-colors" />
                                                                <input
                                                                    type="text"
                                                                    value={promoCode}
                                                                    onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
                                                                    onKeyDown={(e) => e.key === 'Enter' && validatePromoCode()}
                                                                    className="h-14 w-full bg-neutral-900 rounded-xl pl-12 pr-4 text-sm font-bold tracking-widest uppercase outline-none border border-neutral-800 focus:border-orange-600 transition-all text-white placeholder:text-neutral-700"
                                                                    placeholder="ENTER CODE"
                                                                />
                                                            </div>
                                                            <button
                                                                onClick={validatePromoCode}
                                                                disabled={isValidatingCode || !promoCode.trim()}
                                                                className="h-14 px-6 bg-orange-600 hover:bg-orange-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
                                                            >
                                                                {isValidatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                                                            </button>
                                                        </div>
                                                        {promoError && (
                                                            <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">{promoError}</p>
                                                        )}
                                                    </>
                                                )}

                                                {/* Manual Discount */}
                                                <div className="pt-4 border-t border-neutral-800">
                                                    <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-3 block">Or Manual Discount</label>
                                                    <div className="flex gap-3">
                                                        <div className="relative flex-1 group">
                                                            <Percent className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-700 group-focus-within:text-orange-600 transition-colors" />
                                                            <input
                                                                type="number"
                                                                value={discount}
                                                                onChange={(e) => { setDiscount(parseFloat(e.target.value) || 0); setAppliedPromo(null); }}
                                                                className="h-12 w-full bg-neutral-900 rounded-xl pl-12 pr-4 text-sm font-bold tracking-tight outline-none border border-neutral-800 focus:border-orange-600 transition-all text-white"
                                                                placeholder="0"
                                                                disabled={!!appliedPromo}
                                                            />
                                                        </div>
                                                        <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1 gap-1">
                                                            <button
                                                                onClick={() => setDiscountType('percent')}
                                                                disabled={!!appliedPromo}
                                                                className={cn("w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs transition-all", discountType === 'percent' ? "bg-orange-600 text-white shadow-md" : "text-neutral-600 hover:text-white")}
                                                            >%</button>
                                                            <button
                                                                onClick={() => setDiscountType('fixed')}
                                                                disabled={!!appliedPromo}
                                                                className={cn("w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs transition-all", discountType === 'fixed' ? "bg-orange-600 text-white shadow-md" : "text-neutral-600 hover:text-white")}
                                                            >Rs</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Payment Method */}
                                            <div>
                                                <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-4 block">Select Payment</label>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {([
                                                        { id: 'cash', label: 'Cash', icon: Banknote },
                                                        { id: 'card', label: 'Card', icon: CreditCard },
                                                        { id: 'mobile', label: 'Transfer', icon: Smartphone },
                                                    ] as const).map((method) => (
                                                        <button
                                                            key={method.id}
                                                            onClick={() => setPaymentMethod(method.id)}
                                                            className={cn(
                                                                'p-4 h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all group',
                                                                paymentMethod === method.id
                                                                    ? 'border-orange-600 bg-orange-600/5 text-orange-600 shadow-lg'
                                                                    : 'border-neutral-800 bg-black text-neutral-600 hover:border-neutral-700 hover:text-neutral-400'
                                                            )}
                                                        >
                                                            <method.icon className={cn("w-5 h-5 transition-transform", paymentMethod === method.id ? "scale-110" : "group-hover:scale-110")} />
                                                            <span className="text-[10px] font-bold uppercase tracking-widest">{method.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Cash Flow */}
                                            {paymentMethod === 'cash' && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="space-y-4"
                                                >
                                                    <div className="p-6 bg-black rounded-2xl border border-neutral-800">
                                                        <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-4 block">Cash Received</label>
                                                        <div className="relative group">
                                                            <Banknote className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-700 group-focus-within:text-emerald-500 transition-colors" />
                                                            <input
                                                                type="number"
                                                                value={cashReceived}
                                                                onChange={(e) => setCashReceived(e.target.value)}
                                                                placeholder="Amount received"
                                                                className="h-14 w-full bg-neutral-900 rounded-xl pl-12 pr-4 text-sm font-bold outline-none border border-neutral-800 focus:border-emerald-500 transition-all text-white"
                                                            />
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 mt-4">
                                                            {quickAmounts.map((amt) => (
                                                                <button key={amt} onClick={() => setCashReceived(amt.toString())} className="h-9 px-4 rounded-lg border border-neutral-800 bg-neutral-900 text-[10px] font-bold text-neutral-500 uppercase hover:border-orange-600 hover:text-orange-600 transition-all">Rs. {amt}</button>
                                                            ))}
                                                            <button onClick={() => setCashReceived(calculateTotal().toString())} className="h-9 px-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold text-emerald-500 uppercase hover:bg-emerald-500 hover:text-white transition-all">Exact Amount</button>
                                                        </div>
                                                    </div>
                                                    {parseFloat(cashReceived) >= calculateTotal() && (
                                                        <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Balance to Return</span>
                                                            <span className="text-2xl font-bold text-emerald-500">Rs. {calculateChange().toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}

                                            {/* Action */}
                                            <Button
                                                variant="primary"
                                                className="w-full h-20 bg-orange-600 hover:bg-orange-500 text-white shadow-xl font-bold uppercase tracking-widest text-sm border-none group relative overflow-hidden"
                                                isLoading={isProcessing}
                                                onClick={handleProcessPayment}
                                                disabled={paymentMethod === 'cash' && parseFloat(cashReceived) < calculateTotal()}
                                            >
                                                <span className="relative z-10 flex items-center justify-center gap-3">
                                                    Complete Payment <Check className="w-5 h-5" />
                                                </span>
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ) : (
                            <Card className="h-[70vh] border-dashed border-neutral-800 bg-black flex flex-col items-center justify-center text-center p-10">
                                <div className="relative mb-8 group">
                                    <div className="absolute inset-0 bg-orange-600/10 blur-3xl rounded-full group-hover:bg-orange-600/20 transition-all animate-pulse" />
                                    <div className="w-24 h-24 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center relative shadow-inner overflow-hidden">
                                        <Receipt className="w-10 h-10 text-neutral-600 group-hover:text-orange-600 transition-all duration-500" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-white tracking-tight mb-3">Select an Order</h2>
                                <p className="text-neutral-500 max-w-sm font-bold text-[10px] uppercase tracking-widest leading-relaxed">
                                    Select a pending order from the list on the left to start the payment process.
                                </p>
                            </Card>
                        )}
                    </AnimatePresence>
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
    )
}
