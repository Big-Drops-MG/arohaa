CREATE TABLE IF NOT EXISTS "user_activity_log" (
  "id" text PRIMARY KEY NOT NULL,
  "actorUserId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "eventType" text NOT NULL,
  "summary" text NOT NULL,
  "path" text,
  "tab" text,
  "projectPublicId" text,
  "targetLabel" text,
  "targetHref" text,
  "ipAddress" text,
  "userAgent" text,
  "metadata" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_activity_log_actor_created_idx"
  ON "user_activity_log" ("actorUserId", "createdAt" DESC);
