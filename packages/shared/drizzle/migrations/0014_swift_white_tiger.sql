DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock' AND column_name='available_quantity') THEN
        ALTER TABLE "stock" RENAME COLUMN "available_quantity" TO "real_stock";
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock' AND column_name='quantity') THEN
        ALTER TABLE "stock" RENAME COLUMN "quantity" TO "virtual_stock";
    END IF;
END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "orders_order_number_idx";--> statement-breakpoint
ALTER TABLE "warehouses" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stock" ALTER COLUMN "reserved_quantity" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "stock" ALTER COLUMN "reserved_quantity" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "stock" ALTER COLUMN "ordered_quantity" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "stock" ALTER COLUMN "ordered_quantity" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "stock" ALTER COLUMN "min_stock" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "stock" ALTER COLUMN "min_stock" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "stock" ALTER COLUMN "max_stock" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "document_date" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "document_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "document_type" DROP DEFAULT;--> statement-breakpoint
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns WHERE table_name='orders' AND column_name='document_type') = 'character varying' THEN
        ALTER TABLE "orders" ALTER COLUMN "document_type" SET DATA TYPE integer USING (
          CASE document_type WHEN 'quote' THEN 0 WHEN 'order' THEN 1 WHEN 'delivery' THEN 2 WHEN 'invoice' THEN 3 ELSE 1 END
        );
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "document_type" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "document_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "validation_state" DROP DEFAULT;--> statement-breakpoint
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns WHERE table_name='orders' AND column_name='validation_state') = 'character varying' THEN
        ALTER TABLE "orders" ALTER COLUMN "validation_state" SET DATA TYPE integer USING (
          CASE validation_state WHEN 'draft' THEN 0 WHEN 'pending' THEN 0 WHEN 'validated' THEN 1 WHEN 'processing' THEN 2 WHEN 'completed' THEN 3 ELSE 0 END
        );
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "validation_state" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "validation_state" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_state" DROP DEFAULT;--> statement-breakpoint
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_state') = 'character varying' THEN
        ALTER TABLE "orders" ALTER COLUMN "delivery_state" SET DATA TYPE integer USING (
          CASE delivery_state WHEN 'pending' THEN 0 WHEN 'not_delivered' THEN 0 WHEN 'partial' THEN 1 WHEN 'partially_delivered' THEN 1 WHEN 'delivered' THEN 2 WHEN 'fully_delivered' THEN 2 ELSE 0 END
        );
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_state" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_state" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "amount_vat_excluded" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "amount_vat_excluded" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "vat_amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "vat_amount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "amount_vat_included" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "amount_vat_included" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "cost_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "purchase_price" SET DATA TYPE numeric(10, 4);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "purchase_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "cost_price" SET DATA TYPE numeric(10, 4);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "cost_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "unit_price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "net_price_vat_excluded" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "net_amount_vat_excluded" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "net_amount_vat_excluded" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "net_amount_vat_included" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "discount_amount" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "discount_amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "vat_rate" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "vat_amount" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "vat_amount" SET DEFAULT '0';--> statement-breakpoint
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns WHERE table_name='order_items' AND column_name='stock_movement_id') = 'character varying' THEN
        ALTER TABLE "order_items" ALTER COLUMN "stock_movement_id" SET DATA TYPE integer USING NULLIF("stock_movement_id", '')::integer;
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "slug" varchar(300) NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "publish_on_web" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "stock_booking_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "automatic_stock_booking" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "tracking_mode" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "pick_movement_disallowed_on_totally_booked_item" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "total_real_stock" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "total_virtual_stock" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "total_reserved_quantity" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "weight" numeric(10, 3) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "weight_unit" varchar(20) DEFAULT 'kg';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "height" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "width" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "length" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "dimension_unit" varchar(20) DEFAULT 'cm';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "items_per_package" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "meta_title" varchar(100);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "meta_description" varchar(200);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "meta_keywords" varchar(200);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "brand" varchar(50);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "days_to_ship" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "ship_price_ttc" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "origin_country_code" varchar(10);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "state" varchar(100);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "multi_location_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "last_inventory_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN IF NOT EXISTS "stock_to_order_threshold" numeric(10, 3) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN IF NOT EXISTS "last_synced_from" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reference" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "amount_vat_excluded_with_discount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "amount_vat_excluded_with_discount_and_shipping" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_vat_rate" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_method" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "currency_code" varchar(3) DEFAULT 'EUR';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_auth_number" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "total_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "net_amount_vat_excluded_with_discount" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_slug_idx" ON "items" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_publish_on_web_idx" ON "items" USING btree ("publish_on_web");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_total_real_stock_idx" ON "items" USING btree ("total_real_stock");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_total_virtual_stock_idx" ON "items" USING btree ("total_virtual_stock");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_document_type_idx" ON "orders" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_vendor_erp_id_unique') THEN
        ALTER TABLE "items" ADD CONSTRAINT "items_vendor_erp_id_unique" UNIQUE("vendor_id","erp_id");
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_vendor_sku_unique') THEN
        ALTER TABLE "items" ADD CONSTRAINT "items_vendor_sku_unique" UNIQUE("vendor_id","sku");
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouses_vendor_erp_id_unique') THEN
        ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_vendor_erp_id_unique" UNIQUE("vendor_id","erp_warehouse_id");
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouses_vendor_code_unique') THEN
        ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_vendor_code_unique" UNIQUE("vendor_id","code");
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_vendor_warehouse_item_unique') THEN
        ALTER TABLE "stock" ADD CONSTRAINT "stock_vendor_warehouse_item_unique" UNIQUE("vendor_id","warehouse_id","item_id");
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_number_unique') THEN
        ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_unique" UNIQUE("order_number");
    END IF;
END $$;