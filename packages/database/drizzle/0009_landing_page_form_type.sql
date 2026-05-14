ALTER TABLE "landing_page" ADD COLUMN IF NOT EXISTS "formType" text NOT NULL DEFAULT 'single';
