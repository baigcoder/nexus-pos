-- ==============================================================================
-- Migration: 012_immutable_order_snapshots.sql
-- Description: Decouple order items from catalog deletion and guarantee snapshot
--              integrity for revenue, historical names, costs, and taxes.
-- ==============================================================================

-- 1. Safely drop existing foreign key on order_items.menu_item_id and re-add as ON DELETE SET NULL
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'order_items'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'menu_item_id'
    ) LOOP
        EXECUTE 'ALTER TABLE order_items DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Make menu_item_id nullable so deleting a menu item preserves historical sales records
ALTER TABLE order_items ALTER COLUMN menu_item_id DROP NOT NULL;

-- Re-attach foreign key with ON DELETE SET NULL
ALTER TABLE order_items
    ADD CONSTRAINT order_items_menu_item_id_fkey
    FOREIGN KEY (menu_item_id)
    REFERENCES menu_items(id)
    ON DELETE SET NULL;

-- 2. Add snapshot columns and kitchen lifecycle to order_items
ALTER TABLE order_items 
    ADD COLUMN IF NOT EXISTS item_name_snapshot VARCHAR(255),
    ADD COLUMN IF NOT EXISTS variant_name_snapshot VARCHAR(255),
    ADD COLUMN IF NOT EXISTS unit_cost_snapshot DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS tax_rate_snapshot DECIMAL(5,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS tax_amount_snapshot DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS kitchen_status VARCHAR(32) DEFAULT 'queued';

-- Safely add or update kitchen_status check constraint
DO $$
BEGIN
    ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_kitchen_status_check;
    ALTER TABLE order_items
        ADD CONSTRAINT order_items_kitchen_status_check
        CHECK (kitchen_status IN ('hold', 'fired', 'cooking', 'plated', 'served', 'void_pending', 'voided'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. Backfill existing order_items rows using a Common Table Expression (CTE)
WITH item_data AS (
    SELECT 
        oi.id AS order_item_id,
        COALESCE(mi.name, 'Custom Item') AS item_name,
        COALESCE(r.tax_rate, 0.00) AS tax_rate,
        ROUND((oi.subtotal * COALESCE(r.tax_rate, 0.00) / 100), 2) AS tax_amount,
        COALESCE(mi.cost_price, 0.00) AS cost_price
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN restaurants r ON r.id = o.restaurant_id
    LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
)
UPDATE order_items oi
SET 
    item_name_snapshot = COALESCE(oi.item_name_snapshot, idata.item_name, 'Custom Item'),
    tax_rate_snapshot = COALESCE(oi.tax_rate_snapshot, idata.tax_rate, 0.00),
    tax_amount_snapshot = COALESCE(oi.tax_amount_snapshot, idata.tax_amount, 0.00),
    unit_cost_snapshot = COALESCE(oi.unit_cost_snapshot, idata.cost_price, 0.00),
    kitchen_status = CASE 
        WHEN oi.kitchen_status IS NOT NULL AND oi.kitchen_status IN ('hold', 'fired', 'cooking', 'plated', 'served', 'void_pending', 'voided') 
            THEN oi.kitchen_status
        WHEN oi.status = 'pending' THEN 'fired'
        WHEN oi.status = 'preparing' THEN 'cooking'
        WHEN oi.status = 'ready' THEN 'plated'
        WHEN oi.status = 'served' THEN 'served'
        ELSE 'queued'
    END
FROM item_data idata
WHERE oi.id = idata.order_item_id
  AND (oi.item_name_snapshot IS NULL OR oi.kitchen_status IS NULL);

-- Final fallback for any orphaned rows where parent records were missing
UPDATE order_items
SET item_name_snapshot = COALESCE(item_name_snapshot, 'Item #' || id)
WHERE item_name_snapshot IS NULL;

-- Enforce NOT NULL on item_name_snapshot now that backfill is complete
ALTER TABLE order_items ALTER COLUMN item_name_snapshot SET NOT NULL;

-- Add index on order_items kitchen_status and station
CREATE INDEX IF NOT EXISTS idx_order_items_kitchen ON order_items(order_id, kitchen_status);

-- 4. Create order_item_modifiers table for immutable modifier selections
CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_option_id UUID,
    modifier_name_snapshot VARCHAR(255) NOT NULL,
    price_modifier_snapshot DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_item ON order_item_modifiers(order_item_id);

-- Enable RLS on order_item_modifiers
ALTER TABLE order_item_modifiers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Staff member access modifiers" ON order_item_modifiers;
    CREATE POLICY "Staff member access modifiers" ON order_item_modifiers FOR ALL
        USING (order_item_id IN (
            SELECT oi.id FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE public.is_restaurant_member(o.restaurant_id)
        ))
        WITH CHECK (order_item_id IN (
            SELECT oi.id FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE public.is_restaurant_member(o.restaurant_id)
        ));
EXCEPTION
    WHEN undefined_function THEN
        -- Fallback if is_restaurant_member is not yet available in current environment
        CREATE POLICY "Staff member access modifiers" ON order_item_modifiers FOR ALL
            USING (true) WITH CHECK (true);
END $$;

