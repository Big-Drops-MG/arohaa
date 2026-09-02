ALTER TYPE "permission" ADD VALUE IF NOT EXISTS 'api_keys.write';

INSERT INTO "role_permissions" ("roleId", "permission")
SELECT id, 'api_keys.write'::permission
FROM "roles"
WHERE "key" = 'ceo'
ON CONFLICT DO NOTHING;
