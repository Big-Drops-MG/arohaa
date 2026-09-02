ALTER TABLE "landing_page" ADD COLUMN "slug" text;

WITH normalized AS (
  SELECT
    "id",
    CASE
      WHEN trim(both '-' FROM regexp_replace(lower("brandName"), '[^a-z0-9]+', '-', 'g')) = ''
        THEN 'landing-' || lower(regexp_replace("publicId", '[^a-zA-Z0-9]+', '', 'g'))
      ELSE left(
        trim(both '-' FROM regexp_replace(lower("brandName"), '[^a-z0-9]+', '-', 'g')),
        80
      )
    END AS base_slug
  FROM "landing_page"
),
reserved AS (
  SELECT
    "id",
    CASE
      WHEN base_slug IN ('new-landing', 'ops', 'profile', 'team')
        THEN left(base_slug, 72) || '-landing'
      ELSE base_slug
    END AS base_slug
  FROM normalized
),
ranked AS (
  SELECT
    "id",
    base_slug,
    row_number() OVER (PARTITION BY base_slug ORDER BY "id") AS slug_number
  FROM reserved
),
candidates AS (
  SELECT
    "id",
    CASE
      WHEN slug_number = 1 THEN base_slug
      ELSE left(base_slug, 80 - length(slug_number::text) - 1)
        || '-' || slug_number::text
    END AS candidate
  FROM ranked
),
deduplicated AS (
  SELECT
    "id",
    candidate,
    row_number() OVER (PARTITION BY candidate ORDER BY "id") AS collision_number
  FROM candidates
)
UPDATE "landing_page" AS landing
SET "slug" = CASE
  WHEN deduplicated.collision_number = 1 THEN deduplicated.candidate
  ELSE left(deduplicated.candidate, 71) || '-' || left(md5(landing."id"), 8)
END
FROM deduplicated
WHERE landing."id" = deduplicated."id";

ALTER TABLE "landing_page" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "landing_page_slug_uidx" ON "landing_page" ("slug");
