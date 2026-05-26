'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  ChefHat, Wine, Monitor, Users, QrCode, X, List, Columns,
  Grid3X3, Minimize2, Clock, Volume2, VolumeX, Eye, EyeOff, Megaphone, Presentation, CreditCard
} from 'lucide-react'
import type { Display, DisplayType, DisplayTemplate, DisplaySettings } from '@/types/display'
import { getDisplaySyncRule } from '@/lib/display-access'

interface DisplayModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (display: Partial<Display>) => Promise<void>
  display?: Display | null
  restaurantId: string
  existingSlugs: string[]
}

const TYPE_OPTIONS: { type: DisplayType; icon: any; label: string; description: string }[] = [
  { type: 'kitchen', icon: ChefHat, label: 'Kitchen Display', description: 'Orders for kitchen staff' },
  { type: 'bar', icon: Wine, label: 'Bar Display', description: 'Drinks and beverages only' },
  { type: 'counter', icon: Monitor, label: 'Counter Display', description: 'Ready orders for pickup' },
  { type: 'cashier', icon: CreditCard, label: 'Cashier Display', description: 'Payments and billing queue' },
  { type: 'waiting', icon: Users, label: 'Waiting Area', description: 'Menus and announcements' },
  { type: 'qr', icon: QrCode, label: 'QR Ordering', description: 'QR code for customer ordering' },
  { type: 'advertisement', icon: Megaphone, label: 'Advertisement', description: 'Slideshow for promotions' },
]

const TEMPLATE_OPTIONS: { template: DisplayTemplate; icon: any; label: string; description: string }[] = [
  { template: 'list', icon: List, label: 'Classic List', description: 'Simple vertical list' },
  { template: 'kanban', icon: Columns, label: 'Kanban Board', description: 'Three-column workflow' },
  { template: 'grid', icon: Grid3X3, label: 'Grid Cards', description: 'Visual card layout' },
  { template: 'compact', icon: Minimize2, label: 'Minimal Compact', description: 'Maximum density' },
  { template: 'slideshow', icon: Presentation, label: 'Slideshow', description: 'Auto-cycling display' },
]

export function DisplayModal({ isOpen, onClose, onSave, display, restaurantId, existingSlugs }: DisplayModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [form, setForm] = useState<{
    name: string
    slug: string
    type: DisplayType
    template: DisplayTemplate
    settings: DisplaySettings
  }>({
    name: '',
    slug: '',
    type: 'kitchen',
    template: 'list',
    settings: {
      refresh_interval: 5,
      sound_enabled: true,
      theme: 'dark',
      show_timer: true,
      priority_enabled: true,
    },
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (display) {
      setForm({
        name: display.name,
        slug: display.slug,
        type: display.type,
        template: display.template,
        settings: display.settings,
      })
    } else {
      setForm({
        name: '',
        slug: '',
        type: 'kitchen',
        template: 'list',
        settings: {
          refresh_interval: 5,
          sound_enabled: true,
          theme: 'dark',
          show_timer: true,
          priority_enabled: true,
        },
      })
    }
    setErrors({})
  }, [display, isOpen])

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50)
  }

  const handleNameChange = (name: string) => {
    setForm(prev => ({
      ...prev,
      name,
      slug: display?.name === name ? prev.slug : generateSlug(name)
    }))
    if (errors.name) setErrors(prev => ({ ...prev, name: '' }))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!form.name.trim()) newErrors.name = 'Display name is required'
    if (!form.slug.trim()) newErrors.slug = 'URL slug is required'
    else if (!/^[a-z0-9-]+$/.test(form.slug)) newErrors.slug = 'Only lowercase letters, numbers, and hyphens'
    else if (existingSlugs.includes(form.slug) && display?.slug !== form.slug) {
      newErrors.slug = 'This slug is already in use'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setIsLoading(true)
    try {
      const syncRule = getDisplaySyncRule(form.type)
      await onSave({
        id: display?.id,
        restaurant_id: restaurantId,
        name: form.name,
        slug: form.slug,
        type: form.type,
        template: form.template,
        settings: {
          ...form.settings,
          allowed_roles: syncRule.roles,
          sync_target: syncRule.label,
        },
        is_active: display?.is_active ?? true,
      })
      onClose()
    } catch (error: any) {
      console.error('Failed to save display:', error?.message || error?.code || error)
      alert('Failed to save display: ' + (error?.message || 'Unknown error'))
    }
    setIsLoading(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-neutral-800">
                <div>
                  <h2 className="text-2xl font-black">
                    {display ? 'Edit Display' : 'Create New Display'}
                  </h2>
                  <p className="text-sm text-neutral-500">
                    Configure your digital signage display
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-bold text-neutral-300 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Kitchen Display 1"
                    className={cn(
                      "w-full px-4 py-3 rounded-xl bg-neutral-900 border text-white placeholder:text-neutral-600 outline-none transition-colors",
                      errors.name ? "border-red-500" : "border-neutral-800 focus:border-orange-500"
                    )}
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-bold text-neutral-300 mb-2">
                    URL Slug
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500 text-sm">/display/</span>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => {
                        setForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))
                        if (errors.slug) setErrors(prev => ({ ...prev, slug: '' }))
                      }}
                      placeholder="kitchen-1"
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl bg-neutral-900 border text-white placeholder:text-neutral-600 outline-none transition-colors font-mono",
                        errors.slug ? "border-red-500" : "border-neutral-800 focus:border-orange-500"
                      )}
                    />
                  </div>
                  {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug}</p>}
                </div>

                {/* Display Type */}
                <div>
                  <label className="block text-sm font-bold text-neutral-300 mb-3">
                    Display Type
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {TYPE_OPTIONS.map(({ type, icon: Icon, label, description }) => {
                      const syncRule = getDisplaySyncRule(type)
                      return (
                      <button
                        key={type}
                        onClick={() => setForm(prev => ({
                          ...prev,
                          type,
                          settings: {
                            ...prev.settings,
                            allowed_roles: syncRule.roles,
                            sync_target: syncRule.label,
                          }
                        }))}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                          form.type === type
                            ? "border-orange-500 bg-orange-500/10"
                            : "border-neutral-800 hover:border-neutral-700 bg-neutral-900/50"
                        )}
                      >
                        <Icon className={cn("w-6 h-6", form.type === type ? "text-orange-500" : "text-neutral-500")} />
                        <div>
                          <p className="font-bold text-sm">{label}</p>
                          <p className="text-xs text-neutral-500">{description}</p>
                          <p className="mt-1 text-[10px] text-orange-300/80">
                            {syncRule.roles.map(role => role.charAt(0).toUpperCase() + role.slice(1)).join(' / ')}
                          </p>
                        </div>
                      </button>
                    )})}
                  </div>
                </div>

                {/* Template */}
                <div>
                  <label className="block text-sm font-bold text-neutral-300 mb-3">
                    Layout Template
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {TEMPLATE_OPTIONS.map(({ template, icon: Icon, label, description }) => (
                      <button
                        key={template}
                        onClick={() => setForm(prev => ({ ...prev, template }))}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                          form.template === template
                            ? "border-orange-500 bg-orange-500/10"
                            : "border-neutral-800 hover:border-neutral-700 bg-neutral-900/50"
                        )}
                      >
                        <Icon className={cn("w-5 h-5", form.template === template ? "text-orange-500" : "text-neutral-500")} />
                        <div>
                          <p className="font-bold text-xs">{label}</p>
                          <p className="text-[10px] text-neutral-500">{description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advanced Settings */}
                <div>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm font-bold text-neutral-400 hover:text-white transition-colors"
                  >
                    <span>Advanced Settings</span>
                    <span className={cn("transform transition-transform", showAdvanced ? "rotate-180" : "")}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>

                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 space-y-4"
                    >
                      {/* Refresh Interval */}
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">
                          Auto-refresh Interval
                        </label>
                        <select
                          value={form.settings.refresh_interval}
                          onChange={(e) => setForm(prev => ({
                            ...prev,
                            settings: { ...prev.settings, refresh_interval: Number(e.target.value) }
                          }))}
                          className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white outline-none focus:border-orange-500"
                        >
                          <option value={3}>Every 3 seconds</option>
                          <option value={5}>Every 5 seconds</option>
                          <option value={10}>Every 10 seconds</option>
                          <option value={15}>Every 15 seconds</option>
                          <option value={30}>Every 30 seconds</option>
                        </select>
                      </div>

                      {/* Theme */}
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">
                          Theme
                        </label>
                        <div className="flex gap-3">
                          {(['dark', 'light'] as const).map(theme => (
                            <button
                              key={theme}
                              onClick={() => setForm(prev => ({
                                ...prev,
                                settings: { ...prev.settings, theme }
                              }))}
                              className={cn(
                                "flex-1 py-3 rounded-xl border-2 font-bold text-sm capitalize transition-all",
                                form.settings.theme === theme
                                  ? "border-orange-500 bg-orange-500/10 text-orange-400"
                                  : "border-neutral-800 text-neutral-500 hover:border-neutral-700"
                              )}
                            >
                              {theme === 'dark' ? 'Dark' : 'Light'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Toggles */}
                      <div className="space-y-3">
                        <Toggle
                          label="Show Timers"
                          description="Display order wait time"
                          checked={form.settings.show_timer}
                          onChange={(checked) => setForm(prev => ({
                            ...prev,
                            settings: { ...prev.settings, show_timer: checked }
                          }))}
                        />
                        <Toggle
                          label="Sound Notifications"
                          description="Play sound for new orders"
                          checked={form.settings.sound_enabled}
                          onChange={(checked) => setForm(prev => ({
                            ...prev,
                            settings: { ...prev.settings, sound_enabled: checked }
                          }))}
                        />
                        <Toggle
                          label="Priority Flagging"
                          description="Allow priority orders"
                          checked={form.settings.priority_enabled}
                          onChange={(checked) => setForm(prev => ({
                            ...prev,
                            settings: { ...prev.settings, priority_enabled: checked }
                          }))}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-4 p-6 border-t border-neutral-800">
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl font-bold text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className={cn(
                    "px-8 py-3 rounded-xl font-bold bg-orange-600 hover:bg-orange-700 transition-all",
                    isLoading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isLoading ? 'Saving...' : display ? 'Save Changes' : 'Create Display'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="font-bold text-sm text-white">{label}</p>
        <p className="text-xs text-neutral-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-12 h-6 rounded-full transition-colors",
          checked ? "bg-orange-600" : "bg-neutral-700"
        )}
      >
        <motion.div
          animate={{ x: checked ? 24 : 2 }}
          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
        />
      </button>
    </div>
  )
}
