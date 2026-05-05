CREATE TABLE IF NOT EXISTS "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerUserId" text NOT NULL,
	"name" text DEFAULT 'Personal' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "workspace_ownerUserId_user_id_fk" FOREIGN KEY ("ownerUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_owner_user_uidx"
ON "workspace" ("ownerUserId") WHERE "deletedAt" IS NULL;
--> statement-breakpoint
INSERT INTO "workspace" ("id", "ownerUserId", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u.id, 'Personal', now(), now()
FROM "user" AS u
WHERE NOT EXISTS (
	SELECT 1 FROM "workspace" AS w WHERE w."ownerUserId" = u.id AND w."deletedAt" IS NULL
);
--> statement-breakpoint
ALTER TABLE "landing_page" ADD COLUMN IF NOT EXISTS "workspaceId" text;
--> statement-breakpoint
UPDATE "landing_page" AS lp
SET "workspaceId" = w.id
FROM "workspace" AS w
WHERE lp."workspaceId" IS NULL
	AND w."ownerUserId" = lp."createdByUserId"
	AND w."deletedAt" IS NULL;
--> statement-breakpoint
ALTER TABLE "landing_page" ALTER COLUMN "workspaceId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "landing_page" DROP CONSTRAINT IF EXISTS "landing_page_workspaceId_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "landing_page"
	ADD CONSTRAINT "landing_page_workspaceId_workspace_id_fk"
	FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP INDEX IF EXISTS "landing_page_owner_normalized_active_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "landing_workspace_normalized_active_uidx"
	ON "landing_page" ("workspaceId", "normalizedUrl") WHERE "deletedAt" IS NULL;
--> statement-breakpoint
ALTER TABLE "landing_page" ADD COLUMN IF NOT EXISTS "htmlVerificationToken" text;
--> statement-breakpoint
UPDATE "landing_page"
SET "htmlVerificationToken" =
	REPLACE(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
WHERE "htmlVerificationToken" IS NULL;
