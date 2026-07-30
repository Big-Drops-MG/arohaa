CREATE TABLE IF NOT EXISTS segment (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS segment_workspace_id_idx
  ON segment ("workspaceId");
