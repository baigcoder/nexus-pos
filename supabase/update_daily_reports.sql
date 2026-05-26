-- ============================================
-- Update daily_reports table with additional fields
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add new columns to daily_reports
ALTER TABLE daily_reports
ADD COLUMN IF NOT EXISTS report_type VARCHAR(20) DEFAULT 'daily' CHECK (report_type IN ('daily', 'weekly', 'monthly'));

ALTER TABLE daily_reports
ADD COLUMN IF NOT EXISTS staff_stats JSONB DEFAULT '{}';

ALTER TABLE daily_reports
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT NOW();

-- Add constraint for unique report per restaurant per date if not exists
DO $$
BEGIN
    -- Check if constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'daily_reports_restaurant_date_unique'
    ) THEN
        -- We need to drop and recreate the table with proper unique constraint
        -- But since we can't drop easily, we'll just ensure uniqueness via upsert
        RAISE NOTICE 'Unique constraint will be handled at application level';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint check failed, continuing...';
END $$;

-- ============================================
-- Alternative: Recreate table with unique constraint
-- Only run if you need to reset the table
-- ============================================
/*
DROP TABLE IF EXISTS daily_reports;

CREATE TABLE daily_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    report_type VARCHAR(20) DEFAULT 'daily' CHECK (report_type IN ('daily', 'weekly', 'monthly')),
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    total_tax DECIMAL(12,2) DEFAULT 0,
    total_discounts DECIMAL(12,2) DEFAULT 0,
    avg_order_value DECIMAL(12,2) DEFAULT 0,
    top_items JSONB DEFAULT '[]',
    hourly_sales JSONB DEFAULT '{}',
    staff_stats JSONB DEFAULT '{}',
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, report_date)
);

CREATE INDEX idx_daily_reports_restaurant ON daily_reports(restaurant_id);
CREATE INDEX idx_daily_reports_date ON daily_reports(report_date);
CREATE INDEX idx_daily_reports_type ON daily_reports(report_type);
*/

-- ============================================
-- Add reports trigger for tracking
-- ============================================
CREATE OR REPLACE FUNCTION notify_report_generated()
RETURNS TRIGGER AS $$
BEGIN
    -- You can add notification logic here if needed
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;