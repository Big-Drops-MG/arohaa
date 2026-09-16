"use server"

import { createElement } from "react"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import {
  db,
  normalizeUserEmail,
  whereUserEmail,
  passwordResetTokens,
} from "@workspace/database"
import { sendEmail } from "@/lib/server/email/send-email"
import { PasswordResetEmail } from "@/emails/templates/PasswordResetEmail"
import { resolveAppBaseUrl } from "@/lib/server/app-base-url"
import { hashPasswordResetToken } from "@/lib/server/password-reset-token"

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000

export async function requestPasswordReset(
  email: string
): Promise<{ error?: string }> {
  const normalized = normalizeUserEmail(email)
  if (!normalized || !normalized.includes("@")) {
    return { error: "Enter a valid email address." }
  }

  const user = await db.query.users.findFirst({
    where: whereUserEmail(normalized),
  })

  if (!user) {
    return {}
  }

  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.email, normalized))

  const token = randomUUID()
  const tokenHash = hashPasswordResetToken(token)
  const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS)

  await db.insert(passwordResetTokens).values({
    email: normalized,
    token: tokenHash,
    expires,
  })

  const resetLink = `${resolveAppBaseUrl()}/reset-password?token=${token}`

  try {
    await sendEmail({
      to: normalized,
      subject: "Reset your Arohaa password",
      react: createElement(PasswordResetEmail, {
        resetLink,
        expiresInMinutes: 60,
      }),
    })
  } catch {
    return { error: "Failed to send email. Please try again." }
  }

  return {}
}
