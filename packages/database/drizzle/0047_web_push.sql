CREATE TABLE IF NOT EXISTS web_push_vapid_key (
  id TEXT PRIMARY KEY,
  "landingPageId" TEXT NOT NULL REFERENCES landing_page(id) ON DELETE CASCADE,
  "publicKey" TEXT NOT NULL,
  "privateKeyEncrypted" TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'mailto:ops@arohaa.net',
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "rotatedAt" TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS web_push_vapid_key_landing_uidx
  ON web_push_vapid_key ("landingPageId");

CREATE TABLE IF NOT EXISTS web_push_subscription (
  id TEXT PRIMARY KEY,
  "landingPageId" TEXT NOT NULL REFERENCES landing_page(id) ON DELETE CASCADE,
  "vapidKeyId" TEXT REFERENCES web_push_vapid_key(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  "endpointHash" TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  "expirationTime" TIMESTAMP,
  origin TEXT,
  "lastSeenUrl" TEXT,
  context JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "lastEventAt" TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS web_push_subscription_endpoint_uidx
  ON web_push_subscription (endpoint);

CREATE INDEX IF NOT EXISTS web_push_subscription_landing_status_idx
  ON web_push_subscription ("landingPageId", status);

CREATE INDEX IF NOT EXISTS web_push_subscription_endpoint_hash_idx
  ON web_push_subscription ("endpointHash");

CREATE TABLE IF NOT EXISTS web_push_campaign (
  id TEXT PRIMARY KEY,
  "landingPageId" TEXT NOT NULL REFERENCES landing_page(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  "iconUrl" TEXT,
  "badgeUrl" TEXT,
  "imageUrl" TEXT,
  tag TEXT,
  "requireInteraction" BOOLEAN NOT NULL DEFAULT false,
  click JSONB NOT NULL,
  trigger JSONB NOT NULL,
  limits JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS web_push_campaign_landing_status_idx
  ON web_push_campaign ("landingPageId", status);

CREATE TABLE IF NOT EXISTS web_push_delivery (
  id TEXT PRIMARY KEY,
  "campaignId" TEXT NOT NULL REFERENCES web_push_campaign(id) ON DELETE CASCADE,
  "subscriptionId" TEXT NOT NULL REFERENCES web_push_subscription(id) ON DELETE CASCADE,
  "landingPageId" TEXT NOT NULL REFERENCES landing_page(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  "scheduledFor" TIMESTAMP NOT NULL,
  "sentAt" TIMESTAMP,
  "clickedAt" TIMESTAMP,
  "failureCode" INTEGER,
  "failureReason" TEXT,
  "clickId" TEXT,
  "payloadSnapshot" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS web_push_delivery_status_scheduled_idx
  ON web_push_delivery (status, "scheduledFor")
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS web_push_delivery_campaign_sub_idx
  ON web_push_delivery ("campaignId", "subscriptionId", status);

CREATE INDEX IF NOT EXISTS web_push_delivery_landing_created_idx
  ON web_push_delivery ("landingPageId", "createdAt");
