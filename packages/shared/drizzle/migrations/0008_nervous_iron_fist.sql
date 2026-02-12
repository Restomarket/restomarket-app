CREATE TABLE "sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"postgres_order_id" uuid,
	"vendor_id" varchar(100) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 5 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"error_message" text,
	"error_stack" text,
	"erp_reference" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar(100) NOT NULL,
	"agent_url" varchar(500) NOT NULL,
	"erp_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'offline' NOT NULL,
	"last_heartbeat" timestamp with time zone,
	"version" varchar(50),
	"auth_token_hash" varchar(256) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_registry_vendor_id_unique" UNIQUE("vendor_id")
);
--> statement-breakpoint
CREATE TABLE "erp_code_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar(100) NOT NULL,
	"mapping_type" varchar(20) NOT NULL,
	"erp_code" varchar(100) NOT NULL,
	"resto_code" varchar(100) NOT NULL,
	"resto_label" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "erp_code_mappings_vendor_type_erp_unique" UNIQUE("vendor_id","mapping_type","erp_code")
);
--> statement-breakpoint
CREATE TABLE "dead_letter_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_job_id" uuid,
	"vendor_id" varchar(100) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"failure_reason" text NOT NULL,
	"failure_stack" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar(100) NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"summary" jsonb NOT NULL,
	"details" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sync_jobs_vendor_status_idx" ON "sync_jobs" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sync_jobs_next_retry_idx" ON "sync_jobs" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "sync_jobs_expires_idx" ON "sync_jobs" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sync_jobs_postgres_order_id_idx" ON "sync_jobs" USING btree ("postgres_order_id");--> statement-breakpoint
CREATE INDEX "agent_registry_status_idx" ON "agent_registry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_registry_heartbeat_idx" ON "agent_registry" USING btree ("last_heartbeat");--> statement-breakpoint
CREATE INDEX "agent_registry_vendor_id_idx" ON "agent_registry" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "erp_code_mappings_vendor_type_idx" ON "erp_code_mappings" USING btree ("vendor_id","mapping_type");--> statement-breakpoint
CREATE INDEX "erp_code_mappings_active_idx" ON "erp_code_mappings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "dead_letter_queue_vendor_idx" ON "dead_letter_queue" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "dead_letter_queue_resolved_idx" ON "dead_letter_queue" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "dead_letter_queue_created_idx" ON "dead_letter_queue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dead_letter_queue_job_id_idx" ON "dead_letter_queue" USING btree ("original_job_id");--> statement-breakpoint
CREATE INDEX "reconciliation_events_vendor_timestamp_idx" ON "reconciliation_events" USING btree ("vendor_id","timestamp");--> statement-breakpoint
CREATE INDEX "reconciliation_events_type_idx" ON "reconciliation_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "reconciliation_events_timestamp_idx" ON "reconciliation_events" USING btree ("timestamp");