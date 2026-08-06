DROP INDEX IF EXISTS "external_member_project_scope_uidx";

CREATE UNIQUE INDEX IF NOT EXISTS "external_member_project_scope_uidx"
  ON "external_member_project_scope" ("userId", "landingPagePublicId", "utmSource");
