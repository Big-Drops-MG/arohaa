"use server"

import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { db, users } from "@workspace/database"
import { isExternalTeamKind } from "@/features/team/model/external-privileges"
import {
  consumeExternalInviteToken,
  findExternalInviteUserId,
} from "@/lib/server/external-invite-token"

const MIN_PASSWORD_LENGTH = 12

export async function acceptExternalMemberInvite(input: {
  token: string
  password: string
  confirmPassword: string
}): Promise<{ error?: string; success?: true }> {
  const token = input.token.trim()
  const password = input.password
  const confirmPassword = input.confirmPassword

  if (!token) return { error: "Invite link is invalid or expired." }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    }
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." }
  }

  const userId = await findExternalInviteUserId(token)
  if (!userId) {
    return { error: "Invite link is invalid or expired." }
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })
  if (!user || !isExternalTeamKind(user.teamKind)) {
    return { error: "Invite link is invalid or expired." }
  }

  const consumed = await consumeExternalInviteToken(token, userId)
  if (!consumed) {
    return { error: "This invite link has already been used." }
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await db
    .update(users)
    .set({ password: passwordHash })
    .where(eq(users.id, userId))

  return { success: true }
}

export async function validateExternalInviteToken(
  token: string
): Promise<{ valid: boolean }> {
  const userId = await findExternalInviteUserId(token.trim())
  return { valid: Boolean(userId) }
}
