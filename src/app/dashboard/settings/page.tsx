'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Building2,
    Clock,
    DollarSign,
    Bell,
    Palette,
    Save,
    Upload,
    Shield,
    Globe,
    Zap
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { Card, Button, Badge, Input } from '@/components/ui/common'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
    const { restaurant } = useAuthStore()
    const { success } = useToast()
    const [isSaving, setIsSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('general')

    const [settings, setSettings] = useState({
        name: restaurant?.name || 'Restaurant Name',
        address: restaurant?.address || 'Restaurant Address',
        phone: restaurant?.phone || '+92 300 1234567',
        email: restaurant?.email || 'admin@restaurant.com',
        currency: 'PKR',
        taxRate: 16,
        serviceCharge: 5,
        orderNotificationSound: true,
        emailNotifications: true,
        darkModeKitchen: true,
        autoRefreshInterval: 30,
        theme: 'standard',
    })

    const handleSave = async () => {
        setIsSaving(true)
        await new Promise(resolve => setTimeout(resolve, 1500))
        success('Settings Saved', 'Your changes have been saved successfully.')
        setIsSaving(false)
    }

    const tabs = [
        { id: 'general', label: 'General', icon: Building2, desc: 'Restaurant Info' },
        { id: 'business', label: 'Business', icon: DollarSign, desc: 'Taxes & Fees' },
        { id: 'hours', label: 'Hours', icon: Clock, desc: 'Opening Times' },
        { id: 'notifications', label: 'Alerts', icon: Bell, desc: 'Notifications' },
        { id: 'display', label: 'Display', icon: Palette, desc: 'Appearance' },
    ]

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const item = {
        hidden: { opacity: 0, x: -20 },
        show: { opacity: 1, x: 0 }
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-12 pb-24"
        >
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                <div>
                    <div className="flex items-center gap-4 mb-3">
                        <Badge variant="outline" className="bg-orange-600/10 text-orange-600 border-orange-600/20 px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest">
                            Connected
                        </Badge>
                        <div className="h-px w-12 bg-neutral-800" />
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Version 1.0</span>
                    </div>
                    <h1 className="text-5xl font-bold tracking-tight text-white uppercase">
                        Account <span className="text-orange-600">Settings</span>
                    </h1>
                    <p className="text-neutral-500 mt-4 font-medium text-lg">
                        Manage your <span className="text-white font-bold">restaurant's information</span>, working hours, and notifications.
                    </p>
                </div>
                <Button
                    className="h-16 px-12 bg-orange-600 hover:bg-orange-500 text-white shadow-2xl shadow-orange-600/30 font-bold uppercase tracking-widest text-xs border-none group"
                    onClick={handleSave}
                    isLoading={isSaving}
                >
                    <Save className="mr-3 w-5 h-5 group-hover:scale-110 transition-transform" />
                    Save Changes
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Sidebar Navigation */}
                <div className="lg:col-span-3 space-y-4">
                    <Card className="p-3 bg-neutral-900 border-neutral-800 shadow-2xl">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all group relative overflow-hidden',
                                    activeTab === tab.id
                                        ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/20'
                                        : 'text-neutral-500 hover:bg-white/5 hover:text-white'
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                    activeTab === tab.id ? 'bg-white/20' : 'bg-black border border-neutral-800 group-hover:border-neutral-700'
                                )}>
                                    <tab.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="font-bold text-[10px] uppercase tracking-widest block">{tab.label}</span>
                                    <p className={cn(
                                        "text-[10px] font-medium tracking-tight mt-0.5",
                                        activeTab === tab.id ? 'text-white/70' : 'text-neutral-600'
                                    )}>{tab.desc}</p>
                                </div>
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="tab-indicator"
                                        className="absolute right-2 w-1 h-6 bg-white rounded-full"
                                    />
                                )}
                            </button>
                        ))}
                    </Card>

                    <Card className="p-6 bg-neutral-900 border-neutral-800 border-dashed">
                        <div className="flex items-center gap-3 text-orange-600 mb-4">
                            <Shield className="w-5 h-5" />
                            <span className="font-bold uppercase text-[10px] tracking-widest">Security</span>
                        </div>
                        <p className="text-[10px] text-neutral-500 font-medium leading-relaxed">
                            Your settings are secure and only accessible by authorized staff. All changes are logged for security.
                        </p>
                    </Card>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-9">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeTab === 'general' && (
                                <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-2xl space-y-10 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 rounded-bl-full" />
                                    <div className="relative z-10">
                                        <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Restaurant <span className="text-orange-600">Info</span></h2>
                                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-2">Basic information about your business</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Restaurant Name</label>
                                            <Input
                                                variant="nexus"
                                                value={settings.name}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, name: e.target.value })}
                                                className="bg-black border-neutral-800 text-white font-bold placeholder:text-neutral-700 h-14"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Phone Number</label>
                                            <Input
                                                variant="nexus"
                                                value={settings.phone}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, phone: e.target.value })}
                                                className="bg-black border-neutral-800 text-white font-bold placeholder:text-neutral-700 h-14"
                                            />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Email Address</label>
                                            <Input
                                                variant="nexus"
                                                value={settings.email}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, email: e.target.value })}
                                                className="bg-black border-neutral-800 text-white font-bold placeholder:text-neutral-700 h-14"
                                            />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Business Address</label>
                                            <Input
                                                variant="nexus"
                                                value={settings.address}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, address: e.target.value })}
                                                className="bg-black border-neutral-800 text-white font-bold placeholder:text-neutral-700 h-14"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-10 border-t border-neutral-800">
                                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-6 block">Restaurant Logo</label>
                                        <div className="flex items-center gap-10">
                                            <div className="w-32 h-32 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center text-neutral-700 shadow-inner group hover:border-orange-600 transition-colors">
                                                <Building2 className="w-12 h-12 group-hover:text-orange-600 transition-colors" />
                                            </div>
                                            <div className="space-y-4">
                                                <Button variant="outline" className="border-neutral-800 text-neutral-400 font-bold text-[10px] uppercase tracking-widest hover:border-white hover:text-white transition-all h-12 px-8" icon={Upload}>
                                                    Upload Logo
                                                </Button>
                                                <p className="text-[10px] text-neutral-600 font-medium">Supports SVG, PNG (Max 2MB)</p>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {activeTab === 'business' && (
                                <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-2xl space-y-10">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Business <span className="text-orange-600">Settings</span></h2>
                                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-2">Manage currency, taxes, and service charges</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Currency</label>
                                            <select
                                                value={settings.currency}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings({ ...settings, currency: e.target.value })}
                                                className="w-full h-14 px-4 rounded-xl border border-neutral-800 bg-black text-white font-bold focus:ring-2 focus:ring-orange-600 outline-none appearance-none"
                                            >
                                                <option value="PKR">PKR - Pakistani Rupee</option>
                                                <option value="USD">USD - US Dollar</option>
                                                <option value="EUR">EUR - Euro</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Tax Rate (%)</label>
                                            <Input
                                                type="number"
                                                variant="nexus"
                                                value={settings.taxRate}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) })}
                                                className="bg-black border-neutral-800 text-white font-bold h-14"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Service Charge (%)</label>
                                            <Input
                                                type="number"
                                                variant="nexus"
                                                value={settings.serviceCharge}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, serviceCharge: parseFloat(e.target.value) })}
                                                className="bg-black border-neutral-800 text-white font-bold h-14"
                                            />
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {activeTab === 'hours' && (
                                <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-2xl space-y-10">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Opening <span className="text-orange-600">Hours</span></h2>
                                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-2">Set your restaurant's working times</p>
                                        </div>
                                        <Globe className="w-8 h-8 text-neutral-800" />
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => (
                                            <div key={day} className="flex items-center justify-between p-6 bg-black border border-neutral-800 rounded-2xl group hover:border-orange-600/50 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-2 h-2 rounded-full bg-orange-600 shadow-glow shadow-orange-600/20" />
                                                    <span className="font-bold text-white uppercase text-[10px] tracking-widest">{day}</span>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Open</span>
                                                        <input type="time" defaultValue="10:00" className="bg-neutral-900 border border-neutral-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg outline-none focus:border-orange-600" />
                                                    </div>
                                                    <div className="w-4 h-px bg-neutral-800" />
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Close</span>
                                                        <input type="time" defaultValue="22:00" className="bg-neutral-900 border border-neutral-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg outline-none focus:border-orange-600" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            {activeTab === 'notifications' && (
                                <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-2xl space-y-10">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Alert <span className="text-orange-600">Notifications</span></h2>
                                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-2">Manage how you receive order alerts</p>
                                    </div>
                                    <div className="space-y-6">
                                        {[
                                            {
                                                title: 'New Order Sound',
                                                desc: 'Play a notification sound when a new order is received',
                                                key: 'orderNotificationSound'
                                            },
                                            {
                                                title: 'Daily Email Reports',
                                                desc: 'Receive a summary of daily operations via email',
                                                key: 'emailNotifications'
                                            }
                                        ].map((item) => (
                                            <div key={item.key} className="flex items-center justify-between p-6 bg-black border border-neutral-800 rounded-2xl">
                                                <div>
                                                    <p className="font-bold text-white uppercase text-[10px] tracking-widest">{item.title}</p>
                                                    <p className="text-[10px] text-neutral-500 font-medium mt-1">{item.desc}</p>
                                                </div>
                                                <ToggleSwitch
                                                    checked={(settings as any)[item.key]}
                                                    onChange={(v) => setSettings({ ...settings, [item.key]: v })}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            {activeTab === 'display' && (
                                <Card className="p-6 bg-neutral-900 border-neutral-800 shadow-2xl space-y-10">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Display <span className="text-orange-600">Settings</span></h2>
                                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-2">Customize the dashboard appearance</p>
                                    </div>
                                    <div className="space-y-8">
                                        <div className="flex items-center justify-between p-6 bg-black border border-neutral-800 rounded-2xl">
                                            <div>
                                                <p className="font-bold text-white uppercase text-[10px] tracking-widest">Kitchen Dark Mode</p>
                                                <p className="text-[10px] text-neutral-500 font-medium mt-1">Force high-contrast dark theme for kitchen screens</p>
                                            </div>
                                            <ToggleSwitch checked={settings.darkModeKitchen} onChange={(v) => setSettings({ ...settings, darkModeKitchen: v })} />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Auto-Refresh Interval</label>
                                            <div className="grid grid-cols-3 gap-4">
                                                {[15, 30, 60].map((val) => (
                                                    <button
                                                        key={val}
                                                        onClick={() => setSettings({ ...settings, autoRefreshInterval: val })}
                                                        className={cn(
                                                            "h-14 rounded-xl border-2 font-bold text-[10px] uppercase tracking-widest transition-all",
                                                            settings.autoRefreshInterval === val
                                                                ? "bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-600/20"
                                                                : "bg-black border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-white"
                                                        )}
                                                    >
                                                        {val < 60 ? `${val} SEC` : '1 MIN'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={cn(
                "w-16 h-8 rounded-full transition-all relative border-2",
                checked ? 'bg-orange-600 border-orange-600' : 'bg-black border-neutral-800'
            )}
        >
            <motion.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={cn(
                    "absolute top-1 w-5 h-5 rounded-full shadow-lg transition-colors",
                    checked ? 'left-9 bg-white' : 'left-1 bg-neutral-800'
                )}
            />
        </button>
    )
}
