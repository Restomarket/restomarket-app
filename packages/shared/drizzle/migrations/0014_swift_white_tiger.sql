ALTER TABLE "stock" RENAME COLUMN "available_quantity" TO "real_stock";--> statement-breakpoint
ALTER TABLE "stock" RENAME COLUMN "quantity" TO "virtual_stock";--> statement-breakpoint
DROP INDEX "orders_order_number_idx";--> statement-breakpoint
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
ALTER TABLE "orders" ALTER COLUMN "document_type" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "document_type" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "document_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "validation_state" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "validation_state" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_state" SET DATA TYPE integer;--> statement-breakpoint
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
ALTER TABLE "order_items" ALTER COLUMN "stock_movement_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "slug" varchar(300) NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "publish_on_web" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "stock_booking_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "automatic_stock_booking" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "tracking_mode" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "pick_movement_disallowed_on_totally_booked_item" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "total_real_stock" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "total_virtual_stock" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "total_reserved_quantity" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "weight" numeric(10, 3) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "weight_unit" varchar(20) DEFAULT 'kg';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "height" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "width" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "length" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "dimension_unit" varchar(20) DEFAULT 'cm';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "items_per_package" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "meta_title" varchar(100);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "meta_description" varchar(200);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "meta_keywords" varchar(200);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "brand" varchar(50);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "days_to_ship" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "ship_price_ttc" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "origin_country_code" varchar(10);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "state" varchar(100);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "multi_location_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "last_inventory_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN "stock_to_order_threshold" numeric(10, 3) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN "last_synced_from" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reference" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "amount_vat_excluded_with_discount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "amount_vat_excluded_with_discount_and_shipping" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_vat_rate" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_method" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "currency_code" varchar(3) DEFAULT 'EUR';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_auth_number" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status" varchar(50) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "total_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "net_amount_vat_excluded_with_discount" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
CREATE INDEX "items_slug_idx" ON "items" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "items_publish_on_web_idx" ON "items" USING btree ("publish_on_web");--> statement-breakpoint
CREATE INDEX "items_total_real_stock_idx" ON "items" USING btree ("total_real_stock");--> statement-breakpoint
CREATE INDEX "items_total_virtual_stock_idx" ON "items" USING btree ("total_virtual_stock");--> statement-breakpoint
CREATE INDEX "orders_document_type_idx" ON "orders" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_vendor_erp_id_unique" UNIQUE("vendor_id","erp_id");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_vendor_sku_unique" UNIQUE("vendor_id","sku");--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_vendor_erp_id_unique" UNIQUE("vendor_id","erp_warehouse_id");--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_vendor_code_unique" UNIQUE("vendor_id","code");--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_vendor_warehouse_item_unique" UNIQUE("vendor_id","warehouse_id","item_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_unique" UNIQUE("order_number");