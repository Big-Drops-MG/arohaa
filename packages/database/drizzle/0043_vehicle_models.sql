CREATE TABLE IF NOT EXISTS "vehicle_model" (
  "id" text PRIMARY KEY NOT NULL,
  "year" integer NOT NULL,
  "makeCode" text NOT NULL,
  "makeName" text NOT NULL,
  "modelCode" text NOT NULL,
  "modelName" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_model_year_make_model_uidx"
  ON "vehicle_model" ("year", "makeCode", "modelCode");

CREATE INDEX IF NOT EXISTS "vehicle_model_year_make_idx"
  ON "vehicle_model" ("year", "makeCode");
