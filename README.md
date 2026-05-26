# NexusPOS

NexusPOS is a full-stack restaurant operating system for POS, kitchen display, QR ordering, delivery, staff operations, customer-facing screens, and AI-assisted restaurant analytics.

Repository/package context:

- Repository: `baigcoder/nexus-pos`
- Package name: `orderflow`
- Framework: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4
- Backend: Next.js route handlers with Supabase PostgreSQL
- Deployment targets: Vercel or Docker

## Current Status

This README reflects the current `main` branch feature inventory. The app has moved beyond a basic POS into a multi-role restaurant management platform with real-time operational modules, AI endpoints, staff portals, display screens, Docker packaging, and Supabase migration scripts.

## Core Features

### Restaurant And POS Operations

- Multi-restaurant setup with restaurant profile, branding, operating settings, and onboarding flow.
- Role-aware dashboard experience for owners, managers, waiters, kitchen staff, cashiers, delivery staff, and riders.
- Table management with table status updates, QR ordering setup, reservations, and waiter workflows.
- Menu management with categories, image upload support, availability toggles, specials, ingredient tracking, and menu utilities.
- Order flow for dine-in, takeaway, delivery, waiter ordering, kitchen routing, billing, and customer order status tracking.
- Billing tools for payment processing, discounts, split-payment style workflows, cashier views, tips, and daily reports.

### Kitchen, Delivery, And Displays

- Kitchen dashboard and dedicated `/kitchen-display` screen for real-time order visibility.
- Kitchen display migrations and templates for display screens and ad content.
- Customer display routes under `/display/[slug]` with reusable display components.
- Display manager module with ad-content management and screen content SQL updates.
- Delivery assignment APIs, rider location tracking, delivery monitor dashboards, and Google Maps powered tracking components.

### Staff, Messaging, And Access Control

- Staff invite, setup, PIN login, email login, OTP verification, forgot PIN, and PIN migration flows.
- Staff portal at `/staff-portal` and staff messaging at `/staff-messages`.
- Dashboard messaging at `/dashboard/messages` with Supabase realtime conversations, broadcast messages, call logs, and WebRTC audio/video call plumbing.
- Permission gates, auth guards, access-denied UI, and centralized staff API helpers.
- Staff shifts, bonuses, avatar, phone, tracking, RLS policy, and dashboard enhancement SQL scripts.

### Analytics, AI, And Reporting

- Analytics API and dashboard charts for revenue, orders, staff performance, and operational trends.
- Report generation endpoint at `/api/reports/generate`.
- OpenRouter-powered AI endpoints:
  - `/api/ai/analyze-expense`
  - `/api/ai/role-dashboard`
- AI expense categorization with fallback classification when no AI key is configured.
- Role dashboard analysis prompts for waiter, kitchen, cashier, and delivery contexts.

### Platform Integrations

- Supabase Auth, PostgreSQL, Storage-compatible media flows, RLS policy scripts, and realtime channels.
- OpenRouter-compatible AI models for restaurant analytics.
- Twilio SMS/WhatsApp notification helpers.
- Nodemailer email delivery helpers.
- Web Push notification support.
- Google Maps API for live delivery and fleet tracking.
- Cloudinary unsigned upload configuration for menu and branding media.
- Docker image and Compose service for production-style local/container deployment.

## Tech Stack

| Area | Technology |
| --- | --- |
| App framework | Next.js 16 App Router |
| UI runtime | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4, DaisyUI, shadcn-style UI primitives |
| Database/Auth | Supabase PostgreSQL and Supabase Auth |
| State | Zustand |
| Charts | Recharts |
| Animation | Framer Motion |
| Icons | Lucide React |
| AI | OpenRouter-compatible chat completions |
| Maps | Google Maps JavaScript API |
| Messaging | Supabase Realtime, WebRTC helpers |
| Notifications | Twilio, Nodemailer, Web Push, Sonner, React Hot Toast |
| Deployment | Vercel, Docker, Docker Compose |

## Application Routes

### Public And Onboarding

| Route | Purpose |
| --- | --- |
| `/` | NexusPOS landing page |
| `/login` | Owner/user login |
| `/register` | Registration |
| `/setup` | Restaurant setup wizard |
| `/verify-otp` | OTP verification |
| `/staff-login` | Staff login |
| `/staff-setup` | Staff onboarding/setup |
| `/screen-login` | Display/screen login |
| `/track` | Order tracking |
| `/book` | Booking/reservation entry |
| `/embed` | Embeddable widget surface |
| `/trial-started` | Trial-start confirmation |

### Operational Screens

| Route | Purpose |
| --- | --- |
| `/dashboard` | Main role-aware dashboard |
| `/dashboard/analytics` | Analytics dashboard |
| `/dashboard/billing` | Billing and payment workflows |
| `/dashboard/cashier` | Cashier interface |
| `/dashboard/delivery-boy` | Delivery staff view |
| `/dashboard/delivery-monitor` | Delivery monitoring |
| `/dashboard/display-manager` | Display screen manager |
| `/dashboard/display-manager/ad-content` | Display ad content manager |
| `/dashboard/messages` | Internal messaging and calls |
| `/dashboard/menu` | Menu management |
| `/dashboard/order-desk` | Central order desk |
| `/dashboard/orders` | Order management |
| `/dashboard/reports` | Reporting dashboard |
| `/dashboard/settings` | Restaurant settings |
| `/dashboard/settings/api-keys` | API key management |
| `/dashboard/staff` | Staff management |
| `/dashboard/take-order` | Dashboard order-taking surface |
| `/dashboard/tables` | Table management |
| `/dashboard/waiter` | Waiter dashboard |
| `/kitchen-display` | Dedicated kitchen display |
| `/display/[slug]` | Customer-facing display screen |
| `/order/status/[orderId]` | Customer order status |
| `/staff-messages` | Staff messaging screen |
| `/staff-portal` | Staff portal |
| `/waiter-order` | Waiter order-taking page |

## API Surface

### Auth And Staff

- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/forgot-pin`
- `POST /api/auth/staff-check`
- `POST /api/auth/staff-login`
- `POST /api/auth/staff-email-login`
- `POST /api/auth/staff-setup`
- `POST /api/auth/migrate-pins`
- `GET/POST /api/staff`
- `POST /api/staff/invite`
- `POST /api/staff/resend-invite`
- `GET/POST /api/staff/my-shift`

### Restaurant Operations

- `GET /api/analytics`
- `POST /api/billing/process-payment`
- `GET/POST /api/order-flow`
- `GET/POST /api/order-flow/delivery`
- `POST /api/reports/generate`
- `POST /api/tables/update-status`
- `GET/POST /api/track`
- `GET /api/v1/menu`
- `GET/POST /api/v1/orders`

### Delivery, Display, Media, And Settings

- `GET/POST /api/delivery/assignments`
- `POST /api/delivery/location`
- `GET/PUT/DELETE /api/display/ad-content/[id]`
- `POST /api/menu/upload-image`
- `GET/POST /api/settings/api-keys`
- `GET/DELETE /api/settings/api-keys/[keyId]`
- `GET/PUT /api/settings/restaurant`
- `POST /api/settings/upload-logo`

### Messaging, Notifications, And AI

- `POST /api/ai/analyze-expense`
- `POST /api/ai/role-dashboard`
- `POST /api/messages`
- `POST /api/messages/broadcast`
- `GET /api/messages/call-log`
- `GET /api/messages/conversations`
- `POST /api/notifications/send`

## Supabase And Database

The `supabase/` folder contains base schema files, feature SQL scripts, and migrations for the current feature set.

Important groups:

- Core schema: `schema.sql`, `complete_migration.sql`, `extended_schema.sql`, `all_tables.sql`
- Auth and staff: `staff_migration.sql`, `staff_onboarding.sql`, `staff_columns.sql`, `staff_rls_policies.sql`, `staff_tracking.sql`, `staff_avatar.sql`, `add_staff_phone.sql`
- Orders and operations: `delivery_system.sql`, `rider_locations.sql`, `points_transactions.sql`, `split_payments.sql`, `update_daily_reports.sql`, `update_shifts_schema.sql`
- Displays and screens: `customer_display.sql`, `screen_content.sql`, `display_system_update.sql`, `FIX_SCREEN_CONTENT_RLS.sql`, `kitchen_display_migration.sql`
- Menu and inventory: `menu_enhancements.sql`, `menu_item_ingredients.sql`, `add_category_icon_key.sql`
- Messaging and OTP: `messages.sql`, `otp_codes.sql`, `otp_improvements.sql`
- Numbered migrations: `supabase/migrations/002_*` through `009_*`

Apply only the migrations that match the target environment and review RLS policy scripts before running them against production.

## Environment Variables

Create `.env.local` for local development. Do not commit real secrets.

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
ADMIN_SECRET_KEY=replace-with-admin-secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-anon-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace-with-publishable-key
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key
SUPABASE_SECRET_KEY=replace-with-secret-key

# OpenRouter AI
OPEN_ROUTER_API_KEY=replace-with-openrouter-key
OPENROUTER_API_URL=https://openrouter.ai/api/v1/chat/completions
OPENROUTER_MODEL=liquid/lfm-2.5-1.2b-instruct:free

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=replace-with-smtp-user
SMTP_EMAIL=replace-with-from-email
SMTP_PASS=replace-with-smtp-password
SMTP_PASSWORD=replace-with-smtp-password

# Twilio
TWILIO_ACCOUNT_SID=replace-with-twilio-account-sid
TWILIO_AUTH_TOKEN=replace-with-twilio-auth-token
TWILIO_PHONE_NUMBER=replace-with-twilio-phone-number
TWILIO_WHATSAPP_NUMBER=whatsapp:+10000000000

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=replace-with-google-maps-key

# Cloudinary unsigned uploads
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=replace-with-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=replace-with-upload-preset

# Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=replace-with-vapid-public-key
```

The committed `.env.example` currently includes the OpenRouter values used by the AI endpoints. Add project-specific provider variables to local/deployment environments as needed.

## Local Development

Use npm because this repository includes `package-lock.json`.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful scripts:

```bash
npm run lint
npm run build
npm run start
```

## Docker

Builds use a multi-stage Next.js Dockerfile and a helper script that can load environment variables from a Docker secret during the build.

```bash
docker compose up --build
```

The Compose service:

- Builds from `Dockerfile`
- Loads runtime variables from `.env.local`
- Mounts `.env.local` as the `om_env` build secret
- Exposes the app on port `3000`
- Runs `node server.js` from the Next.js standalone output

For production deployments, provide secrets through the platform secret manager instead of committing env files.

## Deployment

### Vercel

1. Connect the `nexus-pos` repository.
2. Set the environment variables listed above.
3. Use the default Next.js build command:

```bash
npm run build
```

4. Deploy from `main`.

### Docker Host

```bash
docker compose up --build -d
```

Make sure `.env.local` exists on the host or replace `env_file`/secret handling with your deployment platform's secret injection.

## Security Notes

- Never commit `.env`, `.env.local`, production secrets, API tokens, or provider credentials.
- Keep Supabase service-role keys server-side only.
- Review SQL and RLS scripts before applying them to production.
- Rotate any provider key if it was ever exposed in local logs or history.
- `.claude/worktrees/` is ignored and should not be tracked.

## Known Verification State

The current README update is documentation-only. Existing application lint debt should be handled separately from documentation publishing.

Previous lint output showed source-level issues such as explicit `any`, React hook/compiler rules, and `prefer-const` findings. Those are not changed by this README update.

## License

Private project unless a license file is added.
