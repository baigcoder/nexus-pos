ALTER TABLE displays DROP CONSTRAINT IF EXISTS displays_template_check;
ALTER TABLE displays DROP CONSTRAINT IF EXISTS displays_type_check;

ALTER TABLE displays ADD CONSTRAINT displays_template_check CHECK (template IN ('list', 'kanban', 'grid', 'compact', 'slideshow'));

ALTER TABLE displays ADD CONSTRAINT displays_type_check CHECK (type IN ('kitchen', 'bar', 'counter', 'cashier', 'waiting', 'qr', 'advertisement'));
