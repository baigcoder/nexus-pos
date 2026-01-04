# 🍽️ OrderFlow - Restaurant Order Management System

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green?style=flat-square&logo=supabase)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)

**A modern, full-featured restaurant management system with real-time order tracking, kitchen display, QR code ordering, and comprehensive analytics.**

[Live Demo](#) • [Documentation](#features) • [Installation](#installation)

</div>

---

## ✨ Features

### 🏪 **Restaurant Management**
- Multi-restaurant support with owner authentication
- Restaurant profile and branding customization
- Operating hours and business settings
- Staff management with role-based access (Owner, Manager, Waiter, Kitchen)

### 📋 **Menu Management**
- Category-based menu organization
- Rich menu item details with images and descriptions
- Dietary tags (Vegetarian, Vegan, Spicy, Gluten-Free, Halal)
- Daily specials and availability toggles
- Price management and item customization

### 🪑 **Table Management**
- Visual table grid with capacity info
- Real-time status tracking (Available, Occupied, Reserved, Billing)
- QR code generation for each table
- Quick status updates

### 📝 **Order System**
- **Waiter Interface**: Mobile-optimized tablet view for taking orders
- **Customer Self-Ordering**: QR code scanning for direct menu access
- Order modifications and special instructions
- Real-time order status updates

### 👨‍🍳 **Kitchen Display System (KDS)**
- Dark theme optimized for kitchen environments
- Real-time order queue with countdown timers
- Order status workflow (Pending → Preparing → Ready → Served)
- Audio notifications for new orders
- Fullscreen mode for dedicated displays

### 💳 **Billing & Payments**
- Bill generation with itemized breakdown
- Discount application (percentage or fixed)
- Multiple payment methods (Cash, Card, Mobile)
- Change calculation for cash payments
- Split bill functionality

### 📊 **Analytics Dashboard**
- Revenue and order statistics
- Weekly revenue charts
- Hourly order distribution
- Top selling items tracking
- Performance trends and comparisons

### 📱 **Customer Experience**
- QR code menu access
- Real-time order tracking
- Order confirmation with estimated time
- Call waiter functionality

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth |
| **State** | Zustand |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **Notifications** | React Hot Toast |

---

## 📁 Project Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── dashboard/           # Admin dashboard pages
│   │   ├── analytics/       # Analytics & reports
│   │   ├── billing/         # Payment processing
│   │   ├── kitchen/         # Kitchen display system
│   │   ├── menu/            # Menu management
│   │   ├── orders/          # Order management
│   │   ├── qr-codes/        # QR code management
│   │   ├── settings/        # Restaurant settings
│   │   ├── staff/           # Staff management
│   │   └── tables/          # Table management
│   ├── order/               # Customer self-ordering
│   ├── track/               # Order tracking
│   ├── waiter/              # Waiter tablet interface
│   ├── login/               # Staff login
│   ├── register/            # Owner registration
│   └── setup/               # Restaurant setup wizard
├── components/
│   └── ui/                  # Reusable UI components
│       ├── common.tsx       # Button, Card, Modal, etc.
│       └── toast.tsx        # Toast notifications
├── lib/
│   ├── api.ts               # API utility functions
│   ├── hooks.ts             # Custom React hooks
│   ├── utils.ts             # Utility functions
│   └── supabase/            # Supabase client config
├── stores/                  # Zustand state stores
│   ├── authStore.ts         # Authentication state
│   └── orderStore.ts        # Order/cart state
└── types/                   # TypeScript type definitions
```

---

## 🚀 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/orderflow.git
cd orderflow
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Set up the database

Run the SQL from `supabase/schema.sql` in your Supabase SQL Editor to create all required tables:

- `restaurants` - Restaurant profiles
- `staff` - Staff members with roles and PINs
- `categories` - Menu categories
- `menu_items` - Menu items with details
- `tables` - Restaurant tables
- `orders` - Order records
- `order_items` - Order line items

### 5. Enable Realtime

In your Supabase dashboard, enable realtime for:
- `orders`
- `order_items`
- `tables`

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## 📖 Usage Guide

### For Restaurant Owners

1. **Register** at `/register` with your email and password
2. **Set up restaurant** profile in the setup wizard
3. **Add categories** in Dashboard → Menu
4. **Add menu items** to each category
5. **Configure tables** in Dashboard → Tables
6. **Print QR codes** from Dashboard → QR Codes

### For Waiters

1. **Log in** with PIN code at `/login`
2. **Access** `/waiter` on tablet
3. **Select table** and browse menu
4. **Add items** to cart and submit order
5. **Track orders** on the orders page

### For Kitchen Staff

1. **Open** `/dashboard/kitchen` on kitchen display
2. **View** incoming orders in real-time
3. **Update status** as orders are prepared
4. **Mark as ready** when complete

### For Customers

1. **Scan** QR code on table
2. **Browse** menu and add items to cart
3. **Place** order and receive confirmation
4. **Track** order status at `/track`

---

## 🔌 API Reference

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

---

## 🎨 Design System

### Colors
- **Primary**: Orange (#F97316)
- **Secondary**: Gray tones
- **Success**: Green (#22C55E)
- **Warning**: Yellow (#EAB308)
- **Error**: Red (#EF4444)

### Typography
- **Font**: Inter (Google Fonts)
- **Headings**: Bold, larger sizes
- **Body**: Regular, comfortable reading

### Components
All reusable components are in `src/components/ui/`:
- `Button` - Primary, secondary, ghost, danger variants
- `Card` - Elevated container with hover states
- `Badge` - Status indicators
- `Modal` - Dialog overlays
- `Input` - Form inputs with icons
- `SearchInput` - Search with icon
- `EmptyState` - Empty data placeholders
- `LoadingSpinner` - Loading indicators

---

## 🧪 Custom Hooks

```typescript
useCategories()     // Fetch and manage categories
useMenuItems()      // Fetch and manage menu items
useTables()         // Fetch and manage tables
useOrders()         // Fetch orders with realtime
useDebounce()       // Debounce values for search
useLocalStorage()   // Persist state to localStorage
useTimeElapsed()    // Calculate elapsed time
```

---

## 📱 Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Staff login |
| `/register` | Owner registration |
| `/setup` | Restaurant setup wizard |
| `/dashboard` | Main dashboard |
| `/dashboard/menu` | Menu management |
| `/dashboard/tables` | Table management |
| `/dashboard/orders` | Orders management |
| `/dashboard/kitchen` | Kitchen display |
| `/dashboard/billing` | Payment processing |
| `/dashboard/analytics` | Analytics dashboard |
| `/dashboard/staff` | Staff management |
| `/dashboard/settings` | Restaurant settings |
| `/dashboard/qr-codes` | QR code management |
| `/waiter` | Waiter tablet interface |
| `/order` | Customer self-ordering |
| `/track` | Order tracking |

---

## 🔒 Security

- **Row Level Security (RLS)**: Enabled on all tables
- **Authentication**: Supabase Auth with email/password
- **Authorization**: Role-based access control
- **PIN System**: 4-digit PIN for staff quick login

---

## 🚧 Roadmap

- [ ] Multi-language support
- [ ] Mobile native apps (React Native)
- [ ] Inventory management
- [ ] Customer loyalty program
- [ ] Online payment integration
- [ ] Reservation system
- [ ] AI-powered menu recommendations
- [ ] Push notifications

---

## 📄 License

This project is licensed under the MIT License.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 💬 Support

For support, email support@orderflow.app or open an issue on GitHub.

---

<div align="center">

Made with ❤️ for the restaurant industry

</div>
