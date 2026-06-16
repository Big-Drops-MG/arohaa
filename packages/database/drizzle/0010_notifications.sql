CREATE TABLE IF NOT EXISTS "notification" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "severity" text NOT NULL DEFAULT 'alert',
  "landingPageId" text REFERENCES "landing_page"("id") ON DELETE CASCADE,
  "landingPagePublicId" text,
  "href" text,
  "sourceType" text,
  "sourceId" text,
  "readAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_user_source_uidx"
  ON "notification" ("userId", "sourceType", "sourceId")
  WHERE "sourceType" IS NOT NULL AND "sourceId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "notification_user_read_created_idx"
  ON "notification" ("userId", "readAt", "createdAt" DESC);
