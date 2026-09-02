DELETE FROM "two_factor_session_stamp";

ALTER TABLE "two_factor_session_stamp" ADD COLUMN "sessionJti" text;

ALTER TABLE "two_factor_session_stamp" DROP CONSTRAINT "two_factor_session_stamp_pkey";

ALTER TABLE "two_factor_session_stamp"
  ADD PRIMARY KEY ("userId", "sessionJti");

CREATE INDEX IF NOT EXISTS "used_totp_created_at_idx" ON "used_totp" ("createdAt");
