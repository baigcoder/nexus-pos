'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X,
    Users,
    ShoppingBag,
    Calculator,
    CreditCard,
    Banknote,
    Smartphone,
    Check,
    Loader2,
    ArrowRight
} from 'lucide-react'
import { Modal, Button, Badge, Input } from '@/components/ui/common'
import { cn } from '@/lib/utils'
import type { Order, OrderItem, SplitType, PaymentMethod } from '@/types'

interface SplitBillModalProps {
    isOpen: boolean
    onClose: () => void
    order: Order
    onComplete: (splits: SplitPaymentData[]) => void
}

export interface SplitPaymentData {
    splitNumber: number
    amount: number
    items?: string[]  // order item IDs
    paymentMethod?: PaymentMethod
    label?: string
}

const paymentMethods = [
    { id: 'cash' as PaymentMethod, label: 'Cash', icon: Banknote },
    { id: 'card' as PaymentMethod, label: 'Card', icon: CreditCard },
    { id: 'mobile' as PaymentMethod, label: 'Mobile', icon: Smartphone },
]

export function SplitBillModal({ isOpen, onClose, order, onComplete }: SplitBillModalProps) {
    const [splitType, setSplitType] = useState<SplitType>('equal')
    const [splitCount, setSplitCount] = useState(2)
    const [customAmounts, setCustomAmounts] = useState<number[]>([])
    const [selectedItems, setSelectedItems] = useState<Map<number, string[]>>(new Map()) // splitIndex -> itemIds
    const [currentSplit, setCurrentSplit] = useState(0)
    const [paymentMethods_, setPaymentMethods_] = useState<(PaymentMethod | null)[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const [step, setStep] = useState<'configure' | 'payment'>('configure')

    const orderTotal = order.total

    // Calculate split amounts based on type
    const splits = useMemo(() => {
        if (splitType === 'equal') {
            const amount = Math.ceil(orderTotal / splitCount)
            const lastAmount = orderTotal - (amount * (splitCount - 1))
            return Array.from({ length: splitCount }, (_, i) => ({
                splitNumber: i + 1,
                amount: i === splitCount - 1 ? lastAmount : amount,
                label: `GUEST ${String(i + 1).padStart(2, '0')}`
            }))
        } else if (splitType === 'by_items') {
            const splitAmounts: SplitPaymentData[] = []
            selectedItems.forEach((itemIds, splitIndex) => {
                const items = order.items?.filter(item => itemIds.includes(item.id)) || []
                const amount = items.reduce((sum, item) => sum + item.subtotal, 0)
                splitAmounts.push({
                    splitNumber: splitIndex + 1,
                    amount: Math.round(amount * (1 + (order.tax / order.subtotal))),
                    items: itemIds,
                    label: `GUEST ${String(splitIndex + 1).padStart(2, '0')}`
                })
            })
            return splitAmounts
        } else {
            return customAmounts.map((amount, i) => ({
                splitNumber: i + 1,
                amount,
                label: `GUEST ${String(i + 1).padStart(2, '0')}`
            }))
        }
    }, [splitType, splitCount, orderTotal, selectedItems, customAmounts, order])

    const handleItemToggle = (splitIndex: number, itemId: string) => {
        const newSelected = new Map(selectedItems)
        const currentItems = newSelected.get(splitIndex) || []

        newSelected.forEach((items, idx) => {
            if (idx !== splitIndex) {
                newSelected.set(idx, items.filter(id => id !== itemId))
            }
        })

        if (currentItems.includes(itemId)) {
            newSelected.set(splitIndex, currentItems.filter(id => id !== itemId))
        } else {
            newSelected.set(splitIndex, [...currentItems, itemId])
        }

        setSelectedItems(newSelected)
    }

    const handleCustomAmountChange = (index: number, value: number) => {
        const newAmounts = [...customAmounts]
        newAmounts[index] = value
        setCustomAmounts(newAmounts)
    }

    const addCustomSplit = () => {
        setCustomAmounts([...customAmounts, 0])
    }

    const removeCustomSplit = (index: number) => {
        setCustomAmounts(customAmounts.filter((_, i) => i !== index))
    }

    const handlePaymentSelect = (splitIndex: number, method: PaymentMethod) => {
        const newMethods = [...paymentMethods_]
        newMethods[splitIndex] = method
        setPaymentMethods_(newMethods)
    }

    const handleComplete = () => {
        setIsProcessing(true)
        const finalSplits: SplitPaymentData[] = splits.map((split, i) => ({
            ...split,
            paymentMethod: paymentMethods_[i] || 'cash'
        }))
        setTimeout(() => {
            onComplete(finalSplits)
            setIsProcessing(false)
        }, 1500)
    }

    const totalAllocated = splits.reduce((sum, s) => sum + s.amount, 0)
    const isValid = splitType === 'equal' ||
        (splitType === 'by_items' && totalAllocated >= orderTotal * 0.99) ||
        (splitType === 'custom' && Math.abs(totalAllocated - orderTotal) < 1)

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Split Bill"
            className="!bg-neutral-950 !border-neutral-800 !rounded-[3.5rem] !max-w-3xl overflow-hidden"
        >
            <div className="relative">
                {/* Ambient Backgrounds */}
                <div className="absolute top-0 left-1/4 w-64 h-64 bg-orange-600/5 blur-[100px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />

                <div className="space-y-10 relative z-10 px-2 py-4">
                    {/* Progress Header */}
                    <div className="flex items-center gap-6">
                        <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all shadow-2xl",
                            step === 'configure' ? "bg-orange-600 text-white" : "bg-neutral-900 text-neutral-500 border border-neutral-800"
                        )}>1</div>
                        <div className="h-0.5 flex-1 bg-neutral-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-orange-600"
                                initial={{ width: "0%" }}
                                animate={{ width: step === 'payment' ? "100%" : "0%" }}
                            />
                        </div>
                        <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all shadow-2xl",
                            step === 'payment' ? "bg-orange-600 text-white" : "bg-neutral-900 text-neutral-500 border border-neutral-800"
                        )}>2</div>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-4xl font-black text-white tracking-tighter leading-tight uppercase">
                            {step === 'configure' ? 'Configure ' : 'Complete '}
                            <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent italic">Settlement</span>
                        </h2>
                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest pl-1">
                            {step === 'configure' ? 'Define how guests will divide the check' : 'Process individual payments for each split'}
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {step === 'configure' ? (
                            <motion.div
                                key="configure"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-10"
                            >
                                {/* Split Type Selector */}
                                <div className="grid grid-cols-3 gap-6">
                                    {[
                                        { type: 'equal' as SplitType, label: 'EQUAL', icon: Users, desc: 'Even Division' },
                                        { type: 'by_items' as SplitType, label: 'BY ITEMS', icon: ShoppingBag, desc: 'Selected Items' },
                                        { type: 'custom' as SplitType, label: 'CUSTOM', icon: Calculator, desc: 'Entered Amounts' },
                                    ].map(({ type, label, icon: Icon, desc }) => (
                                        <motion.button
                                            whileHover={{ scale: 1.05, y: -4 }}
                                            whileTap={{ scale: 0.95 }}
                                            key={type}
                                            onClick={() => {
                                                setSplitType(type)
                                                if (type === 'custom' && customAmounts.length === 0) setCustomAmounts([0, 0])
                                                if (type === 'by_items' && selectedItems.size === 0) setSelectedItems(new Map([[0, []], [1, []]]))
                                            }}
                                            className={cn(
                                                'p-8 rounded-[2.5rem] border-2 text-center transition-all duration-500 relative overflow-hidden group shadow-xl',
                                                splitType === type
                                                    ? 'border-orange-500 bg-orange-600/10'
                                                    : 'border-neutral-800 bg-black/40 hover:border-neutral-700'
                                            )}
                                        >
                                            <Icon className={cn('w-8 h-8 mx-auto mb-4', splitType === type ? 'text-orange-500' : 'text-neutral-600 group-hover:text-neutral-400')} />
                                            <p className={cn("font-black text-[10px] uppercase tracking-widest", splitType === type ? 'text-white' : 'text-neutral-500')}>{label}</p>
                                            <p className="text-[8px] font-black text-neutral-700 uppercase tracking-widest mt-1">{desc}</p>
                                        </motion.button>
                                    ))}
                                </div>

                                {/* Dynamic Configuration Area */}
                                <div className="p-8 bg-neutral-900/40 rounded-[3rem] border border-neutral-800/50 shadow-inner">
                                    {splitType === 'equal' && (
                                        <div className="space-y-8">
                                            <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest block pl-2">GUEST COUNT</label>
                                            <div className="flex justify-between items-center gap-4">
                                                {[2, 3, 4, 5, 6].map(n => (
                                                    <motion.button
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.9 }}
                                                        key={n}
                                                        onClick={() => setSplitCount(n)}
                                                        className={cn(
                                                            'w-16 h-16 rounded-2xl border-2 font-black transition-all duration-500 shadow-xl',
                                                            splitCount === n
                                                                ? 'border-orange-600 bg-orange-600 text-white shadow-orange-600/20 scale-110'
                                                                : 'border-neutral-800 bg-black text-neutral-500 hover:border-neutral-600'
                                                        )}
                                                    >
                                                        {n}
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {splitType === 'by_items' && (
                                        <div className="space-y-8">
                                            <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                                                {Array.from(selectedItems.keys()).map(idx => (
                                                    <motion.button
                                                        key={idx}
                                                        onClick={() => setCurrentSplit(idx)}
                                                        className={cn(
                                                            'px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap shadow-xl border',
                                                            currentSplit === idx
                                                                ? 'bg-orange-600 text-white border-orange-500'
                                                                : 'bg-black/60 text-neutral-500 border-neutral-800 hover:border-neutral-700'
                                                        )}
                                                    >
                                                        GUEST {String(idx + 1).padStart(2, '0')}
                                                    </motion.button>
                                                ))}
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    onClick={() => {
                                                        const newMap = new Map(selectedItems)
                                                        newMap.set(selectedItems.size, [])
                                                        setSelectedItems(newMap)
                                                    }}
                                                    className="px-6 py-4 rounded-2xl border-2 border-dashed border-neutral-800 text-neutral-700 hover:text-orange-500 hover:border-orange-500/50 transition-all font-black text-[10px] uppercase tracking-widest whitespace-nowrap"
                                                >
                                                    + ADD GUEST
                                                </motion.button>
                                            </div>

                                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                                {order.items?.map(item => {
                                                    const assignedTo = Array.from(selectedItems.entries()).find(([_, items]) => items.includes(item.id))?.[0]
                                                    const isSelected = selectedItems.get(currentSplit)?.includes(item.id)

                                                    return (
                                                        <motion.button
                                                            whileHover={{ x: 4 }}
                                                            key={item.id}
                                                            onClick={() => handleItemToggle(currentSplit, item.id)}
                                                            className={cn(
                                                                'w-full flex items-center justify-between p-6 rounded-2xl border transition-all duration-300 shadow-lg group/item',
                                                                isSelected
                                                                    ? 'border-orange-500 bg-orange-600/10'
                                                                    : assignedTo !== undefined
                                                                        ? 'border-emerald-500/30 bg-emerald-500/5 opacity-60'
                                                                        : 'border-neutral-800 bg-black/40 hover:border-neutral-700'
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-5">
                                                                <div className={cn(
                                                                    "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] shadow-2xl",
                                                                    isSelected ? "bg-orange-600 text-white" : "bg-neutral-900 text-neutral-500"
                                                                )}>
                                                                    {item.quantity}
                                                                </div>
                                                                <span className={cn("font-black tracking-tight text-sm", isSelected ? "text-white" : "text-neutral-400 group-hover/item:text-white")}>{item.menu_item?.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="font-black text-neutral-500 tracking-tighter text-sm">Rs. {item.subtotal}</span>
                                                                {assignedTo !== undefined && (
                                                                    <div className="bg-emerald-500 text-black text-[8px] font-black px-2 py-1 rounded-md tracking-tighter shadow-lg shadow-emerald-500/20">G{assignedTo + 1}</div>
                                                                )}
                                                            </div>
                                                        </motion.button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {splitType === 'custom' && (
                                        <div className="space-y-6">
                                            {customAmounts.map((amount, i) => (
                                                <div key={i} className="flex items-center gap-6">
                                                    <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest w-24">Guest {i + 1}</span>
                                                    <div className="relative group/input flex-1">
                                                        <Banknote className="w-5 h-5 absolute left-6 top-1/2 -translate-y-1/2 text-neutral-800 group-focus-within/input:text-orange-500 transition-colors" />
                                                        <input
                                                            type="number"
                                                            value={amount || ''}
                                                            onChange={(e) => handleCustomAmountChange(i, parseFloat(e.target.value) || 0)}
                                                            className="h-16 w-full bg-black/60 rounded-[1.5rem] pl-16 pr-6 text-base font-black outline-none border border-neutral-800 focus:border-orange-600 transition-all text-white placeholder:text-neutral-900 shadow-inner"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    {customAmounts.length > 2 && (
                                                        <button
                                                            onClick={() => removeCustomSplit(i)}
                                                            className="w-16 h-16 rounded-[1.5rem] bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-xl shadow-rose-500/5 group"
                                                        >
                                                            <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                onClick={addCustomSplit}
                                                className="w-full p-6 rounded-[1.5rem] border-2 border-dashed border-neutral-800 text-neutral-700 hover:text-orange-500 hover:border-orange-500/50 transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-inner"
                                            >
                                                + ADD GUEST ENTRY
                                            </motion.button>

                                            <div className={cn(
                                                'p-6 rounded-[1.5rem] flex items-center justify-between border shadow-2xl transition-all duration-500',
                                                Math.abs(totalAllocated - orderTotal) < 1
                                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                                    : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                                            )}>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest pl-1 opacity-70">ALLOCATION STATUS</span>
                                                    <p className="text-xl font-black tracking-tighter">Rs. {totalAllocated} / {orderTotal}</p>
                                                </div>
                                                {Math.abs(totalAllocated - orderTotal) >= 1 && (
                                                    <div className="text-right">
                                                        <span className="text-[10px] font-black uppercase tracking-widest pl-1 opacity-70">DIFFERENCE</span>
                                                        <p className="text-xl font-black tracking-tighter">Rs. {Math.abs(totalAllocated - orderTotal)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Summary Overlay */}
                                <div className="p-8 bg-black rounded-[2.5rem] border border-neutral-800/80 shadow-2xl space-y-4">
                                    <div className="flex justify-between items-center pb-4 border-b border-neutral-800/50">
                                        <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em]">RECONCILIATION TOTAL</span>
                                        <span className="text-3xl font-black text-white tracking-tighter">Rs. {orderTotal}</span>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                                        {splits.map((split, i) => (
                                            <div key={i} className="space-y-1 p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800/40">
                                                <span className="text-[8px] font-black text-neutral-700 uppercase tracking-widest">{split.label}</span>
                                                <p className="font-black text-orange-500 tracking-tighter">Rs. {split.amount}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="flex gap-6 pt-4 border-t border-neutral-800/50 mt-10">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={onClose}
                                        className="h-20 px-10 rounded-[2rem] bg-neutral-900 text-neutral-500 font-black text-[10px] uppercase tracking-[0.2em] border border-neutral-800 hover:text-white transition-all shadow-xl"
                                    >Cancel</motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        disabled={!isValid}
                                        onClick={() => setStep('payment')}
                                        className={cn(
                                            "flex-1 h-20 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] transition-all duration-700 shadow-2xl flex items-center justify-center gap-4",
                                            !isValid
                                                ? "bg-neutral-800 text-neutral-600 grayscale opacity-50 border border-neutral-700"
                                                : "bg-orange-600 text-white shadow-orange-600/30 hover:bg-orange-500 border border-orange-400/20"
                                        )}
                                    >
                                        PROCEED TO PAYMENTS <ArrowRight className="w-5 h-5" />
                                    </motion.button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="payment"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-10"
                            >
                                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {splits.map((split, i) => (
                                        <div key={i} className="p-10 bg-black/40 rounded-[3rem] border border-neutral-800/80 shadow-inner group/paycard">
                                            <div className="flex justify-between items-center mb-8">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em]">{split.label}</span>
                                                    <p className="text-[8px] font-black text-neutral-700 uppercase tracking-widest pl-1">Payment Payload Selection</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-3xl font-black text-white tracking-tighter">Rs. {split.amount}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-6">
                                                {paymentMethods.map(({ id, label, icon: Icon }) => (
                                                    <motion.button
                                                        whileHover={{ scale: 1.05, y: -4 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        key={id}
                                                        onClick={() => handlePaymentSelect(i, id)}
                                                        className={cn(
                                                            'h-32 rounded-[2rem] border-2 flex flex-col items-center justify-center gap-4 transition-all duration-500 relative overflow-hidden group shadow-xl',
                                                            paymentMethods_[i] === id
                                                                ? 'border-orange-500 bg-orange-600/10 shadow-orange-600/10'
                                                                : 'border-neutral-800/60 bg-black text-neutral-600 hover:border-neutral-700'
                                                        )}
                                                    >
                                                        <Icon className={cn('w-8 h-8 transition-all duration-500', paymentMethods_[i] === id ? 'text-orange-500 scale-125' : 'group-hover:text-white')} />
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
                                                    </motion.button>
                                                ))}
                                            </div>

                                            {paymentMethods_[i] && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="mt-8 flex items-center gap-4 text-emerald-500 px-6 py-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 shadow-xl shadow-emerald-500/5"
                                                >
                                                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/40">
                                                        <Check className="w-5 h-5 text-black font-black" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">GUEST READY VIA {paymentMethods_[i]?.toUpperCase()}</span>
                                                </motion.div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-6 pt-4 border-t border-neutral-800/50 mt-10">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setStep('configure')}
                                        className="h-20 px-10 rounded-[2rem] bg-neutral-900 text-neutral-500 font-black text-[10px] uppercase tracking-[0.2em] border border-neutral-800 hover:text-white transition-all shadow-xl"
                                    >BACK</motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleComplete}
                                        disabled={isProcessing || paymentMethods_.some((m, i) => i < splits.length && !m)}
                                        className={cn(
                                            "flex-1 h-20 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] transition-all duration-700 shadow-2xl flex items-center justify-center gap-4",
                                            (paymentMethods_.some((m, i) => i < splits.length && !m))
                                                ? "bg-neutral-800 text-neutral-600 grayscale opacity-50 border border-neutral-700"
                                                : "bg-orange-600 text-white shadow-orange-600/40 hover:bg-orange-500 border border-orange-400/20"
                                        )}
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="w-8 h-8 animate-spin" />
                                        ) : (
                                            <>AUTHORIZE ALL PAYMENTS <Check className="w-6 h-6" /></>
                                        )}
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </Modal>
    )
}
