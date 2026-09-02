DELETE FROM experiment e
WHERE e.id NOT IN (
  SELECT DISTINCT ON ("landingPageId") id
  FROM experiment
  ORDER BY "landingPageId", "createdAt" ASC, id ASC
);

CREATE UNIQUE INDEX IF NOT EXISTS experiment_landing_page_id_uidx
  ON experiment ("landingPageId");

-- #27: variant labels unique within an experiment
CREATE TABLE IF NOT EXISTS experiment_variant_label (
  id text PRIMARY KEY,
  "experimentId" text NOT NULL REFERENCES experiment (id) ON DELETE CASCADE,
  label text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS experiment_variant_label_experiment_label_uidx
  ON experiment_variant_label ("experimentId", label);

INSERT INTO experiment_variant_label (id, "experimentId", label)
SELECT
  gen_random_uuid()::text,
  e.id,
  elem->>'label'
FROM experiment e
CROSS JOIN LATERAL jsonb_array_elements(e.variants) AS elem
WHERE coalesce(elem->>'label', '') <> ''
ON CONFLICT DO NOTHING;
