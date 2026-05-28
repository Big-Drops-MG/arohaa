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

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000

function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return "http://localhost:3000"
}

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

  // Always return success to prevent email enumeration
  if (!user) {
    return {}
  }

  // Delete any existing tokens for this email
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.email, normalized))

  // Generate new token
  const token = randomUUID()
  const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS)

  await db.insert(passwordResetTokens).values({
    email: normalized,
    token,
    expires,
  })

  const baseUrl = getAppBaseUrl()
  const resetLink = `${baseUrl}/reset-password?token=${token}`

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
