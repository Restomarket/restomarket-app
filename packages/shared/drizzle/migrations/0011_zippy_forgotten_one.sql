ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "price_excl_vat" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "price_incl_vat" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "vat_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "erp_id" varchar(100) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "manage_stock" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "allow_negative_stock" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "barcode" varchar(100);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_erp_id_idx" ON "items" USING btree ("erp_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_manage_stock_idx" ON "items" USING btree ("manage_stock");