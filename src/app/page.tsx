'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  TrendingUp,
  Clock,
  Zap,
  ChefHat,
  Utensils,
  Smartphone,
  Truck,
  QrCode,
  CreditCard,
  Users,
  BarChart3,
  Globe,
  Shield,
  MessageSquare,
  Map,
  Bell,
  Package,
  Store,
  Star,
  Check,
  Play,
  Calendar,
  Receipt,
  Wallet,
  Target,
  Gift,
  Settings,
  Tv,
  ClipboardList,
  Timer,
  Volume2,
  Navigation,
  Award,
  PieChart,
  DollarSign,
  Layers,
  Bike,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  CheckCircle2,
  ArrowUpRight
} from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui/common'

// Feature categories data
const featureCategories = [
  {
    id: 'orders',
    name: 'Order Management',
    icon: ClipboardList,
    color: 'orange',
    description: 'Complete POS system for all order types',
    features: [
      { title: 'Take Order POS', desc: 'Intuitive interface for dine-in, delivery, and takeout orders', icon: Smartphone },
      { title: 'QR Code Ordering', desc: 'Generate table QR codes for contactless self-ordering', icon: QrCode },
      { title: 'Multi-Channel Orders', desc: 'Unified view for walk-in, phone, and online orders', icon: Layers },
      { title: 'Real-time Updates', desc: 'Instant order status sync across all devices', icon: Zap },
    ]
  },
  {
    id: 'kitchen',
    name: 'Kitchen Operations',
    icon: ChefHat,
    color: 'purple',
    description: 'Real-time kitchen display and management',
    features: [
      { title: 'Kitchen Display System', desc: 'Priority-based order queue with elapsed time tracking', icon: Tv },
      { title: 'Order Timers', desc: 'Visual alerts when orders exceed target prep time', icon: Timer },
      { title: 'Sound Notifications', desc: 'Audio alerts for new orders and urgency', icon: Volume2 },
      { title: 'Fullscreen Mode', desc: 'Dedicated display mode for kitchen monitors', icon: Tv },
    ]
  },
  {
    id: 'delivery',
    name: 'Delivery & Tracking',
    icon: Truck,
    color: 'blue',
    description: 'Complete delivery operations management',
    features: [
      { title: 'Delivery Dashboard', desc: 'Monitor all active deliveries in real-time', icon: Map },
      { title: 'Rider Assignment', desc: 'Assign and manage delivery riders efficiently', icon: Bike },
      { title: 'Live GPS Tracking', desc: 'Google Maps integration with real-time rider location', icon: Navigation },
      { title: 'Customer Tracking', desc: 'Public tracking page for customer order status', icon: MapPin },
    ]
  },
  {
    id: 'staff',
    name: 'Staff & HR',
    icon: Users,
    color: 'emerald',
    description: 'Complete workforce management',
    features: [
      { title: 'Role-Based Access', desc: 'Owner, Manager, Waiter, Kitchen, Cashier, Rider roles', icon: Shield },
      { title: 'Shift Scheduling', desc: 'Create and manage staff shifts and schedules', icon: Calendar },
      { title: 'Performance Analytics', desc: 'Track staff productivity and sales metrics', icon: TrendingUp },
      { title: 'Tips Tracker', desc: 'Monitor and distribute staff tips fairly', icon: Wallet },
    ]
  },
  {
    id: 'tables',
    name: 'Tables & Reservations',
    icon: Utensils,
    color: 'pink',
    description: 'Floor management and bookings',
    features: [
      { title: 'Table Management', desc: 'Visual floor plan with real-time status', icon: Utensils },
      { title: 'Reservation System', desc: 'Online and phone booking management', icon: Calendar },
      { title: 'Capacity Tracking', desc: 'Monitor table availability and occupancy', icon: Users },
      { title: 'Guest Communication', desc: 'SMS/WhatsApp notifications for reservations', icon: MessageSquare },
    ]
  },
  {
    id: 'analytics',
    name: 'Analytics & Finance',
    icon: BarChart3,
    color: 'cyan',
    description: 'Business intelligence and reporting',
    features: [
      { title: 'Revenue Dashboard', desc: 'Real-time sales, trends, and comparisons', icon: TrendingUp },
      { title: 'Detailed Reports', desc: 'Daily, weekly, monthly business reports', icon: PieChart },
      { title: 'Expense Tracking', desc: 'Monitor and categorize all expenses', icon: DollarSign },
      { title: 'Performance Metrics', desc: 'Staff, item, and channel performance', icon: Target },
    ]
  },
  {
    id: 'customers',
    name: 'Customer Engagement',
    icon: Gift,
    color: 'amber',
    description: 'Loyalty and customer retention',
    features: [
      { title: 'Loyalty Program', desc: 'Points-based rewards with tier system', icon: Award },
      { title: 'Discount Codes', desc: 'Create and manage promotional codes', icon: Receipt },
      { title: 'Feedback Collection', desc: 'Collect and analyze customer reviews', icon: Star },
      { title: 'Push Notifications', desc: 'WhatsApp/SMS alerts via Twilio', icon: Bell },
    ]
  },
  {
    id: 'inventory',
    name: 'Menu & Inventory',
    icon: Package,
    color: 'rose',
    description: 'Stock and menu management',
    features: [
      { title: 'Menu Management', desc: 'Categories, items, prices, and images', icon: ClipboardList },
      { title: 'Daily Specials', desc: 'Feature items with promotional pricing', icon: Star },
      { title: 'Inventory Tracking', desc: 'Stock levels with low-stock alerts', icon: Package },
      { title: 'Auto Deduction', desc: 'Automatic stock updates on orders', icon: Zap },
    ]
  },
]

// Role showcase data
const roles = [
  {
    name: 'Owner/Manager',
    icon: Store,
    color: 'orange',
    features: ['Full dashboard access', 'Analytics & reports', 'Staff management', 'Settings control']
  },
  {
    name: 'Waiter',
    icon: ClipboardList,
    color: 'emerald',
    features: ['Take orders', 'Table management', 'My orders view', 'Tips tracking']
  },
  {
    name: 'Kitchen Staff',
    icon: ChefHat,
    color: 'purple',
    features: ['Kitchen display', 'Order queue', 'Status updates', 'Timer alerts']
  },
  {
    name: 'Cashier',
    icon: CreditCard,
    color: 'blue',
    features: ['Billing station', 'Payment processing', 'Order checkout', 'Daily reports']
  },
  {
    name: 'Delivery Rider',
    icon: Bike,
    color: 'pink',
    features: ['Active deliveries', 'GPS navigation', 'Status updates', 'Earnings tracking']
  },
]

// Tech integrations
const integrations = [
  { name: 'Google Maps', desc: 'Real-time GPS tracking', icon: Map },
  { name: 'Twilio', desc: 'SMS & WhatsApp alerts', icon: MessageSquare },
  { name: 'Supabase', desc: 'Real-time database', icon: Zap },
  { name: 'Multi-Device', desc: 'Works on any device', icon: Smartphone },
]

export default function LandingPage() {
  const [activeCategory, setActiveCategory] = useState('orders')

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  const activeFeatures = featureCategories.find(c => c.id === activeCategory)

  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-orange-500 selection:text-white font-sans overflow-hidden">

      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-transparent to-neutral-950" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-4">
        <div className="max-w-7xl mx-auto backdrop-blur-xl bg-neutral-900/70 border border-neutral-800/50 rounded-2xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Nexus<span className="text-orange-500">POS</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-neutral-400 hover:text-white transition-colors">Features</a>
            <a href="#roles" className="text-sm text-neutral-400 hover:text-white transition-colors">For Teams</a>
            <a href="#pricing" className="text-sm text-neutral-400 hover:text-white transition-colors">Pricing</a>
            <a href="#testimonials" className="text-sm text-neutral-400 hover:text-white transition-colors">Reviews</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/staff-login">
              <Button variant="ghost" className="hidden md:flex text-neutral-400 hover:text-white">Staff</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="hidden sm:flex text-neutral-400 hover:text-white">Login</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold px-6 shadow-lg shadow-orange-500/25">
                Start Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 md:pt-40 pb-20 px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-6xl mx-auto text-center"
        >
          <Badge variant="outline" className="px-4 py-2 text-xs uppercase tracking-widest font-bold rounded-full mb-8 inline-flex items-center gap-2 bg-orange-500/10 border-orange-500/30 text-orange-400">
            <Zap className="w-3 h-3" /> 30+ Features • Live GPS • Multi-Restaurant
          </Badge>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] mb-8">
            THE COMPLETE
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-red-500">
              RESTAURANT OS
            </span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-400 max-w-3xl mx-auto leading-relaxed mb-10">
            From taking orders to tracking deliveries in real-time. Kitchen displays, staff management,
            analytics, loyalty programs, and more — <span className="text-white font-medium">all in one powerful platform.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/register">
              <Button className="h-14 px-10 text-lg font-bold bg-white text-neutral-900 hover:bg-neutral-100 rounded-2xl shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)]">
                Start 14-Day Free Trial
              </Button>
            </Link>
            <Link href="/order">
              <Button variant="outline" className="h-14 px-10 text-lg font-bold border-neutral-700 text-neutral-300 hover:bg-neutral-800 rounded-2xl group">
                <Play className="w-5 h-5 mr-2 group-hover:text-orange-500 transition-colors" />
                Live Demo
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 max-w-4xl mx-auto border-t border-neutral-800/50 pt-10">
            {[
              { value: '30+', label: 'Features' },
              { value: '6', label: 'User Roles' },
              { value: '<3min', label: 'Setup Time' },
              { value: '24/7', label: 'Support' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-black text-white mb-1">{stat.value}</div>
                <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Feature Categories - Interactive Tabs */}
      <section id="features" className="py-24 px-4 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 bg-purple-500/10 border-purple-500/30 text-purple-400">
              Complete Feature Set
            </Badge>
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              Everything You <span className="text-orange-500">Need</span>
            </h2>
            <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
              From front-of-house to kitchen to delivery — every aspect of your restaurant, perfected.
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {featureCategories.map((category) => {
              const Icon = category.icon
              const isActive = activeCategory === category.id
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${isActive
                      ? `bg-${category.color}-500/20 border border-${category.color}-500/30 text-${category.color}-400`
                      : 'bg-neutral-900/50 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  style={isActive ? {
                    backgroundColor: `color-mix(in srgb, var(--${category.color}-500) 15%, transparent)`,
                    borderColor: `color-mix(in srgb, var(--${category.color}-500) 30%, transparent)`,
                  } : {}}
                >
                  <Icon className="w-4 h-4" />
                  {category.name}
                </button>
              )
            })}
          </div>

          {/* Active Category Features */}
          <AnimatePresence mode="wait">
            {activeFeatures && (
              <motion.div
                key={activeFeatures.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-8 md:p-12 bg-neutral-900/50 border-neutral-800">
                  <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div>
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-${activeFeatures.color}-500/10 border border-${activeFeatures.color}-500/20 mb-6`}>
                        <activeFeatures.icon className={`w-5 h-5 text-${activeFeatures.color}-500`} />
                        <span className={`text-sm font-bold text-${activeFeatures.color}-400`}>{activeFeatures.name}</span>
                      </div>
                      <h3 className="text-3xl font-black text-white mb-4">{activeFeatures.description}</h3>
                      <div className="space-y-4">
                        {activeFeatures.features.map((feature, i) => (
                          <div key={i} className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center flex-shrink-0">
                              <feature.icon className="w-5 h-5 text-neutral-400" />
                            </div>
                            <div>
                              <h4 className="font-bold text-white">{feature.title}</h4>
                              <p className="text-sm text-neutral-400">{feature.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="relative aspect-[4/3] rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <activeFeatures.icon className={`w-20 h-20 mx-auto mb-4 text-${activeFeatures.color}-500 opacity-20`} />
                          <p className="text-neutral-500 text-sm">Feature Preview</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Quick Feature Grid */}
      <section className="py-12 px-4 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { icon: Smartphone, label: 'Take Orders', color: 'orange' },
              { icon: ChefHat, label: 'Kitchen Display', color: 'purple' },
              { icon: Truck, label: 'Delivery Tracking', color: 'blue' },
              { icon: BarChart3, label: 'Analytics', color: 'cyan' },
              { icon: QrCode, label: 'QR Ordering', color: 'pink' },
              { icon: Calendar, label: 'Reservations', color: 'emerald' },
              { icon: Gift, label: 'Loyalty Program', color: 'amber' },
              { icon: Users, label: 'Staff Management', color: 'rose' },
              { icon: Package, label: 'Inventory', color: 'violet' },
              { icon: DollarSign, label: 'Expenses', color: 'green' },
              { icon: Store, label: 'Multi-Location', color: 'indigo' },
              { icon: Map, label: 'Live GPS', color: 'teal' },
            ].map((feature, i) => (
              <motion.div key={i} variants={item}>
                <Card className="p-4 bg-neutral-900/30 border-neutral-800 hover:border-neutral-700 transition-all group text-center">
                  <feature.icon className={`w-8 h-8 mx-auto mb-2 text-neutral-500 group-hover:text-${feature.color}-500 transition-colors`} />
                  <p className="text-sm font-bold text-neutral-400 group-hover:text-white transition-colors">{feature.label}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Role-Based Features */}
      <section id="roles" className="py-24 px-4 bg-neutral-900/30 border-y border-neutral-800/50 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
              For Every Role
            </Badge>
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              One Platform, <span className="text-orange-500">Every Role</span>
            </h2>
            <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
              Tailored interfaces for each team member. Everyone gets exactly what they need.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-4">
            {roles.map((role, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-6 bg-neutral-950 border-neutral-800 hover:border-neutral-700 transition-all h-full">
                  <div className={`w-12 h-12 rounded-xl bg-${role.color}-500/20 flex items-center justify-center mb-4`}>
                    <role.icon className={`w-6 h-6 text-${role.color}-500`} />
                  </div>
                  <h3 className="font-bold text-white mb-3">{role.name}</h3>
                  <ul className="space-y-2">
                    {role.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-xs text-neutral-400">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-24 px-4 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              Powerful <span className="text-orange-500">Integrations</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {integrations.map((integration, i) => (
              <Card key={i} className="p-6 bg-neutral-900/50 border-neutral-800 text-center">
                <integration.icon className="w-10 h-10 mx-auto mb-3 text-orange-500" />
                <h4 className="font-bold text-white mb-1">{integration.name}</h4>
                <p className="text-xs text-neutral-500">{integration.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 bg-neutral-900/30 border-y border-neutral-800/50 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              Up & Running in <span className="text-orange-500">3 Minutes</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Sign Up', desc: 'Create your account in 30 seconds', icon: Mail },
              { step: '02', title: 'Add Menu', desc: 'Input categories and items', icon: ClipboardList },
              { step: '03', title: 'Setup Team', desc: 'Add staff with their roles', icon: Users },
              { step: '04', title: 'Go Live', desc: 'Start taking orders instantly', icon: Zap },
            ].map((item, i) => (
              <div key={i} className="text-center p-8 bg-neutral-950 rounded-3xl border border-neutral-800 relative">
                {i < 3 && (
                  <ChevronRight className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 text-neutral-700 hidden md:block" />
                )}
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-7 h-7 text-orange-500" />
                </div>
                <div className="text-4xl font-black text-neutral-800 mb-2">{item.step}</div>
                <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                <p className="text-sm text-neutral-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
              Simple Pricing
            </Badge>
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              One Plan, <span className="text-orange-500">Everything Included</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Trial */}
            <Card className="p-8 bg-neutral-900/50 border-neutral-800">
              <div className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4">Free Trial</div>
              <div className="text-4xl font-black text-white mb-2">Rs 0</div>
              <div className="text-neutral-400 mb-6">14 days, no credit card required</div>
              <ul className="space-y-3 mb-8">
                {['All 30+ features', 'Unlimited orders', 'Full support', 'No commitment'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-neutral-300">
                    <Check className="w-5 h-5 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <Button variant="outline" className="w-full h-12 border-neutral-700">
                  Start Free Trial
                </Button>
              </Link>
            </Card>

            {/* Pro */}
            <Card className="p-8 bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/30 relative overflow-hidden">
              <Badge className="absolute top-4 right-4 bg-orange-500 text-white">Most Popular</Badge>
              <div className="text-sm font-bold text-orange-400 uppercase tracking-widest mb-4">Pro</div>
              <div className="text-4xl font-black text-white mb-2">Rs 4,999<span className="text-lg text-neutral-400 font-normal">/mo</span></div>
              <div className="text-neutral-400 mb-6">Per restaurant location</div>
              <ul className="space-y-3 mb-8">
                {[
                  'Everything in Free Trial',
                  'Unlimited staff accounts',
                  'WhatsApp notifications',
                  'Live GPS tracking',
                  'Priority support',
                  'Custom branding'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-white">
                    <Check className="w-5 h-5 text-orange-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <Button className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold">
                  Get Started Now
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-4 bg-neutral-900/30 border-y border-neutral-800/50 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              Loved by <span className="text-orange-500">Restaurant Owners</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Ali Khan', role: 'Owner, Karachi Biryani', quote: 'The kitchen display changed everything. Orders come in real-time, and our prep time dropped by 40%. Best investment we made.' },
              { name: 'Fatima Shah', role: 'Manager, Lahore Grill', quote: 'Finally a POS that understands Pakistani restaurants. The staff management and shift scheduling is exactly what we needed!' },
              { name: 'Hassan Ahmed', role: 'Owner, Fresh Bites', quote: 'The live GPS tracking made our customers so happy. They can see exactly where their food is. Revenue up 30%!' },
            ].map((testimonial, i) => (
              <Card key={i} className="p-6 bg-neutral-950 border-neutral-800">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-orange-500 text-orange-500" />
                  ))}
                </div>
                <p className="text-neutral-300 mb-6">"{testimonial.quote}"</p>
                <div>
                  <div className="font-bold text-white">{testimonial.name}</div>
                  <div className="text-sm text-neutral-500">{testimonial.role}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              Frequently Asked <span className="text-orange-500">Questions</span>
            </h2>
          </div>

          <div className="space-y-4">
            {[
              { q: 'Do I need special hardware?', a: 'No! NexusPOS works on any device with a browser - tablets, phones, laptops. No special POS hardware required.' },
              { q: 'How long does setup take?', a: 'Most restaurants are fully set up within 3 minutes. Add your menu, create staff accounts, and you\'re ready to take orders.' },
              { q: 'Can I use it for delivery and dine-in?', a: 'Absolutely! NexusPOS handles all order types - dine-in, takeout, delivery, and online orders in one unified system.' },
              { q: 'Is my data secure?', a: 'Yes. We use bank-grade encryption and your data is hosted on secure cloud servers with automatic backups.' },
              { q: 'Can I manage multiple restaurants?', a: 'Yes! Our multi-restaurant feature lets you manage unlimited locations from a single dashboard.' },
            ].map((faq, i) => (
              <Card key={i} className="p-6 bg-neutral-900/50 border-neutral-800">
                <h4 className="font-bold text-white mb-2">{faq.q}</h4>
                <p className="text-neutral-400 text-sm">{faq.a}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            Ready to Transform Your Restaurant?
          </h2>
          <p className="text-xl text-neutral-400 mb-10 max-w-2xl mx-auto">
            Join restaurants already using NexusPOS. Start your free trial today — no credit card required.
          </p>
          <Link href="/register">
            <Button className="h-16 px-12 text-xl font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-2xl shadow-[0_0_80px_-20px_rgba(249,115,22,0.5)]">
              Start Free Trial <ArrowRight className="w-6 h-6 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 border-t border-neutral-800 bg-neutral-950">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-5 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <Utensils className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold">NexusPOS</span>
              </div>
              <p className="text-neutral-500 text-sm mb-4">The complete restaurant operating system. Orders, kitchen, delivery, analytics — all in one platform.</p>
              <div className="flex gap-3">
                <a href="#" className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
                  <Globe className="w-4 h-4" />
                </a>
                <a href="#" className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
                  <Phone className="w-4 h-4" />
                </a>
                <a href="#" className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>
            <div>
              <div className="font-bold text-white mb-4">Product</div>
              <ul className="space-y-2 text-sm text-neutral-500">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                <li><Link href="/order" className="hover:text-white">Demo</Link></li>
                <li><a href="#" className="hover:text-white">Changelog</a></li>
              </ul>
            </div>
            <div>
              <div className="font-bold text-white mb-4">Resources</div>
              <ul className="space-y-2 text-sm text-neutral-500">
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">API Reference</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <div className="font-bold text-white mb-4">Legal</div>
              <ul className="space-y-2 text-sm text-neutral-500">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-neutral-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-neutral-500 text-sm">
              © 2024 NexusPOS. All rights reserved.
            </div>
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
              <span>Made with</span>
              <span className="text-red-500">❤</span>
              <span>in Pakistan</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
