CREATE TABLE IF NOT EXISTS "rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_rate_limits_key_idx" ON "rate_limit" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_rate_limits_last_request_idx" ON "rate_limit" USING btree ("last_request");