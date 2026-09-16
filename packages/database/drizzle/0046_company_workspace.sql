
DO $$
DECLARE
  company_owner_id text;
  company_ws_id text;
BEGIN
  SELECT u.id INTO company_owner_id
  FROM "user" u
  INNER JOIN roles r ON r.id = u."roleId"
  WHERE u."accessStatus" = 'approved'
    AND u."teamKind" = 'internal'
    AND r.key IN ('superadmin', 'ceo')
  ORDER BY CASE WHEN r.key = 'superadmin' THEN 0 ELSE 1 END, lower(u.email)
  LIMIT 1;

  IF company_owner_id IS NULL THEN
    RAISE NOTICE '0046_company_workspace: no superadmin/CEO — skipped';
    RETURN;
  END IF;

  SELECT w.id INTO company_ws_id
  FROM workspace w
  WHERE w."ownerUserId" = company_owner_id
    AND w."deletedAt" IS NULL
  LIMIT 1;

  IF company_ws_id IS NULL THEN
    INSERT INTO workspace (id, "ownerUserId", name, "heatmapSampleRate", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, company_owner_id, 'Company', 1, now(), now())
    RETURNING id INTO company_ws_id;
  ELSE
    UPDATE workspace
    SET name = 'Company', "updatedAt" = now()
    WHERE id = company_ws_id;
  END IF;

  UPDATE landing_page lp
  SET "workspaceId" = company_ws_id, "updatedAt" = now()
  WHERE lp."deletedAt" IS NULL
    AND lp."workspaceId" IS DISTINCT FROM company_ws_id
    AND NOT EXISTS (
      SELECT 1
      FROM landing_page other
      WHERE other."workspaceId" = company_ws_id
        AND other."normalizedUrl" = lp."normalizedUrl"
        AND other."deletedAt" IS NULL
    );

  UPDATE segment s
  SET "workspaceId" = company_ws_id, "updatedAt" = now()
  WHERE s."workspaceId" IS DISTINCT FROM company_ws_id;

  UPDATE workspace_api_key k
  SET "workspaceId" = company_ws_id
  WHERE k."workspaceId" IS DISTINCT FROM company_ws_id
    AND k."revokedAt" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM workspace_api_key other
      WHERE other."workspaceId" = company_ws_id
        AND other."keyHash" = k."keyHash"
        AND other."revokedAt" IS NULL
    );

  UPDATE workspace_alert_webhook wh
  SET "workspaceId" = company_ws_id
  WHERE wh."workspaceId" IS DISTINCT FROM company_ws_id
    AND NOT EXISTS (
      SELECT 1
      FROM workspace_alert_webhook other
      WHERE other."workspaceId" = company_ws_id
        AND other.url = wh.url
    );
END $$;
