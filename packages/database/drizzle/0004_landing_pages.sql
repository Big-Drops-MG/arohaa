CREATE TABLE "landing_page" (
	"id" text PRIMARY KEY NOT NULL,
	"publicId" text NOT NULL,
	"workspaceId" text,
	"createdByUserId" text NOT NULL,
	"updatedByUserId" text,
	"brandName" text NOT NULL,
	"landingPageUrl" text NOT NULL,
	"normalizedUrl" text NOT NULL,
	"origin" text NOT NULL,
	"hostname" text NOT NULL,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"sdkInstallStatus" text DEFAULT 'waiting' NOT NULL,
	"verificationMethod" text,
	"verifiedAt" timestamp,
	"lastSeenAt" timestamp,
	"lastEventAt" timestamp,
	"notes" text,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "landing_page_publicId_unique" UNIQUE("publicId"),
	CONSTRAINT "landing_page_createdByUserId_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "landing_page_updatedByUserId_user_id_fk" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "landing_page_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actorUserId" text NOT NULL,
	"landingPageId" text NOT NULL,
	"action" text NOT NULL,
	"beforePayload" jsonb,
	"afterPayload" jsonb,
	"traceId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "landing_page_audit_log_actorUserId_user_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "landing_page_audit_log_landingPageId_landing_page_id_fk" FOREIGN KEY ("landingPageId") REFERENCES "public"."landing_page"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "landing_page_createdByUserId_idx" ON "landing_page" ("createdByUserId");--> statement-breakpoint
CREATE INDEX "landing_page_hostname_idx" ON "landing_page" ("hostname");--> statement-breakpoint
CREATE INDEX "landing_page_status_idx" ON "landing_page" ("status");--> statement-breakpoint
CREATE INDEX "landing_page_lastSeenAt_idx" ON "landing_page" ("lastSeenAt");--> statement-breakpoint
CREATE INDEX "landing_page_audit_log_landing_idx" ON "landing_page_audit_log" ("landingPageId");--> statement-breakpoint
CREATE UNIQUE INDEX "landing_page_owner_normalized_active_uidx" ON "landing_page" ("createdByUserId", "normalizedUrl") WHERE "deletedAt" IS NULL;
