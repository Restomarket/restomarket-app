CREATE TABLE IF NOT EXISTS "customer_erp_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar(100) NOT NULL,
	"organization_id" text,
	"user_id" text,
	"erp_customer_id" varchar(100) NOT NULL,
	"erp_customer_code" varchar(20) NOT NULL,
	"default_price_list_id" uuid,
	"default_warehouse_id" uuid,
	"erp_settlement_mode_id" varchar(10),
	"erp_vat_id" varchar(100),
	"erp_territoriality_id" varchar(100),
	"credit_limit" numeric(12, 2) DEFAULT '0',
	"outstanding_balance" numeric(12, 2) DEFAULT '0',
	"requires_approval" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"content_hash" varchar(64),
	"last_synced_at" timestamp with time zone,
	"erp_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_erp_profiles_vendor_org_unique" UNIQUE("vendor_id","organization_id"),
	CONSTRAINT "customer_erp_profiles_vendor_user_unique" UNIQUE("vendor_id","user_id"),
	CONSTRAINT "customer_erp_profiles_vendor_erp_code_unique" UNIQUE("vendor_id","erp_customer_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"nb_decimal" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_vendor_code_unique" UNIQUE("vendor_id","code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vat_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"rate" numeric(5, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vat_rates_vendor_code_unique" UNIQUE("vendor_id","code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "families_vendor_code_unique" UNIQUE("vendor_id","code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subfamilies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar(100) NOT NULL,
	"family_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subfamilies_vendor_code_unique" UNIQUE("vendor_id","code")
);
--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "quantity" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "ordered_quantity" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "delivered_quantity" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "delivered_quantity" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "remaining_quantity_to_deliver" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "returned_quantity" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "returned_quantity" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "invoiced_quantity" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "invoiced_quantity" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "remaining_quantity_to_invoice" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "erp_code_mappings" ADD COLUMN IF NOT EXISTS "unit_id" uuid;--> statement-breakpoint
ALTER TABLE "erp_code_mappings" ADD COLUMN IF NOT EXISTS "vat_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "erp_code_mappings" ADD COLUMN IF NOT EXISTS "family_id" uuid;--> statement-breakpoint
ALTER TABLE "erp_code_mappings" ADD COLUMN IF NOT EXISTS "subfamily_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "unit_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "vat_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "family_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "subfamily_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "is_obsolete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "erp_vat_id" varchar(100);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "erp_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN IF NOT EXISTS "erp_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "erp_item_id" varchar(100);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "erp_warehouse_id" varchar(100);--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_erp_profiles_organization_id_organization_id_fk') THEN
        ALTER TABLE "customer_erp_profiles" ADD CONSTRAINT "customer_erp_profiles_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_erp_profiles_user_id_user_id_fk') THEN
        ALTER TABLE "customer_erp_profiles" ADD CONSTRAINT "customer_erp_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_erp_profiles_default_price_list_id_price_lists_id_fk') THEN
        ALTER TABLE "customer_erp_profiles" ADD CONSTRAINT "customer_erp_profiles_default_price_list_id_price_lists_id_fk" FOREIGN KEY ("default_price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_erp_profiles_default_warehouse_id_warehouses_id_fk') THEN
        ALTER TABLE "customer_erp_profiles" ADD CONSTRAINT "customer_erp_profiles_default_warehouse_id_warehouses_id_fk" FOREIGN KEY ("default_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subfamilies_family_id_families_id_fk') THEN
        ALTER TABLE "subfamilies" ADD CONSTRAINT "subfamilies_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_erp_profiles_vendor_id_idx" ON "customer_erp_profiles" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_erp_profiles_organization_id_idx" ON "customer_erp_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_erp_profiles_user_id_idx" ON "customer_erp_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_erp_profiles_erp_customer_id_idx" ON "customer_erp_profiles" USING btree ("erp_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_erp_profiles_is_active_idx" ON "customer_erp_profiles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "units_vendor_id_idx" ON "units" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "units_code_idx" ON "units" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "units_is_active_idx" ON "units" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vat_rates_vendor_id_idx" ON "vat_rates" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vat_rates_code_idx" ON "vat_rates" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vat_rates_is_active_idx" ON "vat_rates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "families_vendor_id_idx" ON "families" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "families_code_idx" ON "families" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "families_is_active_idx" ON "families" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subfamilies_vendor_id_idx" ON "subfamilies" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subfamilies_family_id_idx" ON "subfamilies" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subfamilies_code_idx" ON "subfamilies" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subfamilies_is_active_idx" ON "subfamilies" USING btree ("is_active");--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_code_mappings_unit_id_units_id_fk') THEN
        ALTER TABLE "erp_code_mappings" ADD CONSTRAINT "erp_code_mappings_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_code_mappings_vat_rate_id_vat_rates_id_fk') THEN
        ALTER TABLE "erp_code_mappings" ADD CONSTRAINT "erp_code_mappings_vat_rate_id_vat_rates_id_fk" FOREIGN KEY ("vat_rate_id") REFERENCES "public"."vat_rates"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_code_mappings_family_id_families_id_fk') THEN
        ALTER TABLE "erp_code_mappings" ADD CONSTRAINT "erp_code_mappings_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_code_mappings_subfamily_id_subfamilies_id_fk') THEN
        ALTER TABLE "erp_code_mappings" ADD CONSTRAINT "erp_code_mappings_subfamily_id_subfamilies_id_fk" FOREIGN KEY ("subfamily_id") REFERENCES "public"."subfamilies"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_unit_id_units_id_fk') THEN
        ALTER TABLE "items" ADD CONSTRAINT "items_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_vat_rate_id_vat_rates_id_fk') THEN
        ALTER TABLE "items" ADD CONSTRAINT "items_vat_rate_id_vat_rates_id_fk" FOREIGN KEY ("vat_rate_id") REFERENCES "public"."vat_rates"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_family_id_families_id_fk') THEN
        ALTER TABLE "items" ADD CONSTRAINT "items_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_subfamily_id_subfamilies_id_fk') THEN
        ALTER TABLE "items" ADD CONSTRAINT "items_subfamily_id_subfamilies_id_fk" FOREIGN KEY ("subfamily_id") REFERENCES "public"."subfamilies"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "erp_code_mappings_unit_id_idx" ON "erp_code_mappings" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "erp_code_mappings_vat_rate_id_idx" ON "erp_code_mappings" USING btree ("vat_rate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "erp_code_mappings_family_id_idx" ON "erp_code_mappings" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "erp_code_mappings_subfamily_id_idx" ON "erp_code_mappings" USING btree ("subfamily_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_unit_id_idx" ON "items" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_vat_rate_id_idx" ON "items" USING btree ("vat_rate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_family_id_idx" ON "items" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_subfamily_id_idx" ON "items" USING btree ("subfamily_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_is_obsolete_idx" ON "items" USING btree ("is_obsolete");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_erp_updated_at_idx" ON "items" USING btree ("erp_updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_erp_updated_at_idx" ON "stock" USING btree ("erp_updated_at");