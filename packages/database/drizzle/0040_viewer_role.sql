INSERT INTO "roles" ("id", "key", "label", "isSystem")
VALUES (gen_random_uuid()::text, 'viewer', 'Viewer', true)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permission")
SELECT r.id, 'landing_pages.read'::permission
FROM "roles" r
WHERE r."key" = 'viewer'
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  read_only_count integer;
  migrated_count integer;
  viewer_role_id text;
BEGIN
  SELECT COUNT(*)::integer
  INTO read_only_count
  FROM "user"
  WHERE "accessLevel" = 'read_only';

  SELECT id INTO viewer_role_id FROM "roles" WHERE "key" = 'viewer';
  IF viewer_role_id IS NULL THEN
    RAISE EXCEPTION 'viewer role missing after seed';
  END IF;

  UPDATE "user"
  SET
    "roleId" = viewer_role_id,
    "accessLevel" = 'full'
  WHERE "accessLevel" = 'read_only';

  GET DIAGNOSTICS migrated_count = ROW_COUNT;

  IF migrated_count <> read_only_count THEN
    RAISE EXCEPTION
      'read_only migration count mismatch: expected %, migrated %',
      read_only_count,
      migrated_count;
  END IF;
END $$;
