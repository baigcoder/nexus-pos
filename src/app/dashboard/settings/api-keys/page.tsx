'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Key,
    Plus,
    Copy,
    Trash2,
    Eye,
    EyeOff,
    Check,
    X,
    Globe,
    Clock,
    Shield,
    AlertTriangle,
    RefreshCw,
    ExternalLink
} from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui/common'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores'

interface ApiKey {
    id: string
    name: string
    key_prefix: string
    permissions: string[]
    allowed_origins: string[]
    rate_limit_per_minute: number
    last_used_at: string | null
    usage_count: number
    is_active: boolean
    expires_at: string | null
    created_at: string
}

export default function ApiKeysPage() {
    const { restaurant } = useAuthStore()
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newKeyResult, setNewKeyResult] = useState<{ key: string; keyId: string } | null>(null)
    const [copiedKey, setCopiedKey] = useState<string | null>(null)

    // Form state
    const [keyName, setKeyName] = useState('')
    const [isLive, setIsLive] = useState(true)
    const [allowedOrigins, setAllowedOrigins] = useState('')
    const [permissions, setPermissions] = useState<string[]>(['menu:read', 'orders:create'])

    const fetchApiKeys = useCallback(async () => {
        if (!restaurant?.id) return

        try {
            const response = await fetch(`/api/settings/api-keys?restaurant_id=${restaurant.id}`)
            const data = await response.json()

            if (data.success) {
                setApiKeys(data.keys || [])
            }
        } catch (error) {
            console.error('Failed to fetch API keys:', error)
        } finally {
            setIsLoading(false)
        }
    }, [restaurant?.id])

    useEffect(() => {
        fetchApiKeys()
    }, [fetchApiKeys])

    const handleCreateKey = async () => {
        if (!keyName.trim()) {
            toast.error('Please enter a name for the API key')
            return
        }

        setIsCreating(true)

        try {
            const response = await fetch('/api/settings/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurant_id: restaurant?.id,
                    name: keyName,
                    is_live: isLive,
                    permissions,
                    allowed_origins: allowedOrigins.split('\n').filter(Boolean).map(o => o.trim()),
                }),
            })

            const data = await response.json()

            if (data.success) {
                setNewKeyResult({ key: data.key, keyId: data.keyId })
                toast.success('API key created successfully')
                fetchApiKeys()
            } else {
                toast.error(data.error || 'Failed to create API key')
            }
        } catch (error) {
            toast.error('Failed to create API key')
        } finally {
            setIsCreating(false)
        }
    }

    const handleRevokeKey = async (keyId: string) => {
        if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) {
            return
        }

        try {
            const response = await fetch(`/api/settings/api-keys/${keyId}`, {
                method: 'DELETE',
            })

            const data = await response.json()

            if (data.success) {
                toast.success('API key revoked')
                setApiKeys(prev => prev.filter(k => k.id !== keyId))
            } else {
                toast.error(data.error || 'Failed to revoke API key')
            }
        } catch (error) {
            toast.error('Failed to revoke API key')
        }
    }

    const copyToClipboard = async (text: string, keyId: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedKey(keyId)
            setTimeout(() => setCopiedKey(null), 2000)
            toast.success('Copied to clipboard')
        } catch (error) {
            toast.error('Failed to copy')
        }
    }

    const closeCreateModal = () => {
        setShowCreateModal(false)
        setNewKeyResult(null)
        setKeyName('')
        setAllowedOrigins('')
        setPermissions(['menu:read', 'orders:create'])
    }

    const availablePermissions = [
        { id: 'menu:read', label: 'Read Menu', description: 'Access menu items and categories' },
        { id: 'orders:create', label: 'Create Orders', description: 'Place new orders' },
        { id: 'orders:read', label: 'Read Orders', description: 'View order status' },
    ]

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Key className="w-8 h-8 text-amber-500" />
                        API Keys
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Manage API keys for external integrations
                    </p>
                </div>

                <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Create API Key
                </Button>
            </div>

            {/* Info Card */}
            <Card className="p-6 bg-amber-500/10 border-amber-500/30 mb-8">
                <div className="flex gap-4">
                    <Shield className="w-8 h-8 text-amber-500 flex-shrink-0" />
                    <div>
                        <h3 className="font-bold text-white mb-2">API Integration Guide</h3>
                        <p className="text-slate-300 text-sm mb-3">
                            Use API keys to integrate your restaurant's menu and ordering system with external websites,
                            apps, or platforms. Each key can have specific permissions and allowed origins for security.
                        </p>
                        <div className="flex gap-4">
                            <a href="/docs/api" className="text-amber-400 hover:text-amber-300 text-sm font-medium flex items-center gap-1">
                                View API Documentation <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </Card>

            {/* API Keys List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                </div>
            ) : apiKeys.length === 0 ? (
                <Card className="p-12 bg-slate-900/50 border-slate-800 text-center">
                    <Key className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No API Keys Yet</h3>
                    <p className="text-slate-400 mb-6">
                        Create your first API key to integrate with external platforms
                    </p>
                    <Button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-amber-500 hover:bg-amber-600"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Create API Key
                    </Button>
                </Card>
            ) : (
                <div className="space-y-4">
                    {apiKeys.map((key) => (
                        <Card
                            key={key.id}
                            className={`p-6 bg-slate-900/50 border-slate-800 ${!key.is_active ? 'opacity-50' : ''}`}
                        >
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-bold text-white">{key.name}</h3>
                                        <Badge className={key.key_prefix.includes('live') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}>
                                            {key.key_prefix.includes('live') ? 'LIVE' : 'TEST'}
                                        </Badge>
                                        {!key.is_active && (
                                            <Badge className="bg-red-500/20 text-red-400">REVOKED</Badge>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                                        <code className="bg-slate-800 px-2 py-1 rounded font-mono">
                                            {key.key_prefix}_••••••••
                                        </code>
                                    </div>

                                    <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            {key.last_used_at
                                                ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}`
                                                : 'Never used'
                                            }
                                        </span>
                                        <span>{key.usage_count.toLocaleString()} requests</span>
                                        {key.expires_at && (
                                            <span className="flex items-center gap-1 text-amber-400">
                                                <AlertTriangle className="w-4 h-4" />
                                                Expires {new Date(key.expires_at).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="flex flex-wrap gap-1">
                                        {key.permissions.map(perm => (
                                            <Badge key={perm} className="bg-slate-800 text-slate-300 text-xs">
                                                {perm}
                                            </Badge>
                                        ))}
                                    </div>

                                    {key.is_active && (
                                        <Button
                                            variant="ghost"
                                            onClick={() => handleRevokeKey(key.id)}
                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create API Key Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
                        onClick={closeCreateModal}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {newKeyResult ? (
                                /* Show new key result */
                                <div className="p-6">
                                    <div className="text-center mb-6">
                                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Check className="w-8 h-8 text-emerald-500" />
                                        </div>
                                        <h2 className="text-xl font-bold text-white">API Key Created</h2>
                                        <p className="text-slate-400 mt-2">
                                            Copy this key now. You won't be able to see it again!
                                        </p>
                                    </div>

                                    <div className="bg-slate-800 rounded-xl p-4 mb-6">
                                        <div className="flex items-center justify-between">
                                            <code className="text-amber-400 font-mono text-sm break-all">
                                                {newKeyResult.key}
                                            </code>
                                            <Button
                                                variant="ghost"
                                                onClick={() => copyToClipboard(newKeyResult.key, 'new')}
                                                className="ml-2 flex-shrink-0"
                                            >
                                                {copiedKey === 'new' ? (
                                                    <Check className="w-5 h-5 text-emerald-500" />
                                                ) : (
                                                    <Copy className="w-5 h-5 text-slate-400" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
                                        <div className="flex gap-3">
                                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                            <p className="text-amber-200 text-sm">
                                                Store this key securely. It provides access to your restaurant's data.
                                            </p>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={closeCreateModal}
                                        className="w-full bg-amber-500 hover:bg-amber-600"
                                    >
                                        Done
                                    </Button>
                                </div>
                            ) : (
                                /* Create key form */
                                <>
                                    <div className="p-6 border-b border-slate-800">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-xl font-bold text-white">Create API Key</h2>
                                            <button onClick={closeCreateModal} className="text-slate-400 hover:text-white">
                                                <X className="w-6 h-6" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-6">
                                        {/* Key Name */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                                Key Name
                                            </label>
                                            <input
                                                type="text"
                                                value={keyName}
                                                onChange={(e) => setKeyName(e.target.value)}
                                                placeholder="e.g., WordPress Plugin, Mobile App"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-500 outline-none"
                                            />
                                        </div>

                                        {/* Environment Toggle */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                                Environment
                                            </label>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => setIsLive(true)}
                                                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${isLive
                                                        ? 'bg-emerald-500 text-white'
                                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                        }`}
                                                >
                                                    Production (Live)
                                                </button>
                                                <button
                                                    onClick={() => setIsLive(false)}
                                                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${!isLive
                                                        ? 'bg-amber-500 text-white'
                                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                        }`}
                                                >
                                                    Testing
                                                </button>
                                            </div>
                                        </div>

                                        {/* Permissions */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                                Permissions
                                            </label>
                                            <div className="space-y-2">
                                                {availablePermissions.map(perm => (
                                                    <label
                                                        key={perm.id}
                                                        className="flex items-start gap-3 p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-700 transition-colors"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={permissions.includes(perm.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setPermissions([...permissions, perm.id])
                                                                } else {
                                                                    setPermissions(permissions.filter(p => p !== perm.id))
                                                                }
                                                            }}
                                                            className="mt-1 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
                                                        />
                                                        <div>
                                                            <div className="font-medium text-white">{perm.label}</div>
                                                            <div className="text-sm text-slate-400">{perm.description}</div>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Allowed Origins */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                                Allowed Origins (Optional)
                                            </label>
                                            <textarea
                                                value={allowedOrigins}
                                                onChange={(e) => setAllowedOrigins(e.target.value)}
                                                placeholder="https://yourwebsite.com&#10;https://app.yourwebsite.com&#10;*.yoursite.com"
                                                rows={3}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-500 outline-none font-mono text-sm"
                                            />
                                            <p className="text-xs text-slate-500 mt-1">
                                                One per line. Leave empty to allow all origins.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-6 border-t border-slate-800 flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={closeCreateModal}
                                            className="flex-1"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleCreateKey}
                                            disabled={isCreating || !keyName.trim()}
                                            className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50"
                                        >
                                            {isCreating ? (
                                                <RefreshCw className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <>
                                                    <Plus className="w-5 h-5 mr-2" />
                                                    Create Key
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
