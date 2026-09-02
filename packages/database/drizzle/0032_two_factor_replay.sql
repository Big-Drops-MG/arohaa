CREATE TABLE IF NOT EXISTS "used_totp" (
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "periodCounter" bigint NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("userId", "periodCounter")
);

CREATE TABLE IF NOT EXISTS "two_factor_session_stamp" (
  "userId" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "verifiedAt" timestamp NOT NULL,
  "expiresAt" timestamp NOT NULL
);
