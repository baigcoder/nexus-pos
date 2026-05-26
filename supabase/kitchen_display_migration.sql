-- Kitchen Display Enhancements
-- Adds prep time tracking to orders for kitchen display

-- Add estimated prep time to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_prep_time INTEGER DEFAULT 15;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_notes TEXT;

-- Add prep_time to order_items for item-level tracking
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS prep_time INTEGER;

-- Function to update order status to ready with timestamp
CREATE OR REPLACE FUNCTION mark_order_ready(order_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE orders SET status = 'ready', updated_at = NOW()
    WHERE id = order_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update order status
CREATE OR REPLACE FUNCTION auto_update_order_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ready' AND OLD.status != 'ready' THEN
        -- Update display_screens with latest ready order info
        UPDATE display_screens
        SET last_order_ready_at = NOW()
        WHERE restaurant_id = NEW.restaurant_id AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_status_change ON orders;
CREATE TRIGGER on_order_status_change
AFTER UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION auto_update_order_status();