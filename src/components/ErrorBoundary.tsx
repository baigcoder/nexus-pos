'use client'

import React from 'react'

interface ErrorBoundaryProps {
    children: React.ReactNode
    fallback?: React.ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        if (process.env.NODE_ENV === 'development') {
            console.error('[ErrorBoundary]', error, errorInfo)
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div className="flex items-center justify-center min-h-[400px] p-8">
                    <div className="text-center max-w-md">
                        <div className="w-16 h-16 mx-auto mb-4 bg-rose-500/10 rounded-2xl flex items-center justify-center">
                            <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
                        <p className="text-sm text-neutral-500 mb-6">
                            {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
                        </p>
                        <button
                            onClick={this.handleRetry}
                            className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}