"use server"

import bcrypt from "bcryptjs"
import { and, eq, gt } from "drizzle-orm"
import { redirect } from "next/navigation"
import {
  db,
  passwordResetTokens,
  users,
  whereUserEmail,
} from "@workspace/database"
import { hashPasswordResetToken } from "@/lib/server/password-reset-token"

export type SubmitResetPasswordResult = { error: string }

export async function submitResetPasswordAttempt(input: {
  token: string
  newPassword: string
  confirmPassword: string
}): Promise<SubmitResetPasswordResult | void> {
  const token = input.token.trim()
  const { newPassword, confirmPassword } = input

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }
  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match." }
  }
  if (!token) {
    return { error: "This reset link is invalid or has expired." }
  }

  const tokenHash = hashPasswordResetToken(token)
  const row = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.token, tokenHash),
      gt(passwordResetTokens.expires, new Date())
    ),
  })

  if (!row) {
    return { error: "This reset link is invalid or has expired." }
  }

  const user = await db.query.users.findFirst({
    where: whereUserEmail(row.email),
    columns: { id: true },
  })
  if (!user) {
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.token, tokenHash))
    return { error: "This reset link is invalid or has expired." }
  }

  const hashed = await bcrypt.hash(newPassword, 12)
  await db.update(users).set({ password: hashed }).where(eq(users.id, user.id))
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.email, row.email))

  redirect("/reset-password/success")
}
