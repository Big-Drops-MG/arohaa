ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "accessStatus" text NOT NULL DEFAULT 'pending';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "accessReviewedAt" timestamp;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "accessReviewedByUserId" text;

-- At migrate time every existing account keeps full access.
-- New signups after this migration default to pending.
UPDATE "user" SET "accessStatus" = 'approved';
