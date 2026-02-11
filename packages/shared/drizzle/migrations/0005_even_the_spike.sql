/*
    Migration: Add role to user table and fix rate_limit primary key
    - Adds role column to user table for admin plugin and RBAC
    - Changes rate_limit primary key from 'key' to 'id'
    - Keeps 'key' as unique constraint for lookups
*/

-- Drop old primary key constraint on rate_limit.key
ALTER TABLE "rate_limit" DROP CONSTRAINT "rate_limit_pkey";--> statement-breakpoint

-- Add role column to user table
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'member';--> statement-breakpoint

-- Add id column (nullable first)
ALTER TABLE "rate_limit" ADD COLUMN "id" text;--> statement-breakpoint

-- Generate UUIDs for existing rows using key as the ID for consistency
UPDATE "rate_limit" SET "id" = "key" WHERE "id" IS NULL;--> statement-breakpoint

-- Now make it NOT NULL and set as primary key
ALTER TABLE "rate_limit" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit" ADD PRIMARY KEY ("id");--> statement-breakpoint

-- Create index on role for faster role-based queries
CREATE INDEX "auth_users_role_idx" ON "user" USING btree ("role");--> statement-breakpoint

-- Add unique constraint on key for lookups
ALTER TABLE "rate_limit" ADD CONSTRAINT "rate_limit_key_unique" UNIQUE("key");