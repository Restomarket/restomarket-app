ALTER TABLE "stock" ADD COLUMN IF NOT EXISTS "ordered_quantity" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN IF NOT EXISTS "pump" numeric(10, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN IF NOT EXISTS "stock_value" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN IF NOT EXISTS "min_stock" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN IF NOT EXISTS "max_stock" numeric(10, 2);