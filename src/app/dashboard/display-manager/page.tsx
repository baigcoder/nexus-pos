'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Tv,
    Plus,
    Image as ImageIcon,
    Video,
    Tag,
    Eye,
    ExternalLink,
    Settings,
    Trash2,
    Edit2,
    Upload,
    Monitor,
    Copy,
    Key
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { useToast } from '@/components/ui/toast'
import { Button, Input, Modal, Card, Badge } from '@/components/ui/common'
import { cn } from '@/lib/utils'

export default function DisplayManagerPage() {
    const { restaurant } = useAuthStore()
    const { success, error: showError } = useToast()

    const [displayContent, setDisplayContent] = useState<any[]>([])
    const [screens, setScreens] = useState<any[]>([])
    const [settings, setSettings] = useState<any>(null)
    const [showContentModal, setShowContentModal] = useState(false)
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const [showScreenModal, setShowScreenModal] = useState(false)
    const [editingContent, setEditingContent] = useState<any>(null)
    const [editingScreen, setEditingScreen] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (restaurant?.id) {
            loadDisplayContent()
            loadSettings()
            loadScreens()
        }
    }, [restaurant?.id])

    const loadDisplayContent = async () => {
        const supabase = createClient()
        const { data } = await supabase
            .from('display_content')
            .select('*')
            .eq('restaurant_id', restaurant?.id)
            .order('display_order')

        if (data) setDisplayContent(data)
    }

    const loadSettings = async () => {
        const supabase = createClient()
        let { data } = await supabase
            .from('display_settings')
            .select('*')
            .eq('restaurant_id', restaurant?.id)
            .single()

        // Create default settings if none exist
        if (!data) {
            const { data: newSettings } = await supabase
                .from('display_settings')
                .insert({ restaurant_id: restaurant?.id })
                .select()
                .single()
            data = newSettings
        }

        if (data) setSettings(data)
    }

    const loadScreens = async () => {
        const supabase = createClient()
        const { data } = await supabase
            .from('display_screens')
            .select('*')
            .eq('restaurant_id', restaurant?.id)
            .order('created_at')

        if (data) setScreens(data)
    }

    const openDisplayInNewTab = () => {
        if (!restaurant?.slug) return
        window.open(`/display/${restaurant.slug}`, '_blank')
        success('Display Opened', 'Drag this window to your monitor and press F11 for fullscreen')
    }

    const deleteContent = async (id: string) => {
        if (!confirm('Delete this content?')) return

        const supabase = createClient()
        const { error } = await supabase
            .from('display_content')
            .delete()
            .eq('id', id)

        if (error) {
            showError('Error', error.message)
        } else {
            success('Deleted', 'Content removed')
            loadDisplayContent()
        }
    }

    const deleteScreen = async (id: string) => {
        if (!confirm('Delete this screen?')) return

        const supabase = createClient()
        const { error } = await supabase
            .from('display_screens')
            .delete()
            .eq('id', id)

        if (error) {
            showError('Error', error.message)
        } else {
            success('Deleted', 'Screen removed')
            loadScreens()
        }
    }

    const copyScreenLogin = (screen: any) => {
        const loginUrl = `${window.location.origin}/screen-login`
        const info = `Screen: ${screen.name}\nRestaurant ID: ${restaurant?.slug}\nAccess Code: ${screen.access_code}\nLogin URL: ${loginUrl}`
        navigator.clipboard.writeText(info)
        success('Copied!', 'Screen login details copied to clipboard')
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-8 max-w-[1600px] mx-auto space-y-8"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-white mb-2">
                        Display Manager
                    </h1>
                    <p className="text-neutral-400">
                        Manage what customers see on your front screens
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => setShowSettingsModal(true)}
                        variant="outline"
                        icon={Settings}
                    >
                        Display Settings
                    </Button>
                    <Button
                        onClick={openDisplayInNewTab}
                        icon={ExternalLink}
                    >
                        Open Display
                    </Button>
                </div>
            </div>

            {/* Screen Management Section */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-blue-500/20">
                            <Monitor className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Screen Access</h2>
                            <p className="text-sm text-neutral-400">Manage login credentials for your display screens</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => { setEditingScreen(null); setShowScreenModal(true); }}
                        icon={Plus}
                        className="bg-blue-600 hover:bg-blue-500"
                    >
                        Add Screen
                    </Button>
                </div>

                {screens.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl">
                        <Monitor className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                        <p className="text-neutral-500 mb-3">No screens configured yet</p>
                        <Button
                            onClick={() => { setEditingScreen(null); setShowScreenModal(true); }}
                            variant="outline"
                            size="sm"
                        >
                            Add Your First Screen
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4">
                        {screens.map((screen) => (
                            <Card key={screen.id} className="p-5 group hover:border-blue-500/50 transition-all">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-blue-500/10">
                                            <Tv className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">{screen.name}</h3>
                                            <p className="text-xs text-neutral-500">{screen.screen_type}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => copyScreenLogin(screen)}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-all"
                                            title="Copy login details"
                                        >
                                            <Copy className="w-4 h-4 text-neutral-400" />
                                        </button>
                                        <button
                                            onClick={() => { setEditingScreen(screen); setShowScreenModal(true); }}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-all"
                                        >
                                            <Edit2 className="w-4 h-4 text-neutral-400" />
                                        </button>
                                        <button
                                            onClick={() => deleteScreen(screen.id)}
                                            className="p-2 hover:bg-red-500/20 rounded-lg transition-all"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-black/30 rounded-xl p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider">Access Code</span>
                                        <div className="flex items-center gap-2">
                                            <Key className="w-3 h-3 text-blue-400" />
                                            <span className="text-sm font-mono font-bold text-blue-400">{screen.access_code}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider">Status</span>
                                        <span className={`text-xs font-bold ${screen.is_active ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {screen.is_active ? '● Active' : '○ Inactive'}
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                <div className="mt-4 p-4 bg-white/5 rounded-xl">
                    <p className="text-xs text-neutral-400">
                        <strong className="text-white">How to use:</strong> Go to <code className="bg-black/30 px-2 py-0.5 rounded">/screen-login</code>, enter your restaurant ID (<code className="bg-black/30 px-2 py-0.5 rounded">{restaurant?.slug}</code>) and the access code above.
                    </p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-4">
                <Card
                    onClick={() => { setEditingContent(null); setShowContentModal(true); }}
                    className="p-6 cursor-pointer hover:border-orange-500 transition-all group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-all">
                            <ImageIcon className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                            <p className="font-bold text-white">Add Banner</p>
                            <p className="text-xs text-neutral-500">Image slide</p>
                        </div>
                    </div>
                </Card>

                <Card
                    onClick={() => { setEditingContent({ content_type: 'video' }); setShowContentModal(true); }}
                    className="p-6 cursor-pointer hover:border-blue-500 transition-all group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-all">
                            <Video className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <p className="font-bold text-white">Add Video</p>
                            <p className="text-xs text-neutral-500">Video slide</p>
                        </div>
                    </div>
                </Card>

                <Card
                    onClick={() => { setEditingContent({ content_type: 'promo' }); setShowContentModal(true); }}
                    className="p-6 cursor-pointer hover:border-emerald-500 transition-all group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-all">
                            <Tag className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <p className="font-bold text-white">Add Promo</p>
                            <p className="text-xs text-neutral-500">Discount banner</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 bg-neutral-900/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-white/5">
                            <Tv className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-white">{displayContent.length}</p>
                            <p className="text-xs text-neutral-500">Active Content</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Content List */}
            <div>
                <h2 className="text-2xl font-bold text-white mb-4">Display Content</h2>
                <div className="grid grid-cols-3 gap-4">
                    {displayContent.map((content) => (
                        <Card key={content.id} className="p-6 group hover:border-orange-500/50 transition-all">
                            <div className="flex items-start justify-between mb-4">
                                <Badge className={cn(
                                    content.content_type === 'banner' && 'bg-orange-500/20 text-orange-500',
                                    content.content_type === 'video' && 'bg-blue-500/20 text-blue-500',
                                    content.content_type === 'promo' && 'bg-emerald-500/20 text-emerald-500'
                                )}>
                                    {content.content_type}
                                </Badge>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => { setEditingContent(content); setShowContentModal(true); }}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-all"
                                    >
                                        <Edit2 className="w-4 h-4 text-neutral-400" />
                                    </button>
                                    <button
                                        onClick={() => deleteContent(content.id)}
                                        className="p-2 hover:bg-red-500/20 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            </div>

                            {content.media_url && (
                                <div className="relative h-32 bg-neutral-900 rounded-xl mb-4 overflow-hidden">
                                    {content.content_type === 'video' ? (
                                        <video src={content.media_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <img src={content.media_url} alt={content.title} className="w-full h-full object-cover" />
                                    )}
                                </div>
                            )}

                            <h3 className="font-bold text-white mb-1">{content.title}</h3>
                            {content.description && (
                                <p className="text-sm text-neutral-500 mb-3 line-clamp-2">{content.description}</p>
                            )}
                            <div className="flex items-center justify-between text-xs text-neutral-600">
                                <span>{content.duration_seconds}s duration</span>
                                <span className={content.is_active ? 'text-emerald-500' : 'text-red-500'}>
                                    {content.is_active ? '● Active' : '○ Inactive'}
                                </span>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Content Modal */}
            <Modal
                isOpen={showContentModal}
                onClose={() => { setShowContentModal(false); setEditingContent(null); }}
                title={editingContent?.id ? 'Edit Content' : 'Add Content'}
                size="lg"
            >
                <ContentForm
                    content={editingContent}
                    restaurantId={restaurant?.id}
                    onSuccess={() => {
                        setShowContentModal(false)
                        setEditingContent(null)
                        loadDisplayContent()
                    }}
                    onCancel={() => {
                        setShowContentModal(false)
                        setEditingContent(null)
                    }}
                />
            </Modal>

            {/* Settings Modal */}
            <Modal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                title="Display Settings"
                size="md"
            >
                <SettingsForm
                    settings={settings}
                    restaurantId={restaurant?.id}
                    onSuccess={() => {
                        setShowSettingsModal(false)
                        loadSettings()
                    }}
                    onCancel={() => setShowSettingsModal(false)}
                />
            </Modal>

            {/* Screen Modal */}
            <Modal
                isOpen={showScreenModal}
                onClose={() => { setShowScreenModal(false); setEditingScreen(null); }}
                title={editingScreen?.id ? 'Edit Screen' : 'Add Screen'}
                size="md"
            >
                <ScreenForm
                    screen={editingScreen}
                    restaurantId={restaurant?.id}
                    onSuccess={() => {
                        setShowScreenModal(false)
                        setEditingScreen(null)
                        loadScreens()
                    }}
                    onCancel={() => {
                        setShowScreenModal(false)
                        setEditingScreen(null)
                    }}
                />
            </Modal>
        </motion.div>
    )
}

// Content Form Component
function ContentForm({ content, restaurantId, onSuccess, onCancel }: any) {
    const { success, error: showError } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        content_type: content?.content_type || 'banner',
        title: content?.title || '',
        description: content?.description || '',
        media_url: content?.media_url || '',
        duration_seconds: content?.duration_seconds || 10,
        display_order: content?.display_order || 0,
        is_active: content?.is_active !== false,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const supabase = createClient()

            if (content?.id) {
                // Update
                const { error } = await supabase
                    .from('display_content')
                    .update(formData)
                    .eq('id', content.id)

                if (error) throw error
                success('Updated', 'Content updated successfully')
            } else {
                // Create
                const { error } = await supabase
                    .from('display_content')
                    .insert({ ...formData, restaurant_id: restaurantId })

                if (error) throw error
                success('Added', 'Content added to display')
            }

            onSuccess()
        } catch (err: any) {
            showError('Error', err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <Input
                    label="Title"
                    value={formData.title}
                    onChange={(e: any) => setFormData({ ...formData, title: e.target.value })}
                    required
                />
                <Input
                    label="Duration (seconds)"
                    type="number"
                    value={formData.duration_seconds}
                    onChange={(e: any) => setFormData({ ...formData, duration_seconds: parseInt(e.target.value) })}
                    required
                />
            </div>

            <Input
                label="Description"
                value={formData.description}
                onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
            />

            <Input
                label="Media URL (Image or Video)"
                value={formData.media_url}
                onChange={(e: any) => setFormData({ ...formData, media_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
            />

            <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4"
                    />
                    <span className="text-sm text-white">Active</span>
                </label>
            </div>

            <div className="flex gap-3">
                <Button type="button" onClick={onCancel} variant="outline" className="flex-1">
                    Cancel
                </Button>
                <Button type="submit" isLoading={isLoading} className="flex-1">
                    {content?.id ? 'Update' : 'Add'} Content
                </Button>
            </div>
        </form>
    )
}

// Settings Form Component
function SettingsForm({ settings, restaurantId, onSuccess, onCancel }: any) {
    const { success, error: showError } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        theme: settings?.theme || 'dark',
        primary_color: settings?.primary_color || '#ea580c',
        show_prices: settings?.show_prices !== false,
        show_order_ticker: settings?.show_order_ticker !== false,
        auto_rotate: settings?.auto_rotate !== false,
        rotate_interval: settings?.rotate_interval || 8,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const supabase = createClient()

            const { error } = await supabase
                .from('display_settings')
                .upsert({
                    ...formData,
                    restaurant_id: restaurantId,
                    id: settings?.id
                })

            if (error) throw error
            success('Saved', 'Display settings updated')
            onSuccess()
        } catch (err: any) {
            showError('Error', err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={formData.show_prices}
                        onChange={(e) => setFormData({ ...formData, show_prices: e.target.checked })}
                        className="w-4 h-4"
                    />
                    <span className="text-sm text-white">Show Prices</span>
                </label>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={formData.show_order_ticker}
                        onChange={(e) => setFormData({ ...formData, show_order_ticker: e.target.checked })}
                        className="w-4 h-4"
                    />
                    <span className="text-sm text-white">Show Order Ticker</span>
                </label>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={formData.auto_rotate}
                        onChange={(e) => setFormData({ ...formData, auto_rotate: e.target.checked })}
                        className="w-4 h-4"
                    />
                    <span className="text-sm text-white">Auto-rotate Banners</span>
                </label>
            </div>

            {formData.auto_rotate && (
                <Input
                    label="Banner Rotation Interval (seconds)"
                    type="number"
                    value={formData.rotate_interval}
                    onChange={(e: any) => setFormData({ ...formData, rotate_interval: parseInt(e.target.value) })}
                />
            )}

            <div className="flex gap-3">
                <Button type="button" onClick={onCancel} variant="outline" className="flex-1">
                    Cancel
                </Button>
                <Button type="submit" isLoading={isLoading} className="flex-1">
                    Save Settings
                </Button>
            </div>
        </form>
    )
}

// Screen Form Component (for owner to add/edit screen credentials)
function ScreenForm({ screen, restaurantId, onSuccess, onCancel }: any) {
    const { success, error: showError } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: screen?.name || '',
        access_code: screen?.access_code || generateAccessCode(),
        screen_type: screen?.screen_type || 'customer',
        is_active: screen?.is_active !== false,
    })

    function generateAccessCode() {
        return Math.floor(1000 + Math.random() * 9000).toString()
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const supabase = createClient()

            if (screen?.id) {
                // Update
                const { error } = await supabase
                    .from('display_screens')
                    .update(formData)
                    .eq('id', screen.id)

                if (error) throw error
                success('Updated', 'Screen updated successfully')
            } else {
                // Create
                const { error } = await supabase
                    .from('display_screens')
                    .insert({ ...formData, restaurant_id: restaurantId })

                if (error) throw error
                success('Added', 'Screen created successfully')
            }

            onSuccess()
        } catch (err: any) {
            showError('Error', err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Input
                label="Screen Name"
                value={formData.name}
                onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Front Counter Display"
                required
            />

            <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                    Screen Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                    {(['customer', 'kitchen', 'order_status'] as const).map((type) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({ ...formData, screen_type: type })}
                            className={cn(
                                'h-12 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border',
                                formData.screen_type === type
                                    ? 'bg-blue-600 border-blue-500 text-white'
                                    : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                            )}
                        >
                            {type.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                    Access Code
                </label>
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={formData.access_code}
                        onChange={(e) => setFormData({ ...formData, access_code: e.target.value })}
                        className="flex-1 h-14 bg-neutral-900 border border-neutral-800 rounded-xl px-4 text-2xl font-mono font-bold text-blue-400 tracking-widest text-center"
                        maxLength={6}
                        required
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFormData({ ...formData, access_code: generateAccessCode() })}
                    >
                        Generate
                    </Button>
                </div>
                <p className="text-xs text-neutral-500">This code is used to login to the display screen</p>
            </div>

            <label className="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4"
                />
                <span className="text-sm text-white">Active</span>
            </label>

            <div className="flex gap-3">
                <Button type="button" onClick={onCancel} variant="outline" className="flex-1">
                    Cancel
                </Button>
                <Button type="submit" isLoading={isLoading} className="flex-1">
                    {screen?.id ? 'Update' : 'Add'} Screen
                </Button>
            </div>
        </form>
    )
}
