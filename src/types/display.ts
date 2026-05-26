export type DisplayType = 'kitchen' | 'bar' | 'counter' | 'cashier' | 'waiting' | 'qr' | 'advertisement'
export type DisplayTemplate = 'list' | 'kanban' | 'grid' | 'compact' | 'slideshow'
export type DisplayTheme = 'dark' | 'light'

export type AdContentType = 'image' | 'video' | 'youtube' | 'url'
export type TransitionEffect = 'fade' | 'slide' | 'zoom'

export interface AdContent {
  id: string
  restaurant_id: string
  display_id: string | null
  title: string
  description: string | null
  media_url: string | null
  media_type: AdContentType
  duration_seconds: number
  display_order: number
  background_color: string
  text_color: string
  cta_text: string | null
  cta_url: string | null
  is_active: boolean
  schedule_start: string | null
  schedule_end: string | null
  created_at: string
  updated_at: string
}

export interface DisplaySettings {
  refresh_interval: number
  sound_enabled: boolean
  theme: DisplayTheme
  show_timer: boolean
  priority_enabled: boolean
  allowed_roles?: string[]
  sync_target?: string
}

export interface Display {
  id: string
  restaurant_id: string
  name: string
  slug: string
  type: DisplayType
  template: DisplayTemplate
  settings: DisplaySettings
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DisplayAnalytics {
  display_id: string
  total_orders: number
  avg_completion_time: number
  last_active: string | null
  display_name: string
  display_type: DisplayType
}

export const DISPLAY_TYPE_CONFIG: Record<DisplayType, {
  icon: string
  color: string
  bgGradient: string
  label: string
  description: string
}> = {
  kitchen: {
    icon: 'ChefHat',
    color: 'orange',
    bgGradient: 'from-orange-600 to-red-600',
    label: 'Kitchen Display',
    description: 'Orders queue for kitchen staff with timers'
  },
  bar: {
    icon: 'Wine',
    color: 'purple',
    bgGradient: 'from-purple-600 to-pink-600',
    label: 'Bar Display',
    description: 'Drinks and beverages only'
  },
  counter: {
    icon: 'Monitor',
    color: 'cyan',
    bgGradient: 'from-cyan-600 to-blue-600',
    label: 'Counter Display',
    description: 'Ready orders for pickup'
  },
  cashier: {
    icon: 'CreditCard',
    color: 'sky',
    bgGradient: 'from-sky-600 to-indigo-600',
    label: 'Cashier Display',
    description: 'Payment queue and billing handoff screen'
  },
  waiting: {
    icon: 'Users',
    color: 'emerald',
    bgGradient: 'from-emerald-600 to-green-600',
    label: 'Waiting Area',
    description: 'Menus and announcements'
  },
  qr: {
    icon: 'QrCode',
    color: 'amber',
    bgGradient: 'from-amber-600 to-orange-600',
    label: 'QR Ordering',
    description: 'QR code display for customer ordering'
  },
  advertisement: {
    icon: 'Megaphone',
    color: 'pink',
    bgGradient: 'from-pink-600 to-purple-600',
    label: 'Advertisement',
    description: 'Slideshow for promotions and announcements'
  }
}

export const TEMPLATE_CONFIG: Record<DisplayTemplate, {
  label: string
  description: string
  icon: string
}> = {
  list: {
    label: 'Classic List',
    description: 'Simple vertical list view',
    icon: 'List'
  },
  kanban: {
    label: 'Kanban Board',
    description: 'Pending / Preparing / Ready columns',
    icon: 'Columns'
  },
  grid: {
    label: 'Grid Cards',
    description: 'Card layout with images',
    icon: 'Grid3X3'
  },
  compact: {
    label: 'Minimal Compact',
    description: 'Maximum density view',
    icon: 'Minimize2'
  },
  slideshow: {
    label: 'Slideshow',
    description: 'Rotating slides for promotions and announcements',
    icon: 'Presentation'
  }
}
