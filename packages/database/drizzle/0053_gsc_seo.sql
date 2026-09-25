CREATE TABLE IF NOT EXISTS "workspace_gsc_connection" (
  "id" text PRIMARY KEY NOT NULL,
  "workspaceId" text NOT NULL REFERENCES "workspace"("id") ON DELETE cascade,
  "refreshTokenEncrypted" text NOT NULL,
  "googleAccountEmail" text,
  "status" text NOT NULL DEFAULT 'active',
  "connectedAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_gsc_connection_workspace_uidx"
  ON "workspace_gsc_connection" ("workspaceId");

ALTER TABLE "landing_page"
  ADD COLUMN IF NOT EXISTS "gscSiteUrl" text,
  ADD COLUMN IF NOT EXISTS "gscLastSyncedAt" timestamp;
