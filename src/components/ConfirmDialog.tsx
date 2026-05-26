'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
    isOpen: boolean
    onConfirm: () => void
    onCancel: () => void
    title?: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'danger' | 'warning'
}

export function ConfirmDialog({
    isOpen,
    onConfirm,
    onCancel,
    title = 'Confirm Action',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'danger',
}: ConfirmDialogProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={onCancel}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={onCancel}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors"
                        >
                            <X className="w-4 h-4 text-neutral-400" />
                        </button>

                        <div className="flex flex-col items-center text-center">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                                variant === 'danger' ? 'bg-rose-500/10' : 'bg-amber-500/10'
                            }`}>
                                <AlertTriangle className={`w-7 h-7 ${
                                    variant === 'danger' ? 'text-rose-500' : 'text-amber-500'
                                }`} />
                            </div>

                            <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                            <p className="text-sm text-neutral-400 mb-8">{message}</p>

                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={onCancel}
                                    className="flex-1 h-12 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors border border-neutral-700"
                                >
                                    {cancelLabel}
                                </button>
                                <button
                                    onClick={onConfirm}
                                    className={`flex-1 h-12 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors border ${
                                        variant === 'danger'
                                            ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500'
                                            : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'
                                    }`}
                                >
                                    {confirmLabel}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}