ALTER TABLE "landing_page_audit_log"
  ADD COLUMN IF NOT EXISTS "ipAddress" text,
  ADD COLUMN IF NOT EXISTS "userAgent" text;
