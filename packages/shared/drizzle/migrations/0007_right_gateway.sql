DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user' AND column_name = 'ban_expires'
    AND data_type IN ('integer', 'bigint')
  ) THEN
    ALTER TABLE "user" ALTER COLUMN "ban_expires"
    SET DATA TYPE timestamp with time zone
    USING CASE WHEN ban_expires IS NOT NULL THEN to_timestamp(ban_expires) ELSE NULL END;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "impersonated_by" text;