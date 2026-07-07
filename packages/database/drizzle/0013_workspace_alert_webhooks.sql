CREATE TABLE IF NOT EXISTS workspace_alert_webhook (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'slack',
  enabled BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS workspace_alert_webhook_workspace_active_idx
  ON workspace_alert_webhook ("workspaceId")
  WHERE "deletedAt" IS NULL;
