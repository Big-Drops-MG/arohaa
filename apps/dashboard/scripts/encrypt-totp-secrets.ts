import { config } from "dotenv"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { eq, isNotNull, or } from "drizzle-orm"
import { db, users } from "@workspace/database"
import { encryptField, isEncryptedField } from "@/lib/server/field-encryption"

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
)

for (const envFile of [
  path.resolve(root, ".env"),
  path.resolve(root, "apps/dashboard/.env"),
  path.resolve(root, "apps/dashboard/.env.local"),
]) {
  config({ path: envFile })
}

async function main() {
  if (!process.env.TOTP_ENCRYPTION_KEY?.trim()) {
    console.error("TOTP_ENCRYPTION_KEY is required.")
    process.exit(1)
  }

  const rows = await db
    .select({
      id: users.id,
      twoFactorSecret: users.twoFactorSecret,
      pendingTwoFactorSecret: users.pendingTwoFactorSecret,
    })
    .from(users)
    .where(
      or(
        isNotNull(users.twoFactorSecret),
        isNotNull(users.pendingTwoFactorSecret)
      )
    )

  let migrated = 0
  for (const row of rows) {
    const updates: {
      twoFactorSecret?: string
      pendingTwoFactorSecret?: string | null
    } = {}

    if (row.twoFactorSecret && !isEncryptedField(row.twoFactorSecret)) {
      updates.twoFactorSecret = encryptField(row.twoFactorSecret)
    }
    if (
      row.pendingTwoFactorSecret &&
      !isEncryptedField(row.pendingTwoFactorSecret)
    ) {
      updates.pendingTwoFactorSecret = encryptField(row.pendingTwoFactorSecret)
    }

    if (Object.keys(updates).length === 0) continue

    await db.update(users).set(updates).where(eq(users.id, row.id))
    migrated += 1
  }

  console.log(`Encrypted TOTP secrets for ${migrated} user(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
