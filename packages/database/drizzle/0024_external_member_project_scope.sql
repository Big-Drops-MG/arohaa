CREATE TABLE IF NOT EXISTS "external_member_project_scope" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "landingPagePublicId" text NOT NULL,
  "utmSource" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "external_member_project_scope_uidx"
  ON "external_member_project_scope" ("userId", "landingPagePublicId");
