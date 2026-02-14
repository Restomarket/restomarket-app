-- ============================================
-- SCHEMA MIGRATION: P0 (Critical) + P1 (High Priority) Fixes
-- ============================================
-- Purpose: Add missing fields and constraints for ERP sync best practices
-- Based on: SCHEMA_COMPARISON_ANALYSIS.md
-- Author: Schema Migration Team
-- Date: 2026-02-13
-- ============================================

-- ============================================
-- P0 FIXES: DATA INTEGRITY (CRITICAL)
-- ============================================

-- ============================================
-- 1. ITEMS TABLE: Add Missing Fields & Constraints
-- ============================================

-- Add unique constraints (prevent duplicate items per vendor)
ALTER TABLE items 
  ADD CONSTRAINT items_vendor_erp_id_unique UNIQUE (vendor_id, erp_id);

ALTER TABLE items 
  ADD CONSTRAINT items_vendor_sku_unique UNIQUE (vendor_id, sku);

-- Add slug field (SEO-friendly URLs)
ALTER TABLE items 
  ADD COLUMN slug VARCHAR(300);

-- Backfill slug from name (temporary, should be regenerated properly)
UPDATE items 
  SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
  WHERE slug IS NULL;

ALTER TABLE items 
  ALTER COLUMN slug SET NOT NULL;

CREATE INDEX items_slug_idx ON items(slug);

-- Add stock management flags (ERP behavior control)
ALTER TABLE items 
  ADD COLUMN stock_booking_allowed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN automatic_stock_booking BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN tracking_mode INTEGER NOT NULL DEFAULT 0, -- 0=None, 1=Lot, 2=Serial
  ADD COLUMN pick_movement_disallowed_on_totally_booked_item BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN items.stock_booking_allowed IS 'Whether stock can be reserved for orders';
COMMENT ON COLUMN items.automatic_stock_booking IS 'Auto-reserve stock when order is created';
COMMENT ON COLUMN items.tracking_mode IS '0=None, 1=Lot, 2=Serial (pharma/electronics)';
COMMENT ON COLUMN items.pick_movement_disallowed_on_totally_booked_item IS 'Prevent overselling when fully reserved';

-- Add publishing control
ALTER TABLE items 
  ADD COLUMN publish_on_web BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN items.publish_on_web IS 'Hide from web catalog while keeping in ERP';

-- ============================================
-- 2. STOCK TABLE: Add Unique Constraint
-- ============================================

ALTER TABLE stock 
  ADD CONSTRAINT stock_vendor_warehouse_item_unique UNIQUE (vendor_id, warehouse_id, item_id);

-- Add sync source tracking
ALTER TABLE stock 
  ADD COLUMN last_synced_from VARCHAR(50);

COMMENT ON COLUMN stock.last_synced_from IS 'Sync source: "EBP", "Manual Adjustment", etc.';

-- Add reorder threshold
ALTER TABLE stock 
  ADD COLUMN stock_to_order_threshold NUMERIC(10, 2) DEFAULT 0;

COMMENT ON COLUMN stock.stock_to_order_threshold IS 'Reorder threshold (safety stock buffer)';

-- Rename fields for clarity (optional but recommended)
-- Uncomment if you want ERP-aligned naming:
-- ALTER TABLE stock RENAME COLUMN quantity TO real_stock;
-- ALTER TABLE stock RENAME COLUMN available_quantity TO virtual_stock;

-- ============================================
-- 3. WAREHOUSES TABLE: Add Unique Constraints
-- ============================================

ALTER TABLE warehouses 
  ADD CONSTRAINT warehouses_vendor_erp_id_unique UNIQUE (vendor_id, erp_warehouse_id);

ALTER TABLE warehouses 
  ADD CONSTRAINT warehouses_vendor_code_unique UNIQUE (vendor_id, code);

-- Add GPS coordinates (distance calculations)
ALTER TABLE warehouses 
  ADD COLUMN latitude NUMERIC(10, 7),
  ADD COLUMN longitude NUMERIC(10, 7);

COMMENT ON COLUMN warehouses.latitude IS 'GPS latitude for nearest warehouse routing';
COMMENT ON COLUMN warehouses.longitude IS 'GPS longitude for nearest warehouse routing';

-- Add multi-location flag
ALTER TABLE warehouses 
  ADD COLUMN multi_location_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN warehouses.multi_location_enabled IS 'Supports bin locations (aisle/shelf tracking)';

-- Add last inventory date
ALTER TABLE warehouses 
  ADD COLUMN last_inventory_date TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN warehouses.last_inventory_date IS 'Last physical stock count date';

-- Add state field (US/Canada)
ALTER TABLE warehouses 
  ADD COLUMN state VARCHAR(100);

-- ============================================
-- 4. ORDERS TABLE: Fix Data Types & Add Constraints
-- ============================================

-- Make order_number required and unique
UPDATE orders SET order_number = 'ORD-' || id::text WHERE order_number IS NULL;
ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);

-- Convert document_type from varchar to integer (ERP alignment)
-- WARNING: This is a breaking change! Test carefully!
ALTER TABLE orders 
  ADD COLUMN document_type_int INTEGER;

-- Map existing values (if any)
UPDATE orders SET document_type_int = CASE 
  WHEN document_type = 'quote' THEN 0
  WHEN document_type = 'order' THEN 1
  WHEN document_type = 'delivery' THEN 2
  WHEN document_type = 'invoice' THEN 3
  ELSE 1 -- default to order
END;

ALTER TABLE orders DROP COLUMN document_type;
ALTER TABLE orders RENAME COLUMN document_type_int TO document_type;
ALTER TABLE orders ALTER COLUMN document_type SET NOT NULL;
ALTER TABLE orders ALTER COLUMN document_type SET DEFAULT 1;

COMMENT ON COLUMN orders.document_type IS '0=Quote, 1=Order, 2=Delivery, 3=Invoice (EBP SaleDocument.DocumentType)';

-- Convert validation_state from varchar to integer
ALTER TABLE orders 
  ADD COLUMN validation_state_int INTEGER;

UPDATE orders SET validation_state_int = CASE 
  WHEN validation_state = 'draft' THEN 0
  WHEN validation_state = 'pending' THEN 0
  WHEN validation_state = 'validated' THEN 1
  WHEN validation_state = 'processing' THEN 2
  WHEN validation_state = 'completed' THEN 3
  ELSE 0
END;

ALTER TABLE orders DROP COLUMN validation_state;
ALTER TABLE orders RENAME COLUMN validation_state_int TO validation_state;
ALTER TABLE orders ALTER COLUMN validation_state SET NOT NULL;
ALTER TABLE orders ALTER COLUMN validation_state SET DEFAULT 0;

COMMENT ON COLUMN orders.validation_state IS '0=Draft, 1=Validated, 2=Processing, 3=Completed';

-- Convert delivery_state from varchar to integer
ALTER TABLE orders 
  ADD COLUMN delivery_state_int INTEGER;

UPDATE orders SET delivery_state_int = CASE 
  WHEN delivery_state = 'pending' THEN 0
  WHEN delivery_state = 'not_delivered' THEN 0
  WHEN delivery_state = 'partial' THEN 1
  WHEN delivery_state = 'partially_delivered' THEN 1
  WHEN delivery_state = 'delivered' THEN 2
  WHEN delivery_state = 'fully_delivered' THEN 2
  ELSE 0
END;

ALTER TABLE orders DROP COLUMN delivery_state;
ALTER TABLE orders RENAME COLUMN delivery_state_int TO delivery_state;
ALTER TABLE orders ALTER COLUMN delivery_state SET NOT NULL;
ALTER TABLE orders ALTER COLUMN delivery_state SET DEFAULT 0;

COMMENT ON COLUMN orders.delivery_state IS '0=Not delivered, 1=Partially delivered, 2=Fully delivered';

-- Add customer reference (PO number)
ALTER TABLE orders 
  ADD COLUMN reference VARCHAR(100);

COMMENT ON COLUMN orders.reference IS 'Customer purchase order / reference number';

-- Add shipping VAT rate
ALTER TABLE orders 
  ADD COLUMN shipping_vat_rate NUMERIC(5, 2) DEFAULT 0;

COMMENT ON COLUMN orders.shipping_vat_rate IS 'VAT rate for shipping charges (percentage)';

-- Add payment authorization fields
ALTER TABLE orders 
  ADD COLUMN payment_auth_number VARCHAR(50),
  ADD COLUMN payment_processed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN orders.payment_auth_number IS 'Authorization number from payment gateway (NAPS, etc.)';
COMMENT ON COLUMN orders.payment_processed_at IS 'When payment was completed';

-- Add legacy status field (backward compatibility - deprecated)
ALTER TABLE orders 
  ADD COLUMN status VARCHAR(50);

COMMENT ON COLUMN orders.status IS 'DEPRECATED: Use validation_state instead. Kept for migration period.';

-- Add legacy total_amount field (computed, deprecated)
ALTER TABLE orders 
  ADD COLUMN total_amount NUMERIC(12, 2);

UPDATE orders SET total_amount = amount_vat_included WHERE total_amount IS NULL;

COMMENT ON COLUMN orders.total_amount IS 'DEPRECATED: Use amount_vat_included instead. Kept for migration period.';

-- ============================================
-- 5. ORDER_ITEMS TABLE: Fix Data Types
-- ============================================

-- Fix stock_movement_id data type (varchar → integer for EBP Int32)
-- NOTE: This requires careful migration if data exists
ALTER TABLE order_items 
  ADD COLUMN stock_movement_id_int INTEGER;

-- Attempt to convert existing values (NULL if not numeric)
UPDATE order_items 
  SET stock_movement_id_int = stock_movement_id::integer
  WHERE stock_movement_id ~ '^[0-9]+$';

ALTER TABLE order_items DROP COLUMN stock_movement_id;
ALTER TABLE order_items RENAME COLUMN stock_movement_id_int TO stock_movement_id;

COMMENT ON COLUMN order_items.stock_movement_id IS 'EBP StockMovement.Id (Int32) - link to stock movement record';

-- ============================================
-- P1 FIXES: BUSINESS LOGIC (HIGH PRIORITY)
-- ============================================

-- ============================================
-- 6. ITEMS TABLE: Add Aggregated Stock Fields
-- ============================================

ALTER TABLE items 
  ADD COLUMN total_real_stock NUMERIC(10, 3) DEFAULT 0 NOT NULL,
  ADD COLUMN total_virtual_stock NUMERIC(10, 3) DEFAULT 0 NOT NULL,
  ADD COLUMN total_reserved_quantity NUMERIC(10, 3) DEFAULT 0 NOT NULL;

COMMENT ON COLUMN items.total_real_stock IS 'Aggregated physical stock across all warehouses (denormalized for performance)';
COMMENT ON COLUMN items.total_virtual_stock IS 'Aggregated available stock across all warehouses (denormalized for performance)';
COMMENT ON COLUMN items.total_reserved_quantity IS 'Aggregated reserved quantity across all warehouses (denormalized for performance)';

CREATE INDEX items_total_real_stock_idx ON items(total_real_stock);
CREATE INDEX items_total_virtual_stock_idx ON items(total_virtual_stock);

-- Backfill aggregated stock from stock table
UPDATE items i
SET 
  total_real_stock = COALESCE((SELECT SUM(quantity) FROM stock WHERE item_id = i.id), 0),
  total_virtual_stock = COALESCE((SELECT SUM(available_quantity) FROM stock WHERE item_id = i.id), 0),
  total_reserved_quantity = COALESCE((SELECT SUM(reserved_quantity) FROM stock WHERE item_id = i.id), 0);

-- ============================================
-- 7. ITEMS TABLE: Add Physical Attributes (Shipping)
-- ============================================

ALTER TABLE items 
  ADD COLUMN weight NUMERIC(10, 3) DEFAULT 0,
  ADD COLUMN weight_unit VARCHAR(20) DEFAULT 'kg',
  ADD COLUMN height NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN width NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN length NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN dimension_unit VARCHAR(20) DEFAULT 'cm',
  ADD COLUMN items_per_package INTEGER;

COMMENT ON COLUMN items.weight IS 'Product weight (for shipping cost calculation)';
COMMENT ON COLUMN items.weight_unit IS 'Weight unit: kg, g, lb, oz';
COMMENT ON COLUMN items.height IS 'Product height (for dimensional weight)';
COMMENT ON COLUMN items.width IS 'Product width (for dimensional weight)';
COMMENT ON COLUMN items.length IS 'Product length (for dimensional weight)';
COMMENT ON COLUMN items.dimension_unit IS 'Dimension unit: cm, m, in, ft';
COMMENT ON COLUMN items.items_per_package IS 'EBP NumberOfItemByPackage - items per shipping unit';

-- ============================================
-- 8. ITEMS TABLE: Add E-Commerce Metadata (Oxatis)
-- ============================================

ALTER TABLE items 
  ADD COLUMN meta_title VARCHAR(100),
  ADD COLUMN meta_description VARCHAR(200),
  ADD COLUMN meta_keywords VARCHAR(200),
  ADD COLUMN brand VARCHAR(50),
  ADD COLUMN days_to_ship INTEGER,
  ADD COLUMN ship_price_ttc NUMERIC(10, 2);

COMMENT ON COLUMN items.meta_title IS 'SEO meta title (Oxatis: Oxatis_Oxatis_MetaTitle)';
COMMENT ON COLUMN items.meta_description IS 'SEO meta description (Oxatis: Oxatis_Oxatis_MetaDescription)';
COMMENT ON COLUMN items.meta_keywords IS 'SEO meta keywords (Oxatis: Oxatis_Oxatis_MetaKeywords)';
COMMENT ON COLUMN items.brand IS 'Product brand (Oxatis: Oxatis_Oxatis_Brand)';
COMMENT ON COLUMN items.days_to_ship IS 'Expected shipping days (Oxatis: Oxatis_Oxatis_DaysToship)';
COMMENT ON COLUMN items.ship_price_ttc IS 'Shipping price TTC (Oxatis: Oxatis_Oxatis_ShipPrice)';

-- ============================================
-- 9. ITEMS TABLE: Add International Trade
-- ============================================

ALTER TABLE items 
  ADD COLUMN origin_country_code VARCHAR(10);

COMMENT ON COLUMN items.origin_country_code IS 'Country of origin ISO code (Intrastat, customs)';

-- ============================================
-- 10. ORDERS TABLE: Add Calculated Amount Fields
-- ============================================

ALTER TABLE orders 
  ADD COLUMN amount_vat_excluded_with_discount NUMERIC(12, 2) DEFAULT 0 NOT NULL,
  ADD COLUMN amount_vat_excluded_with_discount_and_shipping NUMERIC(12, 2) DEFAULT 0 NOT NULL;

COMMENT ON COLUMN orders.amount_vat_excluded_with_discount IS 'Subtotal after order-level discount (before shipping)';
COMMENT ON COLUMN orders.amount_vat_excluded_with_discount_and_shipping IS 'Net total before VAT (subtotal with discount + shipping)';

-- Backfill calculated fields
UPDATE orders 
SET 
  amount_vat_excluded_with_discount = COALESCE(amount_vat_excluded, 0) - COALESCE(discount_amount, 0),
  amount_vat_excluded_with_discount_and_shipping = 
    COALESCE(amount_vat_excluded, 0) - COALESCE(discount_amount, 0) + COALESCE(shipping_amount_vat_excluded, 0);

-- ============================================
-- 11. ORDER_ITEMS TABLE: Add Calculated Amount Fields
-- ============================================

ALTER TABLE order_items 
  ADD COLUMN net_amount_vat_excluded_with_discount NUMERIC(12, 2) DEFAULT 0;

COMMENT ON COLUMN order_items.net_amount_vat_excluded_with_discount IS 'Line total after discount (excluding VAT)';

-- Backfill calculated field
UPDATE order_items 
SET net_amount_vat_excluded_with_discount = 
  COALESCE(net_amount_vat_excluded, 0) - COALESCE(discount_amount, 0);

-- ============================================
-- TRIGGERS FOR AGGREGATED STOCK (Optional but Recommended)
-- ============================================

-- Create function to update item aggregated stock
CREATE OR REPLACE FUNCTION update_item_aggregated_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Update item totals when stock changes
  UPDATE items 
  SET 
    total_real_stock = (SELECT COALESCE(SUM(quantity), 0) FROM stock WHERE item_id = COALESCE(NEW.item_id, OLD.item_id)),
    total_virtual_stock = (SELECT COALESCE(SUM(available_quantity), 0) FROM stock WHERE item_id = COALESCE(NEW.item_id, OLD.item_id)),
    total_reserved_quantity = (SELECT COALESCE(SUM(reserved_quantity), 0) FROM stock WHERE item_id = COALESCE(NEW.item_id, OLD.item_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.item_id, OLD.item_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS stock_insert_update_item_totals ON stock;
CREATE TRIGGER stock_insert_update_item_totals
AFTER INSERT OR UPDATE ON stock
FOR EACH ROW
EXECUTE FUNCTION update_item_aggregated_stock();

DROP TRIGGER IF EXISTS stock_delete_update_item_totals ON stock;
CREATE TRIGGER stock_delete_update_item_totals
AFTER DELETE ON stock
FOR EACH ROW
EXECUTE FUNCTION update_item_aggregated_stock();

-- ============================================
-- VALIDATION QUERIES (Run after migration)
-- ============================================

-- Check for duplicate items (should return 0)
SELECT vendor_id, erp_id, COUNT(*) 
FROM items 
GROUP BY vendor_id, erp_id 
HAVING COUNT(*) > 1;

-- Check for duplicate stock records (should return 0)
SELECT vendor_id, warehouse_id, item_id, COUNT(*) 
FROM stock 
GROUP BY vendor_id, warehouse_id, item_id 
HAVING COUNT(*) > 1;

-- Check for orders without order_number (should return 0)
SELECT COUNT(*) FROM orders WHERE order_number IS NULL;

-- Verify aggregated stock matches (differences should be 0)
SELECT 
  i.id,
  i.sku,
  i.total_real_stock,
  COALESCE(SUM(s.quantity), 0) AS actual_real_stock,
  i.total_real_stock - COALESCE(SUM(s.quantity), 0) AS difference
FROM items i
LEFT JOIN stock s ON s.item_id = i.id
GROUP BY i.id, i.sku, i.total_real_stock
HAVING i.total_real_stock - COALESCE(SUM(s.quantity), 0) != 0;

-- ============================================
-- ROLLBACK SCRIPT (IF NEEDED)
-- ============================================
-- UNCOMMENT AND RUN CAREFULLY IF YOU NEED TO ROLLBACK

/*
-- Drop triggers
DROP TRIGGER IF EXISTS stock_insert_update_item_totals ON stock;
DROP TRIGGER IF EXISTS stock_delete_update_item_totals ON stock;
DROP FUNCTION IF EXISTS update_item_aggregated_stock();

-- Items table
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_vendor_erp_id_unique;
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_vendor_sku_unique;
DROP INDEX IF EXISTS items_slug_idx;
DROP INDEX IF EXISTS items_total_real_stock_idx;
DROP INDEX IF EXISTS items_total_virtual_stock_idx;
ALTER TABLE items DROP COLUMN IF EXISTS slug;
ALTER TABLE items DROP COLUMN IF EXISTS stock_booking_allowed;
ALTER TABLE items DROP COLUMN IF EXISTS automatic_stock_booking;
ALTER TABLE items DROP COLUMN IF EXISTS tracking_mode;
ALTER TABLE items DROP COLUMN IF EXISTS pick_movement_disallowed_on_totally_booked_item;
ALTER TABLE items DROP COLUMN IF EXISTS publish_on_web;
ALTER TABLE items DROP COLUMN IF EXISTS total_real_stock;
ALTER TABLE items DROP COLUMN IF EXISTS total_virtual_stock;
ALTER TABLE items DROP COLUMN IF EXISTS total_reserved_quantity;
ALTER TABLE items DROP COLUMN IF EXISTS weight;
ALTER TABLE items DROP COLUMN IF EXISTS weight_unit;
ALTER TABLE items DROP COLUMN IF EXISTS height;
ALTER TABLE items DROP COLUMN IF EXISTS width;
ALTER TABLE items DROP COLUMN IF EXISTS length;
ALTER TABLE items DROP COLUMN IF EXISTS dimension_unit;
ALTER TABLE items DROP COLUMN IF EXISTS items_per_package;
ALTER TABLE items DROP COLUMN IF EXISTS meta_title;
ALTER TABLE items DROP COLUMN IF EXISTS meta_description;
ALTER TABLE items DROP COLUMN IF EXISTS meta_keywords;
ALTER TABLE items DROP COLUMN IF EXISTS brand;
ALTER TABLE items DROP COLUMN IF EXISTS days_to_ship;
ALTER TABLE items DROP COLUMN IF EXISTS ship_price_ttc;
ALTER TABLE items DROP COLUMN IF EXISTS origin_country_code;

-- Stock table
ALTER TABLE stock DROP CONSTRAINT IF EXISTS stock_vendor_warehouse_item_unique;
ALTER TABLE stock DROP COLUMN IF EXISTS last_synced_from;
ALTER TABLE stock DROP COLUMN IF EXISTS stock_to_order_threshold;

-- Warehouses table
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_vendor_erp_id_unique;
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_vendor_code_unique;
ALTER TABLE warehouses DROP COLUMN IF EXISTS latitude;
ALTER TABLE warehouses DROP COLUMN IF EXISTS longitude;
ALTER TABLE warehouses DROP COLUMN IF EXISTS multi_location_enabled;
ALTER TABLE warehouses DROP COLUMN IF EXISTS last_inventory_date;
ALTER TABLE warehouses DROP COLUMN IF EXISTS state;

-- Orders table
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_unique;
ALTER TABLE orders DROP COLUMN IF EXISTS reference;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_vat_rate;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_auth_number;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_processed_at;
ALTER TABLE orders DROP COLUMN IF EXISTS status;
ALTER TABLE orders DROP COLUMN IF EXISTS total_amount;
ALTER TABLE orders DROP COLUMN IF EXISTS amount_vat_excluded_with_discount;
ALTER TABLE orders DROP COLUMN IF EXISTS amount_vat_excluded_with_discount_and_shipping;

-- Order items table
ALTER TABLE order_items DROP COLUMN IF EXISTS net_amount_vat_excluded_with_discount;
*/

-- ============================================
-- END OF MIGRATION
-- ============================================
