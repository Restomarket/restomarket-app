-- Migration: Add missing updatedAt columns to organization and member tables
-- Description: Better Auth's org plugin writes to updatedAt when org/member data changes
-- Date: 2026-02-06

-- Add updatedAt to organization table
ALTER TABLE "organization"
ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

-- Add updatedAt to member table
ALTER TABLE "member"
ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

-- Add comments
COMMENT ON COLUMN "organization"."updated_at" IS 'Last update timestamp. Updated by Better Auth when organization metadata changes.';
COMMENT ON COLUMN "member"."updated_at" IS 'Last update timestamp. Updated by Better Auth when member role changes.';
