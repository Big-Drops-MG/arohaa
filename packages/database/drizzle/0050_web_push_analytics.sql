ALTER TABLE web_push_delivery
  ADD COLUMN IF NOT EXISTS "displayedAt" TIMESTAMP;

ALTER TABLE web_push_delivery
  ADD COLUMN IF NOT EXISTS "dismissedAt" TIMESTAMP;

CREATE INDEX IF NOT EXISTS web_push_delivery_landing_sent_idx
  ON web_push_delivery ("landingPageId", "sentAt");

CREATE INDEX IF NOT EXISTS web_push_delivery_landing_status_sent_idx
  ON web_push_delivery ("landingPageId", status, "sentAt");

CREATE TABLE IF NOT EXISTS web_push_client_event (
  id TEXT PRIMARY KEY,
  "landingPageId" TEXT NOT NULL REFERENCES landing_page(id) ON DELETE CASCADE,
  "subscriptionId" TEXT REFERENCES web_push_subscription(id) ON DELETE SET NULL,
  "deliveryId" TEXT REFERENCES web_push_delivery(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  meta JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS web_push_client_event_landing_idx
  ON web_push_client_event ("landingPageId", "createdAt");

CREATE INDEX IF NOT EXISTS web_push_client_event_type_idx
  ON web_push_client_event (type, "createdAt");
