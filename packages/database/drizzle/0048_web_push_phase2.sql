CREATE TABLE IF NOT EXISTS web_push_site_config (
  id TEXT PRIMARY KEY,
  "landingPageId" TEXT NOT NULL REFERENCES landing_page(id) ON DELETE CASCADE,
  "webhookSecretEncrypted" TEXT NOT NULL,
  "webhookSecretPrefix" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "rotatedAt" TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS web_push_site_config_landing_uidx
  ON web_push_site_config ("landingPageId");

ALTER TABLE web_push_delivery
  ADD COLUMN IF NOT EXISTS "dripStepIndex" INTEGER,
  ADD COLUMN IF NOT EXISTS "sequenceId" TEXT,
  ADD COLUMN IF NOT EXISTS "creativeOverride" JSONB;

CREATE INDEX IF NOT EXISTS web_push_delivery_sequence_idx
  ON web_push_delivery ("sequenceId");
