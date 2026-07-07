ALTER TABLE workspace_alert_webhook
  ADD COLUMN IF NOT EXISTS "lastTestedAt" timestamp,
  ADD COLUMN IF NOT EXISTS "lastTestStatus" text,
  ADD COLUMN IF NOT EXISTS "lastTestError" text;
