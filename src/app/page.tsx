'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
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
  Play
} from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui/common'

export default function LandingPage() {
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-orange-500 selection:text-white font-sans overflow-hidden">

      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-transparent to-neutral-950" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[150px]" />
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
            <Zap className="w-3 h-3" /> 🎉 New: Multi-Restaurant & Google Maps Live Tracking
          </Badge>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] mb-8">
            THE COMPLETE
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-red-500">
              RESTAURANT OS
            </span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Orders. Kitchen. Delivery. Analytics. Everything your restaurant needs in one powerful platform.
            <span className="text-white font-medium"> No hardware required.</span>
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
                Watch Demo
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 max-w-4xl mx-auto border-t border-neutral-800/50 pt-10">
            {[
              { value: '50+', label: 'Features' },
              { value: '99.9%', label: 'Uptime' },
              { value: '<3min', label: 'Setup' },
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

      {/* Features Grid */}
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
              From taking orders to managing deliveries, we've got every aspect of your restaurant covered.
            </p>
          </div>

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {/* Core Features */}
            {[
              {
                icon: Smartphone,
                title: 'Order Management',
                desc: 'Take orders from tables, delivery, and online in one unified system',
                color: 'orange'
              },
              {
                icon: ChefHat,
                title: 'Kitchen Display',
                desc: 'Real-time order queue with priority management and timers',
                color: 'purple'
              },
              {
                icon: Truck,
                title: 'Delivery Operations',
                desc: 'Rider management, GPS tracking, and automated dispatch',
                color: 'blue'
              },
              {
                icon: Map,
                title: 'Live GPS Tracking',
                desc: 'Google Maps integration with real-time rider location',
                color: 'emerald'
              },
              {
                icon: MessageSquare,
                title: 'WhatsApp/SMS',
                desc: 'Twilio integration for automated order notifications',
                color: 'green'
              },
              {
                icon: Bell,
                title: 'Push Notifications',
                desc: 'Browser push for customers, real-time alerts for staff',
                color: 'yellow'
              },
              {
                icon: QrCode,
                title: 'QR Code Ordering',
                desc: 'Generate QR codes for contactless table ordering',
                color: 'pink'
              },
              {
                icon: BarChart3,
                title: 'Advanced Analytics',
                desc: 'Revenue by channel, delivery metrics, peak hours',
                color: 'cyan'
              },
              {
                icon: Package,
                title: 'Inventory Management',
                desc: 'Stock tracking, low alerts, automatic deduction',
                color: 'amber'
              },
              {
                icon: Users,
                title: 'Staff Management',
                desc: 'Roles, permissions, shifts, and performance tracking',
                color: 'indigo'
              },
              {
                icon: Store,
                title: 'Multi-Restaurant',
                desc: 'Manage multiple locations from one dashboard',
                color: 'rose'
              },
              {
                icon: Globe,
                title: 'Website Integration',
                desc: 'Embed widget, WordPress plugin, Shopify app',
                color: 'violet'
              },
            ].map((feature, i) => (
              <motion.div key={i} variants={item}>
                <Card className="p-6 bg-neutral-900/50 border-neutral-800 hover:border-neutral-700 transition-all h-full group">
                  <div className={`w-12 h-12 rounded-xl bg-${feature.color}-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className={`w-6 h-6 text-${feature.color}-500`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-neutral-400 text-sm">{feature.desc}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
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

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Sign Up', desc: 'Create your account with just your email' },
              { step: '02', title: 'Setup Menu', desc: 'Add your categories and menu items' },
              { step: '03', title: 'Start Selling', desc: 'QR codes, delivery, walk-in - you\'re live!' },
            ].map((item, i) => (
              <div key={i} className="text-center p-8 bg-neutral-950 rounded-3xl border border-neutral-800">
                <div className="text-6xl font-black text-neutral-800 mb-4">{item.step}</div>
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-neutral-400">{item.desc}</p>
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
              <div className="text-neutral-400 mb-6">14 days, no credit card</div>
              <ul className="space-y-3 mb-8">
                {['All features included', 'Unlimited orders', 'Full support', 'No commitment'].map((item, i) => (
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
              { name: 'Ali Khan', role: 'Owner, Karachi Biryani', quote: 'Cut our order time by 40%. The kitchen display changed everything.' },
              { name: 'Fatima Shah', role: 'Manager, Lahore Grill', quote: 'Finally a POS that understands Pakistani restaurants. Amazing support!' },
              { name: 'Hassan Ahmed', role: 'Owner, Fresh Bites', quote: 'The delivery tracking made our customers so happy. Revenue up 30%!' },
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

      {/* CTA */}
      <section className="py-24 px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            Ready to Transform Your Restaurant?
          </h2>
          <p className="text-xl text-neutral-400 mb-10 max-w-2xl mx-auto">
            Join hundreds of restaurants already using NexusPOS. Start your free trial today.
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
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <Utensils className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold">NexusPOS</span>
              </div>
              <p className="text-neutral-500 text-sm">The complete restaurant operating system.</p>
            </div>
            <div>
              <div className="font-bold text-white mb-4">Product</div>
              <ul className="space-y-2 text-sm text-neutral-500">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                <li><Link href="/order" className="hover:text-white">Demo</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-bold text-white mb-4">Support</div>
              <ul className="space-y-2 text-sm text-neutral-500">
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <div className="font-bold text-white mb-4">Legal</div>
              <ul className="space-y-2 text-sm text-neutral-500">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-neutral-800 pt-8 text-center text-neutral-500 text-sm">
            © 2024 NexusPOS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
