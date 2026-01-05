-- Fix staff role constraint to include 'delivery' role
-- Run this in Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;

-- Add updated constraint with all roles including delivery
ALTER TABLE staff ADD CONSTRAINT staff_role_check 
CHECK (role IN ('owner', 'manager', 'waiter', 'kitchen', 'cashier', 'delivery'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'staff'::regclass AND contype = 'c';
