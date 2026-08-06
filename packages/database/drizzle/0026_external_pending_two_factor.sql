-- Partners who were invited with 2FA pre-enabled but never signed in should
-- enroll via QR on first login (same secret moved to pending).
UPDATE "user"
SET
  "pendingTwoFactorSecret" = COALESCE("pendingTwoFactorSecret", "twoFactorSecret"),
  "twoFactorSecret" = NULL,
  "isTwoFactorEnabled" = false
WHERE "teamKind" = 'external'
  AND "isTwoFactorEnabled" = true
  AND "twoFactorSecret" IS NOT NULL
  AND "password" IS NOT NULL
  AND "lastSeenAt" IS NULL;
