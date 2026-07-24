CREATE TABLE IF NOT EXISTS "role" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "role_name_uidx" ON "role" ("name");

INSERT INTO "role" ("id", "name")
VALUES
  (gen_random_uuid()::text, 'CEO'),
  (gen_random_uuid()::text, 'Web Developer'),
  (gen_random_uuid()::text, 'UI/UX Designer'),
  (gen_random_uuid()::text, 'Content Creater'),
  (gen_random_uuid()::text, 'Business Development Manager (BDM)'),
  (gen_random_uuid()::text, 'Graphics Designer')
ON CONFLICT ("name") DO NOTHING;

-- Preserve any roles already assigned to users.
INSERT INTO "role" ("id", "name")
SELECT gen_random_uuid()::text, trim(u."role")
FROM "user" u
WHERE u."role" IS NOT NULL
  AND trim(u."role") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "role" r WHERE r."name" = trim(u."role")
  );
