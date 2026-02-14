CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(100),
	"document_date" timestamp with time zone,
	"document_type" varchar(50) DEFAULT 'order',
	"validation_state" varchar(50) DEFAULT 'pending',
	"vendor_id" varchar(100) NOT NULL,
	"customer_id" varchar(100),
	"customer_email" varchar(255),
	"customer_phone" varchar(50),
	"erp_customer_code" varchar(100),
	"billing_address" jsonb,
	"shipping_address" jsonb,
	"warehouse_id" uuid,
	"delivery_date" timestamp with time zone,
	"delivery_state" varchar(50) DEFAULT 'pending',
	"amount_vat_excluded" numeric(12, 2),
	"discount_rate" numeric(5, 2) DEFAULT '0',
	"discount_amount" numeric(12, 2) DEFAULT '0',
	"vat_amount" numeric(12, 2),
	"amount_vat_included" numeric(12, 2),
	"cost_price" numeric(12, 2),
	"shipping_amount_vat_excluded" numeric(10, 2) DEFAULT '0',
	"shipping_amount_vat_included" numeric(10, 2) DEFAULT '0',
	"payment_method" varchar(50),
	"payment_status" varchar(50) DEFAULT 'pending',
	"payment_provider" varchar(50),
	"payment_transaction_id" varchar(255),
	"payment_amount" numeric(12, 2),
	"erp_reference" varchar(100),
	"erp_status" varchar(50),
	"erp_document_id" varchar(100),
	"erp_serial_id" varchar(100),
	"erp_vat_id" varchar(100),
	"erp_territoriality_id" varchar(100),
	"erp_settlement_mode_id" varchar(100),
	"erp_synced_at" timestamp with time zone,
	"erp_sync_error" text,
	"content_hash" varchar(64),
	"reservation_job_id" varchar(100),
	"customer_notes" text,
	"internal_notes" text,
	"created_by" varchar(100),
	"updated_by" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"line_order" integer DEFAULT 0 NOT NULL,
	"sku" varchar(100) NOT NULL,
	"item_id" uuid,
	"description" varchar(500),
	"quantity" numeric(10, 2) NOT NULL,
	"ordered_quantity" numeric(10, 2),
	"delivered_quantity" numeric(10, 2) DEFAULT '0',
	"remaining_quantity_to_deliver" numeric(10, 2),
	"returned_quantity" numeric(10, 2) DEFAULT '0',
	"invoiced_quantity" numeric(10, 2) DEFAULT '0',
	"remaining_quantity_to_invoice" numeric(10, 2),
	"unit_code" varchar(50),
	"warehouse_id" uuid,
	"manage_stock" boolean DEFAULT true,
	"purchase_price" numeric(10, 2),
	"cost_price" numeric(10, 2),
	"unit_price" numeric(10, 2),
	"net_price_vat_excluded" numeric(10, 2),
	"net_price_vat_included" numeric(10, 2),
	"net_amount_vat_excluded" numeric(12, 2),
	"net_amount_vat_included" numeric(12, 2),
	"discount_rate" numeric(5, 2) DEFAULT '0',
	"discount_amount" numeric(10, 2) DEFAULT '0',
	"vat_rate" numeric(5, 2),
	"vat_amount" numeric(10, 2),
	"erp_vat_id" varchar(100),
	"delivery_date" timestamp with time zone,
	"delivery_state" varchar(50) DEFAULT 'pending',
	"reservation_status" varchar(50) DEFAULT 'none',
	"reserved_at" timestamp with time zone,
	"reservation_expires_at" timestamp with time zone,
	"weight" numeric(10, 4),
	"volume" numeric(10, 4),
	"erp_line_id" varchar(100),
	"erp_synced_at" timestamp with time zone,
	"stock_movement_id" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_warehouse_id_warehouses_id_fk') THEN
        ALTER TABLE "orders" ADD CONSTRAINT "orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_order_id_orders_id_fk') THEN
        ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_item_id_items_id_fk') THEN
        ALTER TABLE "order_items" ADD CONSTRAINT "order_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_warehouse_id_warehouses_id_fk') THEN
        ALTER TABLE "order_items" ADD CONSTRAINT "order_items_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_vendor_id_idx" ON "orders" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_validation_state_idx" ON "orders" USING btree ("validation_state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_delivery_state_idx" ON "orders" USING btree ("delivery_state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_erp_document_id_idx" ON "orders" USING btree ("erp_document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_document_date_idx" ON "orders" USING btree ("document_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_payment_status_idx" ON "orders" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_order_number_idx" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_item_id_idx" ON "order_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_delivery_state_idx" ON "order_items" USING btree ("delivery_state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_reservation_status_idx" ON "order_items" USING btree ("reservation_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_reservation_expires_idx" ON "order_items" USING btree ("reservation_expires_at");