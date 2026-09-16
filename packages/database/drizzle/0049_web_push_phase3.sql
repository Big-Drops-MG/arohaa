ALTER TABLE web_push_delivery
  ADD COLUMN IF NOT EXISTS "targetUrl" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS web_push_delivery_click_id_uidx
  ON web_push_delivery ("clickId")
  WHERE "clickId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS web_push_media_asset (
  id TEXT PRIMARY KEY,
  "landingPageId" TEXT NOT NULL REFERENCES landing_page(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "storageKey" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS web_push_media_asset_landing_idx
  ON web_push_media_asset ("landingPageId", "createdAt");
