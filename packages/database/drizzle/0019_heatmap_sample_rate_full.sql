-- Capture 100% of heatmap sessions by default (was 0.25).
ALTER TABLE "workspace"
  ALTER COLUMN "heatmapSampleRate" SET DEFAULT 1;

UPDATE "workspace"
SET "heatmapSampleRate" = 1
WHERE "heatmapSampleRate" IS DISTINCT FROM 1
  AND "deletedAt" IS NULL;
