INSERT INTO "role_permissions" ("roleId", "permission")
SELECT id, unnest(ARRAY['experiments.write', 'webhooks.write']::permission[])
FROM "roles"
WHERE "key" = 'member'
ON CONFLICT DO NOTHING;
