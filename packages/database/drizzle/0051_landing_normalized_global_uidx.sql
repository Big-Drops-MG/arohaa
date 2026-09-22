WITH ranked AS (
  SELECT
    id,
    "normalizedUrl",
    ROW_NUMBER() OVER (
      PARTITION BY "normalizedUrl"
      ORDER BY
        CASE
          WHEN "workspaceId" IN (
            SELECT id FROM workspace WHERE name = 'Company' AND "deletedAt" IS NULL
          ) THEN 0
          ELSE 1
        END,
        CASE WHEN status = 'verified' THEN 0 ELSE 1 END,
        COALESCE("lastEventAt", TIMESTAMP '1970-01-01') DESC,
        "createdAt" DESC,
        id ASC
    ) AS rn
  FROM landing_page
  WHERE "deletedAt" IS NULL
)
UPDATE landing_page lp
SET
  "deletedAt" = now(),
  status = 'archived',
  "updatedAt" = now()
FROM ranked r
WHERE lp.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS "landing_workspace_normalized_active_uidx";

CREATE UNIQUE INDEX IF NOT EXISTS "landing_normalized_active_uidx"
  ON "landing_page" ("normalizedUrl")
  WHERE "deletedAt" IS NULL;
