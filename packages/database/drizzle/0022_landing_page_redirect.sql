ALTER TABLE "landing_page" ADD COLUMN IF NOT EXISTS "redirectPageUrl" text;
ALTER TABLE "landing_page" ADD COLUMN IF NOT EXISTS "redirectHostname" text;
ALTER TABLE "landing_page" ADD COLUMN IF NOT EXISTS "redirectOrigin" text;
