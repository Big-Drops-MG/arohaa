CREATE TYPE "permission" AS ENUM (
  'landing_pages.read',
  'landing_pages.write',
  'experiments.write',
  'data_export.read',
  'webhooks.write',
  'team.review_access',
  'team.assign_roles',
  'audit_logs.read',
  'manage_permissions'
);

CREATE TABLE "roles" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL UNIQUE,
  "label" text NOT NULL,
  "isSystem" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "role_permissions" (
  "roleId" text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permission" "permission" NOT NULL,
  PRIMARY KEY ("roleId", "permission")
);

ALTER TABLE "user" ADD COLUMN "roleId" text REFERENCES "roles"("id");

INSERT INTO "roles" ("id", "key", "label", "isSystem") VALUES
  (gen_random_uuid()::text, 'superadmin', 'Super Admin', true),
  (gen_random_uuid()::text, 'ceo',        'CEO',         true),
  (gen_random_uuid()::text, 'member',     'Member',      true);

INSERT INTO "role_permissions" ("roleId", "permission")
SELECT id, unnest(ARRAY[
  'landing_pages.read','landing_pages.write','experiments.write',
  'data_export.read','webhooks.write','team.review_access',
  'team.assign_roles','audit_logs.read'
]::permission[])
FROM "roles" WHERE "key" = 'ceo';

INSERT INTO "role_permissions" ("roleId", "permission")
SELECT id, unnest(ARRAY['landing_pages.read','landing_pages.write']::permission[])
FROM "roles" WHERE "key" = 'member';

DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(e, ', ')
  INTO missing
  FROM unnest(ARRAY[
    'yash@bigdropsmarketing.com',
    'sami@bigdropsmarketing.com'
  ]::text[]) AS e
  WHERE NOT EXISTS (
    SELECT 1 FROM "user" u WHERE lower(trim(u.email)) = lower(trim(e))
  );
  IF missing IS NOT NULL THEN
    RAISE WARNING 'Superadmin seed: no user row for: %', missing;
  END IF;
END $$;

UPDATE "user" SET "roleId" = (SELECT id FROM "roles" WHERE "key" = 'superadmin')
WHERE lower(trim(email)) IN (
  'yash@bigdropsmarketing.com',
  'sami@bigdropsmarketing.com'
);

UPDATE "user" SET "roleId" = (SELECT id FROM "roles" WHERE "key" = 'ceo')
WHERE "roleId" IS NULL
  AND lower(trim(email)) = 'ishan@bigdropsmarketing.com';

UPDATE "user" SET "roleId" = (SELECT id FROM "roles" WHERE "key" = 'ceo')
WHERE "roleId" IS NULL
  AND lower(trim(coalesce("role", ''))) = 'ceo';

UPDATE "user" SET "roleId" = (SELECT id FROM "roles" WHERE "key" = 'member')
WHERE "roleId" IS NULL;

ALTER TABLE "user" ALTER COLUMN "roleId" SET NOT NULL;

CREATE OR REPLACE FUNCTION assert_superadmin_remains() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM "user" u
      JOIN "roles" r ON r.id = u."roleId"
      WHERE r."key" = 'superadmin') = 0 THEN
    RAISE EXCEPTION 'At least one superadmin required';
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER user_superadmin_floor
AFTER UPDATE OR DELETE ON "user"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION assert_superadmin_remains();
