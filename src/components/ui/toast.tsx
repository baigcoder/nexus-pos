'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
    id: string
    type: ToastType
    title: string
    message?: string
    duration?: number
}

interface ToastContextType {
    toasts: Toast[]
    addToast: (toast: Omit<Toast, 'id'>) => void
    removeToast: (id: string) => void
    success: (title: string, message?: string) => void
    error: (title: string, message?: string) => void
    info: (title: string, message?: string) => void
    warning: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within ToastProvider')
    }
    return context
}

const toastIcons: Record<ToastType, ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-orange-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
}

const toastStyles: Record<ToastType, string> = {
    success: 'border-l-4 border-l-green-500',
    error: 'border-l-4 border-l-red-500',
    info: 'border-l-4 border-l-orange-500',
    warning: 'border-l-4 border-l-yellow-500',
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-4 flex items-start gap-3 min-w-[300px] max-w-[400px] ${toastStyles[toast.type]}`}
        >
            {toastIcons[toast.type]}
            <div className="flex-1">
                <p className="font-medium text-neutral-900 dark:text-white">{toast.title}</p>
                {toast.message && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{toast.message}</p>
                )}
            </div>
            <button
                onClick={onRemove}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    )
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substr(2, 9)
        const newToast = { ...toast, id }

        setToasts((prev) => [...prev, newToast])

        const duration = toast.duration ?? 5000
        if (duration > 0) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id))
            }, duration)
        }
    }, [])

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    const success = useCallback((title: string, message?: string) => {
        addToast({ type: 'success', title, message })
    }, [addToast])

    const error = useCallback((title: string, message?: string) => {
        addToast({ type: 'error', title, message })
    }, [addToast])

    const info = useCallback((title: string, message?: string) => {
        addToast({ type: 'info', title, message })
    }, [addToast])

    const warning = useCallback((title: string, message?: string) => {
        addToast({ type: 'warning', title, message })
    }, [addToast])

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, info, warning }}>
            {children}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <ToastItem
                            key={toast.id}
                            toast={toast}
                            onRemove={() => removeToast(toast.id)}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    )
}
