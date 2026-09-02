import "server-only"

import { eq } from "drizzle-orm"
import { db, users } from "@workspace/database"
import {
  decryptField,
  encryptField,
  isEncryptedField,
} from "@/lib/server/field-encryption"

type TotpField = "twoFactorSecret" | "pendingTwoFactorSecret"

export function decryptTotpSecret(
  stored: string | null | undefined
): string | null {
  return decryptField(stored)
}

export async function persistEncryptedTotpField(
  userId: string,
  field: TotpField,
  plaintext: string | null
): Promise<void> {
  const encrypted = plaintext ? encryptField(plaintext) : null
  await db
    .update(users)
    .set({ [field]: encrypted })
    .where(eq(users.id, userId))
}

export async function migrateTotpFieldIfPlaintext(
  userId: string,
  field: TotpField,
  stored: string | null | undefined
): Promise<string | null> {
  if (!stored) return null
  if (isEncryptedField(stored)) return decryptField(stored)

  const encrypted = encryptField(stored)
  await db
    .update(users)
    .set({ [field]: encrypted })
    .where(eq(users.id, userId))
  return stored
}

export async function readTotpSecretFromRow(
  userId: string,
  row: {
    twoFactorSecret: string | null
    pendingTwoFactorSecret: string | null
  },
  field: TotpField
): Promise<string | null> {
  const stored =
    field === "twoFactorSecret"
      ? row.twoFactorSecret
      : row.pendingTwoFactorSecret
  return migrateTotpFieldIfPlaintext(userId, field, stored)
}
