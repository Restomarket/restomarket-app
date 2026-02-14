CREATE TABLE IF NOT EXISTS "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar(100) NOT NULL,
	"sku" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"unit_code" varchar(50) NOT NULL,
	"unit_label" varchar(100) NOT NULL,
	"vat_code" varchar(50) NOT NULL,
	"vat_rate" numeric(5, 2) NOT NULL,
	"family_code" varchar(50),
	"family_label" varchar(100),
	"subfamily_code" varchar(50),
	"subfamily_label" varchar(100),
	"unit_price" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'EUR',
	"is_active" boolean DEFAULT true NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"last_synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar(100) NOT NULL,
	"erp_warehouse_id" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50),
	"address" text,
	"city" varchar(100),
	"postal_code" varchar(20),
	"country" varchar(2) DEFAULT 'FR',
	"is_active" boolean DEFAULT true NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"last_synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar(100) NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"reserved_quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"available_quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"last_synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_vendor_sku_idx" ON "items" USING btree ("vendor_id","sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_vendor_id_idx" ON "items" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_sku_idx" ON "items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_family_code_idx" ON "items" USING btree ("family_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_is_active_idx" ON "items" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_content_hash_idx" ON "items" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warehouses_vendor_erp_id_idx" ON "warehouses" USING btree ("vendor_id","erp_warehouse_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warehouses_vendor_id_idx" ON "warehouses" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warehouses_is_active_idx" ON "warehouses" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warehouses_content_hash_idx" ON "warehouses" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_vendor_warehouse_item_idx" ON "stock" USING btree ("vendor_id","warehouse_id","item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_vendor_id_idx" ON "stock" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_warehouse_id_idx" ON "stock" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_item_id_idx" ON "stock" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_content_hash_idx" ON "stock" USING btree ("content_hash");