CREATE TABLE "external_member_invite_token" (
  "userId" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expires" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "external_member_invite_token_expires_idx"
  ON "external_member_invite_token" ("expires");

CREATE TABLE "used_external_invite_token" (
  "tokenHash" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "used_external_invite_token_user_idx"
  ON "used_external_invite_token" ("userId");
