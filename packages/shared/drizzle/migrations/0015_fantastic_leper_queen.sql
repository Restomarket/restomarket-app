CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar(100) NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"movement_type" varchar(50) NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"unit_cost" numeric(10, 4),
	"total_cost" numeric(12, 2),
	"reference_type" varchar(50),
	"reference_id" varchar(100),
	"erp_movement_id" varchar(100),
	"stock_movement_line_id" integer,
	"batch_number" varchar(100),
	"serial_number" varchar(100),
	"notes" text,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"price_list_id" uuid NOT NULL,
	"item_id" uuid,
	"sku" varchar(100) NOT NULL,
	"price_excl_vat" numeric(10, 4) NOT NULL,
	"price_incl_vat" numeric(10, 4),
	"min_quantity" numeric(10, 3) DEFAULT '1' NOT NULL,
	"discount_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"content_hash" varchar(64),
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_list_items_list_sku_qty_unique" UNIQUE("price_list_id","sku","min_quantity")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar(100) NOT NULL,
	"erp_price_list_id" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"currency_code" varchar(3) DEFAULT 'EUR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_lists_vendor_erp_id_unique" UNIQUE("vendor_id","erp_price_list_id")
);
--> statement-breakpoint
UPDATE "order_items" SET "net_amount_vat_excluded_with_discount" = '0' WHERE "net_amount_vat_excluded_with_discount" IS NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "net_amount_vat_excluded_with_discount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "delivery_state" DROP DEFAULT;--> statement-breakpoint
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns WHERE table_name='order_items' AND column_name='delivery_state') = 'character varying' THEN
        ALTER TABLE "order_items" ALTER COLUMN "delivery_state" SET DATA TYPE integer USING (
          CASE delivery_state WHEN 'partial' THEN 1 WHEN 'delivered' THEN 2 ELSE 0 END
        );
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "delivery_state" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "delivery_state" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "catalog_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "purchase_price" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "minimum_order_quantity" numeric(10, 3) DEFAULT '1';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "last_synced_from" varchar(50);--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN IF NOT EXISTS "incoming_quantity" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelled_by" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "expected_ship_date" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_item_id_items_id_fk') THEN
        ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_warehouse_id_warehouses_id_fk') THEN
        ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_list_items_price_list_id_price_lists_id_fk') THEN
        ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_list_items_item_id_items_id_fk') THEN
        ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_vendor_id_idx" ON "stock_movements" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_item_id_idx" ON "stock_movements" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_warehouse_id_idx" ON "stock_movements" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_movement_type_idx" ON "stock_movements" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_erp_movement_id_idx" ON "stock_movements" USING btree ("erp_movement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_reference_id_idx" ON "stock_movements" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_created_at_idx" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_list_items_price_list_id_idx" ON "price_list_items" USING btree ("price_list_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_list_items_item_id_idx" ON "price_list_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_list_items_sku_idx" ON "price_list_items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_list_items_is_active_idx" ON "price_list_items" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_lists_vendor_id_idx" ON "price_lists" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_lists_is_active_idx" ON "price_lists" USING btree ("is_active");--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_warehouse_id_warehouses_id_fk') THEN
        ALTER TABLE "stock" ADD CONSTRAINT "stock_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_item_id_items_id_fk') THEN
        ALTER TABLE "stock" ADD CONSTRAINT "stock_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;