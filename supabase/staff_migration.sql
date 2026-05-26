-- ============================================
-- Complete Staff Table Migration
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Add missing columns to staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS temp_pin TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS needs_setup BOOLEAN DEFAULT true;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;

-- Allow 'delivery' and 'rider' roles
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check
    CHECK (role IN ('owner', 'manager', 'waiter', 'kitchen', 'cashier', 'delivery', 'rider'));

-- Update existing staff that need setup
UPDATE staff SET needs_setup = true WHERE temp_pin IS NOT NULL AND temp_pin != '';

-- ============================================
-- Environment Variables to add in .env.local
-- ============================================

-- For Email invitations:
-- SMTP_HOST=smtp.gmail.com
-- SMTP_PORT=587
-- SMTP_USER=your-email@gmail.com
-- SMTP_PASS=your-app-password

-- For WhatsApp invitations:
-- TWILIO_ACCOUNT_SID=your-twilio-account-sid
-- TWILIO_AUTH_TOKEN=your-twilio-auth-token
-- TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

-- How to send invitations: 'email', 'whatsapp', or 'both'
-- NEXT_PUBLIC_INVITATION_METHOD=both