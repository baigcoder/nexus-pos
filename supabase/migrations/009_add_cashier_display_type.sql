ALTER TABLE displays DROP CONSTRAINT IF EXISTS displays_type_check;

ALTER TABLE displays
ADD CONSTRAINT displays_type_check
CHECK (type IN ('kitchen', 'bar', 'counter', 'cashier', 'waiting', 'qr', 'advertisement'));

COMMENT ON COLUMN displays.type IS 'Display type: kitchen, bar, counter, cashier, waiting, qr, advertisement';
