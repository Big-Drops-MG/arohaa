CREATE TABLE IF NOT EXISTS workspace_api_key (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "revokedAt" TIMESTAMP,
  "lastUsedAt" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS workspace_api_key_workspace_active_idx
  ON workspace_api_key ("workspaceId")
  WHERE "revokedAt" IS NULL;
