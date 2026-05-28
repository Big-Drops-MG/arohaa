ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "firstName" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastName" text;--> statement-breakpoint
UPDATE "user"
SET
  "firstName" = NULLIF(split_part(trim("name"), ' ', 1), ''),
  "lastName" = NULLIF(
    trim(regexp_replace(trim(coalesce("name", '')), '^[^[:space:]]+[[:space:]]*', '')),
    ''
  )
WHERE "name" IS NOT NULL AND btrim("name") <> '';
