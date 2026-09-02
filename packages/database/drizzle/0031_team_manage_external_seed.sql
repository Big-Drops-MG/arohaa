INSERT INTO "role_permissions" ("roleId", "permission")
SELECT id, 'team.manage_external'::permission
FROM "roles" WHERE "key" = 'ceo'
ON CONFLICT DO NOTHING;
