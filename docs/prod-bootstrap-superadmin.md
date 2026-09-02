# Production bootstrap — first superadmin

`SUPERADMIN_BOOTSTRAP_EMAILS` is a **no-op when `NODE_ENV === "production"`**.
Auto-approve on signup is also gone. A brand-new production database has **no
in-app path** to create the first superadmin.

Run this once against production Postgres after migrations (including role
seeds from `0029_role_permissions.sql`).

```sql
SELECT id, key, label FROM roles WHERE key = 'superadmin';

UPDATE "user"
SET
  "roleId" = (SELECT id FROM roles WHERE key = 'superadmin' LIMIT 1),
  "accessStatus" = 'approved',
  "accessReviewedAt" = now()
WHERE lower(trim(email)) = lower(trim('you@example.com'));

SELECT id, email, "roleId", "accessStatus"
FROM "user"
WHERE lower(trim(email)) = lower(trim('you@example.com'));
```

If the user row does not exist yet, create the account through normal signup
(they will land as `pending` / `member`), then run the `UPDATE` above.

Do **not** re-enable env-based bootstrap in production. Keep this runbook as
the only first-superadmin path.
