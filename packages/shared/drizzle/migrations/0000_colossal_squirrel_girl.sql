CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_length_check" CHECK (length("users"."email") >= 3),
	CONSTRAINT "users_email_normalized_check" CHECK ("users"."email" = lower("users"."email")),
	CONSTRAINT "users_first_name_length_check" CHECK (length("users"."first_name") >= 1),
	CONSTRAINT "users_last_name_length_check" CHECK (length("users"."last_name") >= 1)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_active_query_idx" ON "users" USING btree ("deleted_at","is_active","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_name_idx" ON "users" USING btree ("first_name","last_name");