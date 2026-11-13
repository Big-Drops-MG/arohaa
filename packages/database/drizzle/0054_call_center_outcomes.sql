CREATE TABLE IF NOT EXISTS "call_center_upload" (
  "id" text PRIMARY KEY NOT NULL,
  "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE cascade,
  "landingPageId" text NOT NULL REFERENCES "landing_page"("id") ON DELETE cascade,
  "fileName" text NOT NULL,
  "rowCount" integer DEFAULT 0 NOT NULL,
  "contactedCount" integer DEFAULT 0 NOT NULL,
  "transferredCount" integer DEFAULT 0 NOT NULL,
  "duplicateCount" integer DEFAULT 0 NOT NULL,
  "uploadedByUserId" text REFERENCES "user"("id") ON DELETE set null,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "call_center_upload_landing_page_idx"
  ON "call_center_upload" ("landingPageId");
CREATE INDEX IF NOT EXISTS "call_center_upload_created_at_idx"
  ON "call_center_upload" ("createdAt");

CREATE TABLE IF NOT EXISTS "call_center_lead_outcome" (
  "id" text PRIMARY KEY NOT NULL,
  "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE cascade,
  "landingPageId" text NOT NULL REFERENCES "landing_page"("id") ON DELETE cascade,
  "uploadId" text NOT NULL REFERENCES "call_center_upload"("id") ON DELETE cascade,
  "externalLeadId" text NOT NULL,
  "sid" text DEFAULT '' NOT NULL,
  "tid" text DEFAULT '' NOT NULL,
  "uid" text DEFAULT '' NOT NULL,
  "sub1" text DEFAULT '' NOT NULL,
  "leadType" text DEFAULT '' NOT NULL,
  "state" text DEFAULT '' NOT NULL,
  "homeowner" boolean,
  "insured" boolean,
  "vehicles" text DEFAULT '' NOT NULL,
  "status" text DEFAULT '' NOT NULL,
  "duplicate" boolean DEFAULT false NOT NULL,
  "ccContacted" boolean DEFAULT false NOT NULL,
  "ccDisposition" text DEFAULT '' NOT NULL,
  "ccTransferred" boolean DEFAULT false NOT NULL,
  "duration15m" boolean DEFAULT false NOT NULL,
  "duration20m" boolean DEFAULT false NOT NULL,
  "occurredAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "call_center_lead_outcome_landing_external_uidx"
  ON "call_center_lead_outcome" ("landingPageId", "externalLeadId");
CREATE INDEX IF NOT EXISTS "call_center_lead_outcome_landing_sid_idx"
  ON "call_center_lead_outcome" ("landingPageId", "sid");
CREATE INDEX IF NOT EXISTS "call_center_lead_outcome_landing_tid_idx"
  ON "call_center_lead_outcome" ("landingPageId", "tid");
CREATE INDEX IF NOT EXISTS "call_center_lead_outcome_landing_occurred_idx"
  ON "call_center_lead_outcome" ("landingPageId", "occurredAt");

CREATE TABLE IF NOT EXISTS "call_center_source_rollup" (
  "id" text PRIMARY KEY NOT NULL,
  "landingPageId" text NOT NULL REFERENCES "landing_page"("id") ON DELETE cascade,
  "sid" text NOT NULL,
  "leads" integer DEFAULT 0 NOT NULL,
  "contacted" integer DEFAULT 0 NOT NULL,
  "transferred" integer DEFAULT 0 NOT NULL,
  "duration15m" integer DEFAULT 0 NOT NULL,
  "duration20m" integer DEFAULT 0 NOT NULL,
  "duplicates" integer DEFAULT 0 NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "call_center_source_rollup_landing_sid_uidx"
  ON "call_center_source_rollup" ("landingPageId", "sid");
