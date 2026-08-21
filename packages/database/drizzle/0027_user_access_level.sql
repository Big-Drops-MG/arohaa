ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "accessLevel" text NOT NULL DEFAULT 'full';
