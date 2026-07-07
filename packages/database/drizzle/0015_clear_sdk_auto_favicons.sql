UPDATE "landing_page"
SET "faviconUrl" = NULL
WHERE "deletedAt" IS NULL
  AND "faviconUrl" LIKE '%favicon.ico?favicon.%';
