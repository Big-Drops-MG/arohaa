CREATE TABLE IF NOT EXISTS "used_delegation_nonce" (
  "nonce" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "expiresAt" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "used_delegation_nonce_expires_at_idx"
  ON "used_delegation_nonce" ("expiresAt");
