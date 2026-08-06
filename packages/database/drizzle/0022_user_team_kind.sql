ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "teamKind" text NOT NULL DEFAULT 'internal';
