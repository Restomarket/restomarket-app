-- Migration: Merge users table functionality into authUsers (user table)
-- Description: Add business logic fields (isActive, deletedAt) to the user table
-- Date: 2026-02-06

-- Add isActive column for business logic
ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;

-- Add deletedAt column for soft delete functionality
ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;

-- Create index for active users query (used by business logic)
CREATE INDEX IF NOT EXISTS "auth_users_active_idx"
ON "user" ("is_active", "deleted_at");

-- Add comment to document the merge
COMMENT ON TABLE "user" IS 'Unified user table containing both Better Auth fields and business logic fields. Previously had separate users table that has been deprecated.';
COMMENT ON COLUMN "user"."is_active" IS 'Business logic field: Whether the user account is active. Merged from deprecated users table.';
COMMENT ON COLUMN "user"."deleted_at" IS 'Business logic field: Soft delete timestamp. Merged from deprecated users table.';
