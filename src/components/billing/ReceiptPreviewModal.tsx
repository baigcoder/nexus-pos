'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
    Printer,
    Download,
    X,
    CheckCircle2,
    Clock,
    User,
    Phone,
    MapPin,
    Receipt,
    CreditCard,
    Banknote
} from 'lucide-react'
import { Card, Button, Badge, Modal } from '@/components/ui/common'
import { cn } from '@/lib/utils'

interface ReceiptItem {
    name: string
    quantity: number
    price: number
}

interface ReceiptData {
    orderNumber: number
    tableNumber: string
    waiter: string
    items: ReceiptItem[]
    subtotal: number
    tax: number
    discount: number
    total: number
    paymentMethod: 'cash' | 'card' | 'mobile'
    cashReceived?: number
    change?: number
    date: Date
    restaurant: {
        name: string
        address: string
        phone: string
        ntn?: string
    }
}

interface ReceiptPreviewModalProps {
    isOpen: boolean
    onClose: () => void
    data: ReceiptData
    onPrint?: () => void
}

export function ReceiptPreviewModal({ isOpen, onClose, data, onPrint }: ReceiptPreviewModalProps) {
    const receiptRef = useRef<HTMLDivElement>(null)
    const [isPrinting, setIsPrinting] = useState(false)

    const handlePrint = async () => {
        setIsPrinting(true)
        await new Promise(resolve => setTimeout(resolve, 500))
        window.print()
        setIsPrinting(false)
        onPrint?.()
    }

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Receipt Preview" size="sm">
            <div className="space-y-6 py-4">
                {/* Receipt Preview */}
                <div
                    ref={receiptRef}
                    className="bg-white text-black p-6 rounded-xl font-mono text-sm mx-auto max-w-xs print:max-w-none print:p-0"
                >
                    {/* Header */}
                    <div className="text-center border-b-2 border-dashed border-neutral-300 pb-4 mb-4">
                        <h2 className="text-xl font-bold uppercase tracking-tight">{data.restaurant.name}</h2>
                        <p className="text-[10px] text-neutral-500 mt-1">{data.restaurant.address}</p>
                        <p className="text-[10px] text-neutral-500">Tel: {data.restaurant.phone}</p>
                        {data.restaurant.ntn && (
                            <p className="text-[10px] text-neutral-500">NTN: {data.restaurant.ntn}</p>
                        )}
                    </div>

                    {/* Order Info */}
                    <div className="flex justify-between text-xs mb-4 pb-4 border-b border-dashed border-neutral-300">
                        <div>
                            <p><span className="text-neutral-500">Order:</span> #{data.orderNumber}</p>
                            <p><span className="text-neutral-500">Table:</span> {data.tableNumber}</p>
                            <p><span className="text-neutral-500">Server:</span> {data.waiter}</p>
                        </div>
                        <div className="text-right">
                            <p>{formatDate(data.date)}</p>
                            <p>{formatTime(data.date)}</p>
                        </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-2 mb-4 pb-4 border-b border-dashed border-neutral-300">
                        <div className="flex justify-between text-[10px] text-neutral-500 uppercase font-bold">
                            <span>Item</span>
                            <span>Amount</span>
                        </div>
                        {data.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-xs">
                                <span>
                                    {item.quantity}x {item.name}
                                </span>
                                <span>Rs.{(item.quantity * item.price).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>

                    {/* Totals */}
                    <div className="space-y-1 text-xs mb-4 pb-4 border-b border-dashed border-neutral-300">
                        <div className="flex justify-between">
                            <span className="text-neutral-500">Subtotal</span>
                            <span>Rs.{data.subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-neutral-500">Tax (16%)</span>
                            <span>Rs.{data.tax.toLocaleString()}</span>
                        </div>
                        {data.discount > 0 && (
                            <div className="flex justify-between text-emerald-600">
                                <span>Discount</span>
                                <span>-Rs.{data.discount.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-base pt-2 border-t border-neutral-200">
                            <span>TOTAL</span>
                            <span>Rs.{data.total.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Payment */}
                    <div className="space-y-1 text-xs mb-4 pb-4 border-b border-dashed border-neutral-300">
                        <div className="flex justify-between">
                            <span className="text-neutral-500">Payment</span>
                            <span className="uppercase font-bold">{data.paymentMethod}</span>
                        </div>
                        {data.paymentMethod === 'cash' && data.cashReceived && (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-neutral-500">Cash Received</span>
                                    <span>Rs.{data.cashReceived.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-bold">
                                    <span>Change</span>
                                    <span>Rs.{(data.change || 0).toLocaleString()}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="text-center text-[10px] text-neutral-500">
                        <p className="font-bold mb-1">Thank you for dining with us!</p>
                        <p>Please come again</p>
                        <div className="mt-4 pt-4 border-t border-dashed border-neutral-300">
                            <p className="text-[8px]">Powered by OrderFlow POS</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 h-14 border-neutral-800 text-neutral-500"
                    >
                        Close
                    </Button>
                    <Button
                        onClick={handlePrint}
                        disabled={isPrinting}
                        icon={Printer}
                        className="flex-1 h-14 bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase tracking-widest text-xs"
                    >
                        {isPrinting ? 'Printing...' : 'Print Receipt'}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

// Demo receipt data for testing
export const demoReceiptData: ReceiptData = {
    orderNumber: 1001,
    tableNumber: 'Table 3',
    waiter: 'Ahmed',
    items: [
        { name: 'Butter Chicken', quantity: 2, price: 650 },
        { name: 'Garlic Naan', quantity: 4, price: 80 },
        { name: 'Mango Lassi', quantity: 2, price: 180 },
    ],
    subtotal: 1980,
    tax: 317,
    discount: 198,
    total: 2099,
    paymentMethod: 'cash',
    cashReceived: 2500,
    change: 401,
    date: new Date(),
    restaurant: {
        name: 'The Royal Kitchen',
        address: '123 Food Street, Lahore',
        phone: '+92 42 1234567',
        ntn: '1234567-8'
    }
}
