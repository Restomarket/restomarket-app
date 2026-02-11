/*
    Migration: Add role to user table and fix rate_limit primary key
    - Adds role column to user table for admin plugin and RBAC
    - Changes rate_limit primary key from 'key' to 'id'
    - Keeps 'key' as unique constraint for lookups
*/

-- Drop old primary key constraint on rate_limit.key (if it exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'rate_limit_pkey'
        AND contype = 'p'
    ) THEN
        ALTER TABLE "rate_limit" DROP CONSTRAINT "rate_limit_pkey";
    END IF;
END $$;--> statement-breakpoint

-- Add role column to user table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user' AND column_name = 'role'
    ) THEN
        ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'member';
    END IF;
END $$;--> statement-breakpoint

-- Add id column to rate_limit (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'rate_limit' AND column_name = 'id'
    ) THEN
        ALTER TABLE "rate_limit" ADD COLUMN "id" text;
        -- Generate IDs for existing rows using key as the ID for consistency
        UPDATE "rate_limit" SET "id" = "key" WHERE "id" IS NULL;
        -- Make it NOT NULL
        ALTER TABLE "rate_limit" ALTER COLUMN "id" SET NOT NULL;
    END IF;
END $$;--> statement-breakpoint

-- Add primary key on id (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'rate_limit_pkey'
        AND conrelid = 'rate_limit'::regclass
    ) THEN
        ALTER TABLE "rate_limit" ADD PRIMARY KEY ("id");
    END IF;
END $$;--> statement-breakpoint

-- Create index on role for faster role-based queries
CREATE INDEX IF NOT EXISTS "auth_users_role_idx" ON "user" USING btree ("role");--> statement-breakpoint

-- Add unique constraint on key for lookups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'rate_limit_key_unique'
    ) THEN
        ALTER TABLE "rate_limit" ADD CONSTRAINT "rate_limit_key_unique" UNIQUE("key");
    END IF;
END $$;