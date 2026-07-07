DO $$ BEGIN
  CREATE TYPE landing_page_utm_param_status AS ENUM ('active', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS landing_page_utm_param (
  id TEXT PRIMARY KEY,
  "landingPageId" TEXT NOT NULL REFERENCES landing_page(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  status landing_page_utm_param_status NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS landing_page_utm_param_page_key_value_uidx
  ON landing_page_utm_param ("landingPageId", key, value);

CREATE INDEX IF NOT EXISTS landing_page_utm_param_page_idx
  ON landing_page_utm_param ("landingPageId");
