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
                label: `Person ${i + 1}`
            }))
        } else if (splitType === 'by_items') {
            // Group items by person
            const splitAmounts: SplitPaymentData[] = []
            selectedItems.forEach((itemIds, splitIndex) => {
                const items = order.items?.filter(item => itemIds.includes(item.id)) || []
                const amount = items.reduce((sum, item) => sum + item.subtotal, 0)
                splitAmounts.push({
                    splitNumber: splitIndex + 1,
                    amount: Math.round(amount * (1 + (order.tax / order.subtotal))), // Add proportional tax
                    items: itemIds,
                    label: `Person ${splitIndex + 1}`
                })
            })
            return splitAmounts
        } else {
            return customAmounts.map((amount, i) => ({
                splitNumber: i + 1,
                amount,
                label: `Person ${i + 1}`
            }))
        }
    }, [splitType, splitCount, orderTotal, selectedItems, customAmounts, order])

    const handleItemToggle = (splitIndex: number, itemId: string) => {
        const newSelected = new Map(selectedItems)
        const currentItems = newSelected.get(splitIndex) || []

        // Remove from any other split first
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

        // Simulate processing
        setTimeout(() => {
            onComplete(finalSplits)
            setIsProcessing(false)
        }, 1000)
    }

    const totalAllocated = splits.reduce((sum, s) => sum + s.amount, 0)
    const isValid = splitType === 'equal' ||
        (splitType === 'by_items' && totalAllocated >= orderTotal * 0.99) ||
        (splitType === 'custom' && Math.abs(totalAllocated - orderTotal) < 1)

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Split Bill" className="max-w-2xl">
            <div className="space-y-6">
                {step === 'configure' ? (
                    <>
                        {/* Split Type Selector */}
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { type: 'equal' as SplitType, label: 'Split Equally', icon: Users, desc: 'Divide total evenly' },
                                { type: 'by_items' as SplitType, label: 'By Items', icon: ShoppingBag, desc: 'Select who pays for what' },
                                { type: 'custom' as SplitType, label: 'Custom', icon: Calculator, desc: 'Enter exact amounts' },
                            ].map(({ type, label, icon: Icon, desc }) => (
                                <button
                                    key={type}
                                    onClick={() => {
                                        setSplitType(type)
                                        if (type === 'custom' && customAmounts.length === 0) {
                                            setCustomAmounts([0, 0])
                                        }
                                        if (type === 'by_items' && selectedItems.size === 0) {
                                            setSelectedItems(new Map([[0, []], [1, []]]))
                                        }
                                    }}
                                    className={cn(
                                        'p-4 rounded-xl border-2 text-left transition-all',
                                        splitType === type
                                            ? 'border-primary bg-primary/5'
                                            : 'border-neutral-200 dark:border-neutral-700 hover:border-primary/50'
                                    )}
                                >
                                    <Icon className={cn('w-6 h-6 mb-2', splitType === type ? 'text-primary' : 'text-muted-foreground')} />
                                    <p className="font-semibold text-foreground text-sm">{label}</p>
                                    <p className="text-xs text-muted-foreground">{desc}</p>
                                </button>
                            ))}
                        </div>

                        {/* Equal Split Config */}
                        {splitType === 'equal' && (
                            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
                                <label className="text-sm font-medium text-muted-foreground mb-3 block">Number of People</label>
                                <div className="flex items-center gap-4">
                                    {[2, 3, 4, 5, 6].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => setSplitCount(n)}
                                            className={cn(
                                                'w-12 h-12 rounded-xl border-2 font-bold transition-all',
                                                splitCount === n
                                                    ? 'border-primary bg-primary text-white'
                                                    : 'border-neutral-200 dark:border-neutral-700 text-foreground hover:border-primary'
                                            )}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Each person pays:</span>
                                        <span className="text-lg font-bold text-primary">Rs. {splits[0]?.amount || 0}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* By Items Config */}
                        {splitType === 'by_items' && (
                            <div className="space-y-3">
                                <div className="flex gap-2 mb-4">
                                    {Array.from(selectedItems.keys()).map(idx => (
                                        <button
                                            key={idx}
                                            onClick={() => setCurrentSplit(idx)}
                                            className={cn(
                                                'px-4 py-2 rounded-lg font-medium transition-all',
                                                currentSplit === idx
                                                    ? 'bg-primary text-white'
                                                    : 'bg-neutral-100 dark:bg-neutral-800 text-foreground'
                                            )}
                                        >
                                            Person {idx + 1}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => {
                                            const newMap = new Map(selectedItems)
                                            newMap.set(selectedItems.size, [])
                                            setSelectedItems(newMap)
                                        }}
                                        className="px-4 py-2 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-600 text-muted-foreground hover:border-primary"
                                    >
                                        + Add Person
                                    </button>
                                </div>

                                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 max-h-60 overflow-y-auto space-y-2">
                                    {order.items?.map(item => {
                                        const assignedTo = Array.from(selectedItems.entries()).find(([_, items]) => items.includes(item.id))?.[0]
                                        const isSelected = selectedItems.get(currentSplit)?.includes(item.id)

                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => handleItemToggle(currentSplit, item.id)}
                                                className={cn(
                                                    'w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all',
                                                    isSelected
                                                        ? 'border-primary bg-primary/5'
                                                        : assignedTo !== undefined
                                                            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                                                            : 'border-neutral-200 dark:border-neutral-700 hover:border-primary/50'
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="w-6 h-6 rounded bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                                        {item.quantity}x
                                                    </span>
                                                    <span className="font-medium text-foreground">{item.menu_item?.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-foreground">Rs. {item.subtotal}</span>
                                                    {assignedTo !== undefined && (
                                                        <Badge variant="success" className="text-xs">P{assignedTo + 1}</Badge>
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Custom Amounts */}
                        {splitType === 'custom' && (
                            <div className="space-y-3">
                                {customAmounts.map((amount, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-muted-foreground w-20">Person {i + 1}</span>
                                        <Input
                                            type="number"
                                            value={amount || ''}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCustomAmountChange(i, parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                            className="flex-1"
                                        />
                                        {customAmounts.length > 2 && (
                                            <button
                                                onClick={() => removeCustomSplit(i)}
                                                className="w-10 h-10 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 flex items-center justify-center"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    onClick={addCustomSplit}
                                    className="w-full p-3 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-600 text-muted-foreground hover:border-primary"
                                >
                                    + Add Person
                                </button>
                                <div className={cn(
                                    'p-3 rounded-lg text-sm font-medium',
                                    Math.abs(totalAllocated - orderTotal) < 1
                                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                )}>
                                    Total: Rs. {totalAllocated} / Rs. {orderTotal}
                                    {Math.abs(totalAllocated - orderTotal) >= 1 && (
                                        <span className="ml-2">(Difference: Rs. {Math.abs(totalAllocated - orderTotal)})</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Summary */}
                        <div className="bg-neutral-900 dark:bg-neutral-800 rounded-xl p-4 text-white">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-neutral-400">Order Total</span>
                                <span className="text-xl font-bold">Rs. {orderTotal}</span>
                            </div>
                            <div className="space-y-2">
                                {splits.map((split, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span className="text-neutral-400">{split.label}</span>
                                        <span className="font-medium">Rs. {split.amount}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
                            <Button
                                variant="primary"
                                onClick={() => setStep('payment')}
                                className="flex-1"
                                disabled={!isValid}
                                icon={ArrowRight}
                            >
                                Continue to Payment
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Payment Step */}
                        <div className="space-y-4">
                            {splits.map((split, i) => (
                                <div key={i} className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="font-semibold text-foreground">{split.label}</span>
                                        <span className="text-lg font-bold text-primary">Rs. {split.amount}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {paymentMethods.map(({ id, label, icon: Icon }) => (
                                            <button
                                                key={id}
                                                onClick={() => handlePaymentSelect(i, id)}
                                                className={cn(
                                                    'p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all',
                                                    paymentMethods_[i] === id
                                                        ? 'border-primary bg-primary/10'
                                                        : 'border-neutral-200 dark:border-neutral-700 hover:border-primary/50'
                                                )}
                                            >
                                                <Icon className={cn('w-5 h-5', paymentMethods_[i] === id ? 'text-primary' : 'text-muted-foreground')} />
                                                <span className="text-xs font-medium">{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {paymentMethods_[i] && (
                                        <div className="mt-2 flex items-center gap-2 text-green-600">
                                            <Check className="w-4 h-4" />
                                            <span className="text-sm font-medium">Ready to pay with {paymentMethods_[i]}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setStep('configure')} className="flex-1">Back</Button>
                            <Button
                                variant="primary"
                                onClick={handleComplete}
                                className="flex-1"
                                isLoading={isProcessing}
                                disabled={paymentMethods_.some((m, i) => i < splits.length && !m)}
                                icon={Check}
                            >
                                Complete All Payments
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    )
}
