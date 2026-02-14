ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "is_main" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "type" integer DEFAULT 0 NOT NULL;