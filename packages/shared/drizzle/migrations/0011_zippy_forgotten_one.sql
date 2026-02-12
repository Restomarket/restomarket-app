ALTER TABLE "items" ADD COLUMN "price_excl_vat" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "price_incl_vat" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "vat_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "erp_id" varchar(100) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "manage_stock" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "allow_negative_stock" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "barcode" varchar(100);--> statement-breakpoint
CREATE INDEX "items_erp_id_idx" ON "items" USING btree ("erp_id");--> statement-breakpoint
CREATE INDEX "items_manage_stock_idx" ON "items" USING btree ("manage_stock");