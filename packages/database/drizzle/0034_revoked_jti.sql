ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "sessionsInvalidBefore" timestamp;

CREATE TABLE IF NOT EXISTS "revoked_jti" (
  "jti" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "revokedAt" timestamp DEFAULT now() NOT NULL,
  "expiresAt" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "revoked_jti_expires_at_idx" ON "revoked_jti" ("expiresAt");
CREATE INDEX IF NOT EXISTS "revoked_jti_user_id_idx" ON "revoked_jti" ("userId");
