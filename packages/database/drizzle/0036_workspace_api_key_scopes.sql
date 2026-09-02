ALTER TABLE workspace_api_key
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY['analytics.read']::text[];
