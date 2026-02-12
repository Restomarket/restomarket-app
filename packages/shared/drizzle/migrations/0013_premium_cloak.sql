ALTER TABLE "stock" ADD COLUMN "ordered_quantity" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN "pump" numeric(10, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN "stock_value" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN "min_stock" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN "max_stock" numeric(10, 2);