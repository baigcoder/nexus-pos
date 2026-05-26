# 🍽️ OrderFlow - Complete Restaurant POS & Management System

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=for-the-badge&logo=supabase)
![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?style=for-the-badge&logo=tailwind-css)
![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react)

**A modern, full-featured restaurant management and POS system with real-time order tracking, kitchen display, QR code ordering, delivery management, and comprehensive analytics.**

[🚀 Live Demo](#deployment) • [📖 Documentation](#features) • [⚙️ Installation](#installation) • [🔧 Configuration](#environment-variables)

---

### 🏗️ Development Status: ~60% Complete

</div>

---

## 📑 Table of Contents

- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [Deployment](#-deployment)
- [API Reference](#-api-reference)
- [User Roles](#-user-roles)
- [Routes](#-routes)
- [Security](#-security)
- [Integrations](#-integrations)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🏪 **Multi-Restaurant Management**
- Multi-restaurant support with owner authentication
- Restaurant profile and branding customization
- Operating hours and business settings
- Staff management with role-based access control
- Franchise management capabilities

### 📋 **Menu Management**
- Category-based menu organization
- Rich menu item details with images and descriptions
- Dietary tags (Vegetarian, Vegan, Spicy, Gluten-Free, Halal)
- Daily specials and availability toggles
- Price management and item customization
- Ingredient-level inventory tracking

### 🪑 **Table Management**
- Visual table grid with capacity info
- Real-time status tracking (Available, Occupied, Reserved, Billing)
- QR code generation for each table
- Quick status updates
- Reservations system

### 📝 **Order System**
- **Waiter Interface**: Mobile-optimized tablet view for taking orders
- **Customer Self-Ordering**: QR code scanning for direct menu access
- **Order Desk**: Centralized order management hub
- Order modifications and special instructions
- Real-time order status updates
- Priority order handling

### 👨‍🍳 **Kitchen Display System (KDS)**
- Dark theme optimized for kitchen environments
- Real-time order queue with countdown timers
- Order status workflow (Pending → Preparing → Ready → Served)
- Audio notifications for new orders
- Fullscreen mode for dedicated displays
- Multiple kitchen view layouts

### 💳 **Billing & Payments**
- Bill generation with itemized breakdown
- Discount application (percentage or fixed)
- Multiple payment methods (Cash, Card, Mobile)
- Change calculation for cash payments
- Split bill functionality
- Cashier-dedicated interface

### 📊 **Analytics & Reports**
- Revenue and order statistics
- Weekly/monthly revenue charts
- Hourly order distribution
- Top selling items tracking
- Performance trends and comparisons
- Staff performance metrics
- Expense tracking
- Comprehensive reporting dashboard

### 🚚 **Delivery Management**
- Delivery order tracking
- Rider/delivery boy management
- GPS tracking integration (Google Maps)
- Delivery status monitoring
- Customer location tracking

### 👥 **Staff Management**
- Role-based access (Owner, Manager, Waiter, Kitchen, Cashier)
- PIN-based quick login system
- Shift management
- Staff performance tracking
- Tips management

### 📱 **Customer Experience**
- QR code menu access
- Real-time order tracking
- Order confirmation with estimated time
- Call waiter functionality
- Loyalty program
- Feedback collection

### 🔔 **Notifications**
- Push notifications (Web Push)
- SMS notifications (Twilio)
- Email notifications (Nodemailer)
- Real-time alerts

### 🛒 **Integrations**
- Shopify integration
- WordPress integration
- Embeddable widgets

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16.1.1 (App Router) |
| **Language** | TypeScript 5.0 |
| **Styling** | Tailwind CSS v4 + DaisyUI |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth |
| **State Management** | Zustand |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **Notifications** | React Hot Toast, Sonner |
| **Maps** | Google Maps API |
| **SMS** | Twilio |
| **Email** | Nodemailer |
| **Push Notifications** | Web Push |
| **Password Hashing** | bcryptjs |

---

## 📁 Project Structure

```
orderflow/
├── 📁 src/
│   ├── 📁 app/                          # Next.js App Router
│   │   ├── 📁 api/                      # API Routes
│   │   │   ├── 📁 auth/                 # Authentication endpoints
│   │   │   ├── 📁 delivery/             # Delivery endpoints
│   │   │   ├── 📁 notifications/        # Push notification endpoints
│   │   │   ├── 📁 settings/             # Settings endpoints
│   │   │   ├── 📁 staff/                # Staff endpoints
│   │   │   └── 📁 v1/                   # API v1 endpoints
│   │   │
│   │   ├── 📁 dashboard/                # Admin Dashboard (34+ modules)
│   │   │   ├── 📁 analytics/            # Analytics & reports
│   │   │   ├── 📁 billing/              # Payment processing
│   │   │   ├── 📁 cashier/              # Cashier interface
│   │   │   ├── 📁 delivery-boy/         # Delivery staff view
│   │   │   ├── 📁 delivery-monitor/     # Delivery monitoring
│   │   │   ├── 📁 discounts/            # Discount management
│   │   │   ├── 📁 display-manager/      # Display screens manager
│   │   │   ├── 📁 expenses/             # Expense tracking
│   │   │   ├── 📁 feedback/             # Customer feedback
│   │   │   ├── 📁 franchise/            # Franchise management
│   │   │   ├── 📁 inventory/            # Inventory management
│   │   │   ├── 📁 kitchen/              # Kitchen dashboard
│   │   │   ├── 📁 kitchen-view/         # Kitchen display
│   │   │   ├── 📁 loyalty/              # Loyalty program
│   │   │   ├── 📁 menu/                 # Menu management
│   │   │   ├── 📁 my-orders/            # Staff orders view
│   │   │   ├── 📁 my-shift/             # Personal shift view
│   │   │   ├── 📁 order-desk/           # Order desk hub
│   │   │   ├── 📁 orders/               # Orders management
│   │   │   ├── 📁 profile/              # User profile
│   │   │   ├── 📁 qr-codes/             # QR code management
│   │   │   ├── 📁 qr-ordering/          # QR ordering settings
│   │   │   ├── 📁 reports/              # Reports dashboard
│   │   │   ├── 📁 reservations/         # Reservations system
│   │   │   ├── 📁 riders/               # Delivery riders
│   │   │   ├── 📁 settings/             # Restaurant settings
│   │   │   ├── 📁 shifts/               # Shift management
│   │   │   ├── 📁 specials/             # Special offers
│   │   │   ├── 📁 staff/                # Staff management
│   │   │   ├── 📁 staff-performance/    # Performance metrics
│   │   │   ├── 📁 tables/               # Table management
│   │   │   ├── 📁 take-order/           # Take order interface
│   │   │   ├── 📁 tips/                 # Tips management
│   │   │   └── 📁 waiter/               # Waiter interface
│   │   │
│   │   ├── 📁 auth/                     # Auth pages
│   │   ├── 📁 book/                     # Booking pages
│   │   ├── 📁 display/                  # Customer display
│   │   ├── 📁 embed/                    # Embeddable widgets
│   │   ├── 📁 login/                    # Login page
│   │   ├── 📁 order/                    # Customer ordering
│   │   ├── 📁 register/                 # Registration
│   │   ├── 📁 screen-login/             # Screen login
│   │   ├── 📁 setup/                    # Setup wizard
│   │   ├── 📁 staff-login/              # Staff login
│   │   ├── 📁 staff-setup/              # Staff setup
│   │   ├── 📁 track/                    # Order tracking
│   │   ├── 📁 trial-started/            # Trial page
│   │   ├── 📁 verify-otp/               # OTP verification
│   │   └── 📁 waiter/                   # Waiter interface
│   │
│   ├── 📁 components/                   # React Components
│   │   ├── 📁 billing/                  # Billing components
│   │   ├── 📁 chat/                     # Chat components
│   │   ├── 📁 landing/                  # Landing page
│   │   ├── 📁 maps/                     # Google Maps
│   │   ├── 📁 multi-restaurant/         # Multi-restaurant
│   │   ├── 📁 ui/                       # UI components
│   │   ├── ThemeProvider.tsx            # Theme provider
│   │   └── providers.tsx                # App providers
│   │
│   ├── 📁 hooks/                        # Custom React Hooks
│   ├── 📁 lib/                          # Utilities & API
│   │   ├── 📁 supabase/                 # Supabase client
│   │   ├── api.ts                       # Main API functions
│   │   ├── api-extended.ts              # Extended API
│   │   ├── api-keys.ts                  # API key management
│   │   ├── api-utils.ts                 # API utilities
│   │   ├── hooks.ts                     # Library hooks
│   │   ├── inventory.ts                 # Inventory functions
│   │   ├── notifications.ts             # Notification helpers
│   │   ├── push-notifications.ts        # Push notification service
│   │   ├── sounds.ts                    # Sound effects
│   │   ├── twilio.ts                    # Twilio SMS
│   │   └── utils.ts                     # General utilities
│   │
│   ├── 📁 stores/                       # Zustand Stores
│   ├── 📁 types/                        # TypeScript Types
│   └── middleware.ts                    # Next.js Middleware
│
├── 📁 integrations/                     # Third-party Integrations
│   ├── 📁 shopify/                      # Shopify integration
│   └── 📁 wordpress/                    # WordPress integration
│
├── 📁 supabase/                         # Database Scripts
│   ├── schema.sql                       # Main schema
│   ├── complete_migration.sql           # Full migration
│   ├── all_tables.sql                   # All tables
│   ├── api_keys.sql                     # API keys table
│   ├── customer_display.sql             # Customer display
│   ├── extended_schema.sql              # Extended schema
│   ├── gps_tracking.sql                 # GPS tracking
│   ├── menu_item_ingredients.sql        # Ingredients
│   ├── messages.sql                     # Messages table
│   ├── otp_codes.sql                    # OTP codes
│   ├── otp_improvements.sql             # OTP improvements
│   ├── split_payments.sql               # Split payments
│   └── staff_onboarding.sql             # Staff onboarding
│
├── 📁 public/                           # Static Assets
├── vercel.json                          # Vercel Configuration
├── next.config.ts                       # Next.js Configuration
├── package.json                         # Dependencies
└── tsconfig.json                        # TypeScript Config
```

---

## 🚀 Installation

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** or **yarn** or **pnpm**
- **Supabase** account ([supabase.com](https://supabase.com))
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/orderflow.git
cd orderflow
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory (see [Environment Variables](#-environment-variables) section below).

### 4. Set Up the Database

Run the SQL scripts in your Supabase SQL Editor in this order:

1. `supabase/schema.sql` - Core tables and RLS policies
2. `supabase/extended_schema.sql` - Extended features
3. `supabase/api_keys.sql` - API key management
4. Additional migration files as needed

### 5. Enable Realtime

In your Supabase dashboard, enable realtime for:
- `orders`
- `order_items`
- `tables`
- `staff`

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## 🔐 Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# ================================
# SUPABASE CONFIGURATION (Required)
# ================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SECRET_KEY=your-rotated-supabase-secret-key

# ================================
# APP CONFIGURATION
# ================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=OrderFlow

# ================================
# GOOGLE MAPS (Optional - for delivery tracking)
# ================================
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# ================================
# TWILIO SMS (Optional - for OTP & notifications)
# ================================
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# ================================
# EMAIL CONFIGURATION (Optional - for notifications)
# ================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# ================================
# WEB PUSH NOTIFICATIONS (Optional)
# ================================
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_EMAIL=mailto:your-email@example.com
```

### Getting API Keys

| Service | Instructions |
|---------|-------------|
| **Supabase** | Create project at [supabase.com](https://supabase.com) → Settings → API |
| **Google Maps** | [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Enable Maps JavaScript API |
| **Twilio** | Create account at [twilio.com](https://twilio.com) → Console → Account SID & Auth Token |
| **VAPID Keys** | Run: `npx web-push generate-vapid-keys` |

---

## 🗄️ Database Setup

### Core Tables

| Table | Description |
|-------|-------------|
| `restaurants` | Restaurant profiles and settings |
| `staff` | Staff members with roles and PINs |
| `categories` | Menu categories |
| `menu_items` | Menu items with details |
| `tables` | Restaurant tables |
| `orders` | Order records |
| `order_items` | Order line items |
| `payments` | Payment transactions |

### Extended Tables (Additional Features)

| Table | Description |
|-------|-------------|
| `api_keys` | API key management |
| `otp_codes` | OTP verification |
| `messages` | Customer/staff messages |
| `gps_locations` | Delivery tracking |

### Running Migrations

```bash
# Connect to Supabase and run SQL files
# In Supabase Dashboard → SQL Editor → Run each file
```

---

## 🌐 Deployment

### Deploy to Vercel (Recommended)

#### Option 1: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/orderflow)

#### Option 2: Manual Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Configure environment variables
   - Deploy

3. **Configure Environment Variables in Vercel**
   - Go to Project Settings → Environment Variables
   - Add all variables from `.env.local`

### Vercel Configuration

The project includes a `vercel.json` configuration file for optimal deployment.

### Build Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## 🔌 API Reference

### Authentication API

```typescript
// Staff PIN Login
POST /api/auth/staff-login
Body: { restaurant_id, pin }

// Register Owner
POST /api/auth/register
Body: { email, password, name }

// OTP Verification
POST /api/auth/verify-otp
Body: { phone, code }
```

### Categories API

```typescript
fetchCategories(restaurantId)      // Get all categories
createCategory(restaurantId, data) // Create new category
updateCategory(categoryId, data)   // Update category
deleteCategory(categoryId)         // Delete category
```

### Menu Items API

```typescript
fetchMenuItems(categoryId)         // Get items by category
fetchAllMenuItems(restaurantId)    // Get all items
createMenuItem(restaurantId, ...)  // Create item
updateMenuItem(itemId, data)       // Update item
deleteMenuItem(itemId)             // Delete item
```

### Orders API

```typescript
fetchOrders(restaurantId, status)  // Get orders
createOrder(restaurantId, ...)     // Create order
updateOrderStatus(orderId, status) // Update status
```

### Tables API

```typescript
fetchTables(restaurantId)          // Get all tables
updateTableStatus(tableId, status) // Update status
```

---

## 👥 User Roles

| Role | Access Level | Features |
|------|-------------|----------|
| **Owner** | Full access | All features, settings, analytics, staff management |
| **Manager** | High access | Orders, menu, staff, reports (no billing settings) |
| **Waiter** | Order access | Take orders, view tables, call kitchen |
| **Kitchen** | Kitchen access | View and manage order preparation |
| **Cashier** | Billing access | Process payments, view orders |

---

## 📍 Routes

### Public Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Staff login |
| `/register` | Owner registration |
| `/order` | Customer self-ordering |
| `/track` | Order tracking |
| `/book` | Table booking |

### Dashboard Routes

| Route | Description |
|-------|-------------|
| `/dashboard` | Main dashboard |
| `/dashboard/menu` | Menu management |
| `/dashboard/tables` | Table management |
| `/dashboard/orders` | Orders management |
| `/dashboard/kitchen` | Kitchen dashboard |
| `/dashboard/kitchen-view` | Kitchen display screen |
| `/dashboard/billing` | Payment processing |
| `/dashboard/analytics` | Analytics dashboard |
| `/dashboard/reports` | Reports |
| `/dashboard/staff` | Staff management |
| `/dashboard/settings` | Restaurant settings |
| `/dashboard/qr-codes` | QR code management |
| `/dashboard/reservations` | Reservations |
| `/dashboard/inventory` | Inventory management |
| `/dashboard/delivery-monitor` | Delivery tracking |
| `/dashboard/cashier` | Cashier interface |
| `/dashboard/take-order` | Order desk |

---

## 🔒 Security

- **Row Level Security (RLS)**: Enabled on all Supabase tables
- **Authentication**: Supabase Auth with email/password
- **Authorization**: Role-based access control
- **PIN System**: 4-digit PIN for staff quick login
- **Password Hashing**: bcryptjs for secure passwords
- **Middleware Protection**: Route-level authentication checks

---

## 🔗 Integrations

### Shopify
- Sync products with Shopify store
- Order synchronization
- Inventory management

### WordPress
- WooCommerce integration
- Menu embedding
- Order processing

### Embed Widget
- Embeddable ordering widget for any website
- Customizable appearance
- Direct order placement

---

## 🚧 Roadmap

### In Progress (60% Complete)
- [x] Core order management
- [x] Kitchen display system
- [x] Staff management
- [x] Basic analytics
- [x] Table management
- [x] Payment processing
- [ ] Inventory management (partial)
- [ ] Delivery tracking (partial)

### Planned Features
- [ ] Multi-language support
- [ ] Mobile native apps (React Native)
- [ ] Advanced inventory management
- [ ] Customer loyalty program
- [ ] Online payment gateway integration
- [ ] AI-powered menu recommendations
- [ ] Advanced reporting & exports
- [ ] White-label solution

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use Tailwind CSS for styling
- Write meaningful commit messages
- Test your changes thoroughly

---

## 📄 License

This project is licensed under the MIT License.

---

## 💬 Support

For support, email support@orderflow.app or open an issue on GitHub.

---

<div align="center">

Made with ❤️ for the restaurant industry

**[⬆ Back to Top](#-orderflow---complete-restaurant-pos--management-system)**

</div>
