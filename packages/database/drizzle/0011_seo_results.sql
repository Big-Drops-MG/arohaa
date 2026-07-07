CREATE TABLE IF NOT EXISTS "seo_result" (
  "id" text PRIMARY KEY NOT NULL,
  "landingPageId" text NOT NULL REFERENCES "landing_page"("id") ON DELETE CASCADE,
  "query" text NOT NULL,
  "pageUrl" text NOT NULL,
  "clicks" integer DEFAULT 0 NOT NULL,
  "impressions" integer DEFAULT 0 NOT NULL,
  "ctr" double precision DEFAULT 0 NOT NULL,
  "position" double precision DEFAULT 0 NOT NULL,
  "reportDate" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "seo_result_lp_query_page_date_idx"
  ON "seo_result" ("landingPageId", "query", "pageUrl", "reportDate");

CREATE INDEX IF NOT EXISTS "seo_result_landing_page_idx"
  ON "seo_result" ("landingPageId");
