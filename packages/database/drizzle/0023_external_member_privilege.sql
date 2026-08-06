CREATE TABLE IF NOT EXISTS "external_member_privilege" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "landingPagePublicId" text NOT NULL,
  "tab" text NOT NULL,
  "section" text NOT NULL DEFAULT '',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "external_member_privilege_uidx"
  ON "external_member_privilege" ("userId", "landingPagePublicId", "tab", "section");
