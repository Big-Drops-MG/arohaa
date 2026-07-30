ALTER TABLE segment
  ADD COLUMN IF NOT EXISTS "landingPageId" TEXT;

DELETE FROM segment WHERE "landingPageId" IS NULL;

ALTER TABLE segment
  ALTER COLUMN "landingPageId" SET NOT NULL;

ALTER TABLE segment
  DROP CONSTRAINT IF EXISTS segment_landingPageId_fkey;

ALTER TABLE segment
  ADD CONSTRAINT segment_landingPageId_fkey
  FOREIGN KEY ("landingPageId") REFERENCES landing_page(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS segment_landing_page_id_idx
  ON segment ("landingPageId");
