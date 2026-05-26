'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Clock, DollarSign, Bell, Palette, Save,
  Upload, Shield, Globe, Loader2, X, Receipt,
  Settings2, AlertTriangle, Trash2, Download,
  Eye, EyeOff, Sun, Moon, Volume2, Mail, RefreshCw,
  ChefHat, Hash, Timer, XCircle, Image as ImageIcon,
  FileText, Info, Percent, ToggleLeft, ToggleRight,
  CheckCircle2
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'
import type { OperatingHours, RestaurantSettings } from '@/types'

type TabId = 'general' | 'business' | 'hours' | 'orders' | 'receipt' | 'display' | 'danger'

interface SettingsState {
  name: string
  address: string
  phone: string
  email: string
  currency: string
  taxRate: number
  serviceCharge: number
  serviceChargeType: 'percentage' | 'fixed'
  taxMode: 'inclusive' | 'exclusive'
  priceRounding: 'none' | 'up' | 'down' | 'nearest'
  operatingHours: OperatingHours
  autoAcceptOrders: boolean
  orderPrefix: string
  showPricesToKitchen: boolean
  defaultPrepTime: number
  allowCancellation: boolean
  receiptHeader: string
  receiptFooter: string
  receiptShowInfo: boolean
  receiptShowTaxBreakdown: boolean
  receiptShowLogo: boolean
  soundEnabled: boolean
  browserNotifications: boolean
  emailNotifications: boolean
  kitchenDarkMode: boolean
  autoRefreshInterval: 15 | 30 | 60
  logoUrl: string | null
}

const DEFAULT_HOURS: OperatingHours = {
  monday: { open: '10:00', close: '22:00', closed: false },
  tuesday: { open: '10:00', close: '22:00', closed: false },
  wednesday: { open: '10:00', close: '22:00', closed: false },
  thursday: { open: '10:00', close: '22:00', closed: false },
  friday: { open: '10:00', close: '22:00', closed: false },
  saturday: { open: '10:00', close: '23:00', closed: false },
  sunday: { open: '11:00', close: '21:00', closed: false },
}

const CURRENCIES = [
  { value: 'PKR', label: 'PKR - Pakistani Rupee' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
  { value: 'INR', label: 'INR - Indian Rupee' },
]

const DAY_NAMES: { key: keyof OperatingHours; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

export default function SettingsPage() {
  const { restaurant } = useAuthStore()
  const { success, error: showError, warning } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [deactivateConfirm, setDeactivateConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const settingsFromRestaurant = useCallback((): SettingsState => {
    const s = (restaurant?.settings || {}) as Record<string, unknown>
    const oh = restaurant?.operating_hours as OperatingHours | null
    return {
      name: restaurant?.name || '',
      address: restaurant?.address || '',
      phone: restaurant?.phone || '',
      email: restaurant?.email || '',
      currency: restaurant?.currency || 'PKR',
      taxRate: restaurant?.tax_rate ?? 16,
      serviceCharge: (s.service_charge as number) ?? 5,
      serviceChargeType: (s.service_charge_type as 'percentage' | 'fixed') ?? 'percentage',
      taxMode: (s.tax_mode as 'inclusive' | 'exclusive') ?? 'exclusive',
      priceRounding: (s.price_rounding as 'none' | 'up' | 'down' | 'nearest') ?? 'none',
      operatingHours: oh || { ...DEFAULT_HOURS },
      autoAcceptOrders: (s.auto_accept_orders as boolean) ?? false,
      orderPrefix: (s.order_prefix as string) ?? '',
      showPricesToKitchen: (s.show_prices_to_kitchen as boolean) ?? false,
      defaultPrepTime: (s.default_prep_time as number) ?? 20,
      allowCancellation: (s.allow_cancellation as boolean) ?? true,
      receiptHeader: (s.receipt_header as string) ?? '',
      receiptFooter: (s.receipt_footer as string) ?? 'Thank you for dining with us!',
      receiptShowInfo: (s.receipt_show_info as boolean) ?? true,
      receiptShowTaxBreakdown: (s.receipt_show_tax_breakdown as boolean) ?? true,
      receiptShowLogo: (s.receipt_show_logo as boolean) ?? true,
      soundEnabled: (s.sound_enabled as boolean) ?? true,
      browserNotifications: (s.browser_notifications as boolean) ?? false,
      emailNotifications: (s.email_notifications as boolean) ?? false,
      kitchenDarkMode: (s.kitchen_dark_mode as boolean) ?? false,
      autoRefreshInterval: (s.auto_refresh_interval as 15 | 30 | 60) ?? 30,
      logoUrl: restaurant?.logo_url ?? null,
    }
  }, [restaurant])

  const [settings, setSettings] = useState<SettingsState>(settingsFromRestaurant)

  useEffect(() => {
    if (restaurant?.id) {
      setSettings(settingsFromRestaurant())
    }
  }, [restaurant, settingsFromRestaurant])

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const updateHours = (day: keyof OperatingHours, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours,
        [day]: {
          ...((prev.operatingHours[day] as { open: string; close: string; closed?: boolean }) || { open: '10:00', close: '22:00' }),
          [field]: value,
        },
      },
    }))
  }

  const applyHoursToAll = (source: keyof OperatingHours) => {
    const sourceDay = settings.operatingHours[source] as { open: string; close: string; closed?: boolean } | undefined
    if (!sourceDay) return
    const newHours = { ...settings.operatingHours }
    DAY_NAMES.forEach(({ key }) => {
      if (key !== source) {
        newHours[key] = { ...sourceDay }
      }
    })
    setSettings(prev => ({ ...prev, operatingHours: newHours }))
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !restaurant?.id) return

    if (file.size > 2 * 1024 * 1024) {
      showError('File Too Large', 'Logo must be under 2MB')
      return
    }

    const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      showError('Invalid File Type', 'Supported formats: SVG, PNG, JPEG, WebP')
      return
    }

    setIsUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('restaurantId', restaurant.id)

      const res = await fetch('/api/settings/upload-logo', { method: 'POST', body: formData })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Upload failed')

      updateSetting('logoUrl', result.logoUrl)
      const { setRestaurant } = useAuthStore.getState()
      setRestaurant({ ...restaurant, logo_url: result.logoUrl })
      success('Logo Uploaded', 'Your restaurant logo has been updated.')
    } catch (err: any) {
      showError('Upload Failed', err.message || 'Failed to upload logo')
    } finally {
      setIsUploadingLogo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!restaurant?.id) {
      showError('Error', 'Restaurant context not found')
      return
    }
    setIsSaving(true)
    try {
      const response = await fetch('/api/settings/restaurant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          name: settings.name,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          currency: settings.currency,
          taxRate: settings.taxRate,
          serviceCharge: settings.serviceCharge,
          serviceChargeType: settings.serviceChargeType,
          taxMode: settings.taxMode,
          priceRounding: settings.priceRounding,
          operatingHours: settings.operatingHours,
          settings: {
            auto_accept_orders: settings.autoAcceptOrders,
            order_prefix: settings.orderPrefix,
            show_prices_to_kitchen: settings.showPricesToKitchen,
            default_prep_time: settings.defaultPrepTime,
            allow_cancellation: settings.allowCancellation,
            receipt_header: settings.receiptHeader,
            receipt_footer: settings.receiptFooter,
            receipt_show_info: settings.receiptShowInfo,
            receipt_show_tax_breakdown: settings.receiptShowTaxBreakdown,
            receipt_show_logo: settings.receiptShowLogo,
            sound_enabled: settings.soundEnabled,
            browser_notifications: settings.browserNotifications,
            email_notifications: settings.emailNotifications,
            kitchen_dark_mode: settings.kitchenDarkMode,
            auto_refresh_interval: settings.autoRefreshInterval,
          },
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to save settings')

      const { setRestaurant } = useAuthStore.getState()
      const updatedRestaurant = {
        ...restaurant,
        name: settings.name,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        currency: settings.currency,
        tax_rate: settings.taxRate,
        operating_hours: settings.operatingHours,
        settings: result.restaurant?.settings || restaurant.settings,
      }
      setRestaurant(updatedRestaurant)

      success('Settings Saved', 'Your changes have been saved successfully.')
    } catch (err: any) {
      showError('Save Failed', err.message || 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleExportData = async () => {
    if (!restaurant?.id) return
    try {
      const supabaseRes = await fetch(`/api/settings/restaurant?restaurantId=${restaurant.id}`)
      const result = await supabaseRes.json()
      if (!supabaseRes.ok) throw new Error(result.error)

      const blob = new Blob([JSON.stringify(result.restaurant, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${restaurant.slug || 'restaurant'}-export.json`
      a.click()
      URL.revokeObjectURL(url)
      success('Export Complete', 'Restaurant data has been downloaded.')
    } catch (err: any) {
      showError('Export Failed', err.message || 'Failed to export data')
    }
  }

  const handleDeactivate = async () => {
    if (!restaurant?.id) return
    try {
      const res = await fetch('/api/settings/restaurant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          action: restaurant.is_active ? 'deactivate' : 'reactivate',
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      const { setRestaurant } = useAuthStore.getState()
      setRestaurant({ ...restaurant, is_active: !restaurant.is_active })

      success(
        restaurant.is_active ? 'Deactivated' : 'Reactivated',
        restaurant.is_active ? 'Your restaurant has been deactivated.' : 'Your restaurant is now active again.'
      )
      setDeactivateConfirm(false)
    } catch (err: any) {
      showError('Action Failed', err.message || 'Failed to update restaurant status')
    }
  }

  const tabs: { id: TabId; label: string; icon: React.ElementType; desc: string }[] = [
    { id: 'general', label: 'General', icon: Building2, desc: 'Restaurant Info' },
    { id: 'business', label: 'Business', icon: DollarSign, desc: 'Taxes & Fees' },
    { id: 'hours', label: 'Hours', icon: Clock, desc: 'Opening Times' },
    { id: 'orders', label: 'Orders', icon: Settings2, desc: 'Order Config' },
    { id: 'receipt', label: 'Receipt', icon: Receipt, desc: 'Receipt & Print' },
    { id: 'display', label: 'Display', icon: Palette, desc: 'Appearance' },
    { id: 'danger', label: 'Danger', icon: AlertTriangle, desc: 'Risk Zone' },
  ]

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,.png,.jpg,.jpeg,.webp"
        onChange={handleLogoUpload}
        className="hidden"
      />

      <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full bg-brand-subtle border border-brand/20 text-[10px] font-bold text-brand uppercase tracking-wider">
                Connected
              </span>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Version 1.0</span>
            </div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Account <span className="text-brand">Settings</span>
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Manage your restaurant information, hours, orders, receipts, and more.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="h-11 px-6 bg-brand hover:bg-brand-hover text-[var(--text-primary)] rounded-lg flex items-center gap-2 transition-all font-medium text-sm shadow-glow disabled:opacity-50 shrink-0"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-4">
            <div className="p-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)]">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all relative',
                    activeTab === tab.id
                      ? tab.id === 'danger'
                        ? 'bg-rose-500/10 text-rose-400'
                        : 'bg-brand text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center",
                    activeTab === tab.id
                      ? tab.id === 'danger' ? 'bg-rose-500/20' : 'bg-white/20'
                      : 'bg-[var(--surface)] border border-[var(--border)]'
                  )}>
                    <tab.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs uppercase tracking-wider block">{tab.label}</span>
                    <p className={cn(
                      "text-[10px] mt-0.5",
                      activeTab === tab.id
                        ? tab.id === 'danger' ? 'text-rose-300' : 'text-[var(--text-primary)]/70'
                        : 'text-[var(--text-muted)]'
                    )}>{tab.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] border-dashed">
              <div className="flex items-center gap-2 text-brand mb-2">
                <Shield className="w-4 h-4" />
                <span className="font-bold text-[10px] uppercase tracking-wider">Security</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Settings are only accessible by the restaurant owner. All changes are logged.
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-9">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {/* =================== GENERAL TAB =================== */}
                {activeTab === 'general' && (
                  <div className="space-y-6">
                    <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] space-y-8">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">Restaurant <span className="text-brand">Info</span></h2>
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Basic information about your business</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label htmlFor="rest-name" className="label">Restaurant Name</label>
                          <input
                            id="rest-name"
                            value={settings.name}
                            onChange={(e) => updateSetting('name', e.target.value)}
                            className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="rest-phone" className="label">Phone Number</label>
                          <input
                            id="rest-phone"
                            value={settings.phone}
                            onChange={(e) => updateSetting('phone', e.target.value)}
                            className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <label htmlFor="rest-email" className="label">Email Address</label>
                          <input
                            id="rest-email"
                            value={settings.email}
                            onChange={(e) => updateSetting('email', e.target.value)}
                            className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <label htmlFor="rest-address" className="label">Business Address</label>
                          <input
                            id="rest-address"
                            value={settings.address}
                            onChange={(e) => updateSetting('address', e.target.value)}
                            className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
                          />
                        </div>
                        {restaurant?.slug && (
                          <div className="md:col-span-2 space-y-2">
                            <label className="label">Restaurant Slug</label>
                            <div className="h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 flex items-center text-sm text-[var(--text-muted)]">
                              {restaurant.slug}
                            </div>
                            <p className="text-[10px] text-[var(--text-muted)]">This is your unique restaurant URL identifier and cannot be changed.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] space-y-6">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">Restaurant <span className="text-brand">Logo</span></h2>
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Upload a logo for receipts, displays, and branding</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="w-24 h-24 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0">
                          {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                          ) : (
                            <Building2 className="w-8 h-8 text-[var(--text-muted)]" />
                          )}
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingLogo}
                            className="h-10 px-4 rounded-lg bg-brand hover:bg-brand-hover text-[var(--text-primary)] transition-all text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                          >
                            {isUploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                          </button>
                          <p className="text-[11px] text-[var(--text-muted)]">SVG, PNG, JPEG, or WebP (Max 2MB)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* =================== BUSINESS TAB =================== */}
                {activeTab === 'business' && (
                  <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] space-y-8">
                    <div>
                      <h2 className="text-lg font-bold text-[var(--text-primary)]">Business <span className="text-brand">Settings</span></h2>
                      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Manage currency, taxes, service charges, and pricing</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label htmlFor="currency" className="label">Currency</label>
                        <select
                          id="currency"
                          value={settings.currency}
                          onChange={(e) => updateSetting('currency', e.target.value)}
                          className="w-full h-11 px-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 appearance-none"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="label">Tax Calculation</label>
                        <div className="flex gap-2">
                          {(['inclusive', 'exclusive'] as const).map(mode => (
                            <button
                              key={mode}
                              onClick={() => updateSetting('taxMode', mode)}
                              className={cn(
                                'flex-1 h-11 rounded-lg border font-semibold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5',
                                settings.taxMode === mode
                                  ? 'bg-brand border-brand text-[var(--text-primary)] shadow-glow'
                                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
                              )}
                            >
                              {mode === 'inclusive' ? <Percent className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                              {mode === 'inclusive' ? 'Inclusive' : 'Exclusive'}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)]">{settings.taxMode === 'inclusive' ? 'Tax is included in menu prices' : 'Tax is added on top of menu prices'}</p>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="tax-rate" className="label">Tax Rate (%)</label>
                        <input
                          id="tax-rate"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={settings.taxRate}
                          onChange={(e) => updateSetting('taxRate', parseFloat(e.target.value) || 0)}
                          className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="label">Price Rounding</label>
                        <select
                          value={settings.priceRounding}
                          onChange={(e) => updateSetting('priceRounding', e.target.value as 'none' | 'up' | 'down' | 'nearest')}
                          className="w-full h-11 px-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 appearance-none"
                        >
                          <option value="none">No Rounding</option>
                          <option value="up">Round Up</option>
                          <option value="down">Round Down</option>
                          <option value="nearest">Round to Nearest</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="service-charge" className="label">Service Charge</label>
                        <div className="flex gap-2">
                          <input
                            id="service-charge"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={settings.serviceCharge}
                            onChange={(e) => updateSetting('serviceCharge', parseFloat(e.target.value) || 0)}
                            className="flex-1 h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
                          />
                          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
                            {(['percentage', 'fixed'] as const).map(type => (
                              <button
                                key={type}
                                onClick={() => updateSetting('serviceChargeType', type)}
                                className={cn(
                                  'h-11 px-3 text-xs font-bold uppercase tracking-wider transition-all',
                                  settings.serviceChargeType === type
                                    ? 'bg-brand text-[var(--text-primary)]'
                                    : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                )}
                              >
                                {type === 'percentage' ? '%' : '$'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {settings.serviceChargeType === 'percentage'
                            ? `${settings.serviceCharge}% of subtotal`
                            : `Flat ${settings.currency} ${settings.serviceCharge} per order`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* =================== HOURS TAB =================== */}
                {activeTab === 'hours' && (
                  <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">Opening <span className="text-brand">Hours</span></h2>
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Set your restaurant&apos;s working times</p>
                      </div>
                      <Globe className="w-6 h-6 text-[var(--text-muted)]" />
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {DAY_NAMES.map(({ key, label }) => {
                        const dayData = settings.operatingHours[key] as { open: string; close: string; closed?: boolean } | undefined
                        const isClosed = dayData?.closed ?? false
                        return (
                          <div key={key} className={cn(
                            "flex items-center justify-between p-4 bg-[var(--surface)] border rounded-lg transition-all",
                            isClosed ? 'border-[var(--border)] opacity-60' : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                          )}>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => updateHours(key, 'closed', !isClosed)}
                                className={cn(
                                  'w-8 h-8 rounded-lg flex items-center justify-center border transition-all',
                                  isClosed ? 'border-[var(--border)] text-[var(--text-muted)]' : 'border-brand/30 bg-brand-subtle text-brand'
                                )}
                              >
                                {isClosed ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                              </button>
                              <span className={cn('font-semibold text-sm min-w-[90px]', isClosed ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]')}>{label}</span>
                            </div>
                            {!isClosed && dayData && (
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Open</span>
                                  <input
                                    type="time"
                                    value={dayData.open || '10:00'}
                                    onChange={(e) => updateHours(key, 'open', e.target.value)}
                                    className="h-9 px-2 bg-[var(--surface-raised)] border border-[var(--border)] rounded-md text-[var(--text-primary)] text-xs font-semibold outline-none focus:border-brand"
                                  />
                                </div>
                                <div className="w-3 h-px bg-[var(--border)]" />
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Close</span>
                                  <input
                                    type="time"
                                    value={dayData.close || '22:00'}
                                    onChange={(e) => updateHours(key, 'close', e.target.value)}
                                    className="h-9 px-2 bg-[var(--surface-raised)] border border-[var(--border)] rounded-md text-[var(--text-primary)] text-xs font-semibold outline-none focus:border-brand"
                                  />
                                </div>
                                {key === 'monday' && (
                                  <button
                                    onClick={() => applyHoursToAll(key)}
                                    title="Apply Monday hours to all days"
                                    className="ml-1 px-2 h-8 rounded-md text-[10px] font-bold uppercase tracking-wider border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:text-brand hover:border-brand transition-all"
                                  >
                                    All
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* =================== ORDERS TAB =================== */}
                {activeTab === 'orders' && (
                  <div className="space-y-6">
                    <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] space-y-6">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">Order <span className="text-brand">Configuration</span></h2>
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Control how orders are processed and displayed</p>
                      </div>
                      <div className="space-y-4">
                        <SettingsToggle
                          title="Auto-Accept Orders"
                          description="New orders are automatically accepted and sent to the kitchen"
                          checked={settings.autoAcceptOrders}
                          onChange={(v) => updateSetting('autoAcceptOrders', v)}
                          icon={<ChefHat className="w-4 h-4" />}
                        />
                        <SettingsToggle
                          title="Allow Cancellation"
                          description="Customers and staff can cancel orders before preparation begins"
                          checked={settings.allowCancellation}
                          onChange={(v) => updateSetting('allowCancellation', v)}
                          icon={<XCircle className="w-4 h-4" />}
                        />
                        <SettingsToggle
                          title="Show Prices to Kitchen"
                          description="Display item prices on kitchen display screens"
                          checked={settings.showPricesToKitchen}
                          onChange={(v) => updateSetting('showPricesToKitchen', v)}
                          icon={<DollarSign className="w-4 h-4" />}
                        />
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] space-y-6">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">Order <span className="text-brand">Numbering</span></h2>
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Customize how order numbers are generated</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label htmlFor="order-prefix" className="label">Order Number Prefix</label>
                          <input
                            id="order-prefix"
                            value={settings.orderPrefix}
                            onChange={(e) => updateSetting('orderPrefix', e.target.value)}
                            placeholder="e.g. ORD-"
                            className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all placeholder:text-[var(--text-muted)]"
                          />
                          <p className="text-[10px] text-[var(--text-muted)]">Leave empty for default numbering. Example: &quot;ORD-&quot; generates ORD-001, ORD-002...</p>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="prep-time" className="label">Default Preparation Time (minutes)</label>
                          <input
                            id="prep-time"
                            type="number"
                            min="1"
                            max="120"
                            value={settings.defaultPrepTime}
                            onChange={(e) => updateSetting('defaultPrepTime', parseInt(e.target.value) || 20)}
                            className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
                          />
                          <p className="text-[10px] text-[var(--text-muted)]">Estimated time shown to customers for order completion</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* =================== RECEIPT TAB =================== */}
                {activeTab === 'receipt' && (
                  <div className="space-y-6">
                    <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] space-y-6">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">Receipt <span className="text-brand">Content</span></h2>
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Customize what appears on printed and digital receipts</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label htmlFor="receipt-header" className="label">Receipt Header</label>
                          <input
                            id="receipt-header"
                            value={settings.receiptHeader}
                            onChange={(e) => updateSetting('receiptHeader', e.target.value)}
                            placeholder="Welcome to our restaurant!"
                            className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all placeholder:text-[var(--text-muted)]"
                          />
                          <p className="text-[10px] text-[var(--text-muted)]">Custom text shown at the top of each receipt</p>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="receipt-footer" className="label">Receipt Footer</label>
                          <input
                            id="receipt-footer"
                            value={settings.receiptFooter}
                            onChange={(e) => updateSetting('receiptFooter', e.target.value)}
                            placeholder="Thank you for dining with us!"
                            className="w-full h-11 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all placeholder:text-[var(--text-muted)]"
                          />
                          <p className="text-[10px] text-[var(--text-muted)]">Custom message shown at the bottom of each receipt</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] space-y-6">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">Receipt <span className="text-brand">Display</span></h2>
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Toggle which information appears on receipts</p>
                      </div>
                      <div className="space-y-3">
                        <SettingsToggle
                          title="Show Restaurant Info"
                          description="Display name, address, phone, and email on receipts"
                          checked={settings.receiptShowInfo}
                          onChange={(v) => updateSetting('receiptShowInfo', v)}
                          icon={<Info className="w-4 h-4" />}
                        />
                        <SettingsToggle
                          title="Show Tax Breakdown"
                          description="Display subtotal, tax rate, and tax amount separately"
                          checked={settings.receiptShowTaxBreakdown}
                          onChange={(v) => updateSetting('receiptShowTaxBreakdown', v)}
                          icon={<Percent className="w-4 h-4" />}
                        />
                        <SettingsToggle
                          title="Show Logo on Receipt"
                          description="Include the restaurant logo on printed receipts"
                          checked={settings.receiptShowLogo}
                          onChange={(v) => updateSetting('receiptShowLogo', v)}
                          icon={<ImageIcon className="w-4 h-4" />}
                        />
                      </div>
                    </div>

                    {/* Receipt Preview */}
                    <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] space-y-4">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">Receipt <span className="text-brand">Preview</span></h2>
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">How your receipt will look</p>
                      </div>
                      <div className="max-w-xs mx-auto bg-white text-gray-900 rounded-lg p-4 shadow-lg text-center font-mono text-xs">
                        {settings.receiptShowLogo && settings.logoUrl && (
                          <img src={settings.logoUrl} alt="" className="w-12 h-12 mx-auto mb-2 object-contain" />
                        )}
                        {settings.receiptHeader && (
                          <p className="text-[10px] text-gray-500 mb-2">{settings.receiptHeader}</p>
                        )}
                        {settings.receiptShowInfo && (
                          <div className="mb-2">
                            <p className="font-bold text-sm">{settings.name || 'Restaurant Name'}</p>
                            {settings.address && <p className="text-[10px] text-gray-500">{settings.address}</p>}
                            {settings.phone && <p className="text-[10px] text-gray-500">{settings.phone}</p>}
                          </div>
                        )}
                        <div className="border-t border-dashed border-gray-300 my-2" />
                        <p className="text-gray-400 text-[10px]">Order #001 &middot; Table 5</p>
                        <div className="border-t border-dashed border-gray-300 my-2" />
                        <div className="text-left space-y-1">
                          <div className="flex justify-between"><span>2x Chicken Biryani</span><span>Rs 1,800</span></div>
                          <div className="flex justify-between"><span>1x Naan</span><span>Rs 80</span></div>
                        </div>
                        <div className="border-t border-dashed border-gray-300 my-2" />
                        {settings.receiptShowTaxBreakdown && (
                          <div className="text-left space-y-0.5 text-[10px]">
                            <div className="flex justify-between"><span>Subtotal</span><span>Rs 1,880</span></div>
                            <div className="flex justify-between text-gray-500"><span>Tax ({settings.taxRate}%)</span><span>Rs 300.80</span></div>
                          </div>
                        )}
                        <div className="flex justify-between font-bold mt-1"><span>Total</span><span>Rs 2,180.80</span></div>
                        <div className="border-t border-dashed border-gray-300 my-2" />
                        {settings.receiptFooter && (
                          <p className="text-[10px] text-gray-500">{settings.receiptFooter}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* =================== DISPLAY & NOTIFICATIONS TAB =================== */}
                {activeTab === 'display' && (
                  <div className="space-y-6">
                    <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] space-y-6">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">Alert <span className="text-brand">Notifications</span></h2>
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Manage how you receive order alerts</p>
                      </div>
                      <div className="space-y-3">
                        <SettingsToggle
                          title="New Order Sound"
                          description="Play a notification sound when a new order is received"
                          checked={settings.soundEnabled}
                          onChange={(v) => updateSetting('soundEnabled', v)}
                          icon={<Volume2 className="w-4 h-4" />}
                        />
                        <SettingsToggle
                          title="Browser Notifications"
                          description="Show desktop push notifications for new orders and updates"
                          checked={settings.browserNotifications}
                          onChange={(v) => updateSetting('browserNotifications', v)}
                          icon={<Bell className="w-4 h-4" />}
                        />
                        <SettingsToggle
                          title="Daily Email Reports"
                          description="Receive a summary of daily operations via email"
                          checked={settings.emailNotifications}
                          onChange={(v) => updateSetting('emailNotifications', v)}
                          icon={<Mail className="w-4 h-4" />}
                        />
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] space-y-6">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">Display <span className="text-brand">Settings</span></h2>
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Customize the dashboard and kitchen appearance</p>
                      </div>
                      <div className="space-y-4">
                        <SettingsToggle
                          title="Kitchen Dark Mode"
                          description="Force high-contrast dark theme for kitchen display screens"
                          checked={settings.kitchenDarkMode}
                          onChange={(v) => updateSetting('kitchenDarkMode', v)}
                          icon={<Moon className="w-4 h-4" />}
                        />
                        <div className="space-y-3">
                          <label className="label flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5" />
                            Auto-Refresh Interval
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            {([15, 30, 60] as const).map((val) => (
                              <button
                                key={val}
                                onClick={() => updateSetting('autoRefreshInterval', val)}
                                className={cn(
                                  "h-11 rounded-lg border font-semibold text-xs uppercase tracking-wider transition-all",
                                  settings.autoRefreshInterval === val
                                    ? "bg-brand border-brand text-[var(--text-primary)] shadow-glow"
                                    : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                                )}
                              >
                                {val < 60 ? `${val} SEC` : '1 MIN'}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)]">How often the dashboard checks for new orders and updates</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* =================== DANGER ZONE TAB =================== */}
                {activeTab === 'danger' && (
                  <div className="space-y-6">
                    <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-rose-500/30 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-rose-400" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-rose-400">Danger <span className="text-rose-300">Zone</span></h2>
                          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Irreversible actions — proceed with caution</p>
                        </div>
                      </div>
                    </div>

                    {/* Export Data */}
                    <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-[var(--text-primary)] text-sm flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            Export Restaurant Data
                          </h3>
                          <p className="text-[11px] text-[var(--text-muted)] mt-1">Download a full JSON export of your restaurant settings, menu, orders, and configuration.</p>
                        </div>
                        <button
                          onClick={handleExportData}
                          className="h-10 px-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all text-sm font-medium flex items-center gap-2 shrink-0"
                        >
                          <Download className="w-4 h-4" />
                          Export JSON
                        </button>
                      </div>
                    </div>

                    {/* Deactivate Restaurant */}
                    <div className="p-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-[var(--text-primary)] text-sm">
                            {restaurant?.is_active ? 'Deactivate Restaurant' : 'Reactivate Restaurant'}
                          </h3>
                          <p className="text-[11px] text-[var(--text-muted)] mt-1">
                            {restaurant?.is_active
                              ? 'Your restaurant will stop accepting orders and become invisible to customers.'
                              : 'Reactivate your restaurant to start accepting orders again.'}
                          </p>
                        </div>
                        {!deactivateConfirm ? (
                          <button
                            onClick={() => setDeactivateConfirm(true)}
                            className={cn(
                              "h-10 px-4 rounded-lg border text-sm font-medium flex items-center gap-2 shrink-0 transition-all",
                              restaurant?.is_active
                                ? "border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                                : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            )}
                          >
                            {restaurant?.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        ) : (
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={handleDeactivate}
                              className={cn(
                                "h-10 px-4 rounded-lg text-sm font-medium flex items-center gap-2",
                                restaurant?.is_active
                                  ? "bg-rose-500 text-white hover:bg-rose-600"
                                  : "bg-emerald-500 text-white hover:bg-emerald-600"
                              )}
                            >
                              {restaurant?.is_active ? 'Confirm Deactivate' : 'Confirm Reactivate'}
                            </button>
                            <button
                              onClick={() => setDeactivateConfirm(false)}
                              className="h-10 px-4 rounded-lg border border-[var(--border)] text-[var(--text-muted)] text-sm font-medium hover:text-[var(--text-primary)] transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status indicator */}
                    <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        restaurant?.is_active ? "bg-emerald-400" : "bg-rose-400"
                      )} />
                      <span className="text-sm text-[var(--text-secondary)]">
                        Restaurant status: <span className="font-semibold text-[var(--text-primary)]">{restaurant?.is_active ? 'Active' : 'Inactive'}</span>
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsToggle({ title, description, checked, onChange, icon }: {
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">
            {icon}
          </div>
        )}
        <div>
          <p className="font-semibold text-[var(--text-primary)] text-sm">{title}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{description}</p>
        </div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "w-12 h-6 rounded-full transition-all relative",
        checked ? 'bg-brand' : 'bg-[var(--surface-active)]'
      )}
      aria-pressed={checked}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn(
          "absolute top-1 w-4 h-4 rounded-full shadow-md transition-colors",
          checked ? 'left-7 bg-white' : 'left-1 bg-[var(--text-muted)]'
        )}
      />
    </button>
  )
}