import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { and, eq, gt, lt } from "drizzle-orm"
import {
  db,
  externalMemberInviteTokens,
  usedExternalInviteTokens,
} from "@workspace/database"
import { hashInviteToken } from "@/lib/server/field-encryption"

export const EXTERNAL_INVITE_TTL_MS = 48 * 60 * 60 * 1000

export function hashExternalInviteToken(token: string): string {
  return hashInviteToken(token)
}

export async function issueExternalMemberInviteToken(
  userId: string
): Promise<string> {
  const token = randomUUID()
  const expires = new Date(Date.now() + EXTERNAL_INVITE_TTL_MS)

  await db
    .delete(externalMemberInviteTokens)
    .where(eq(externalMemberInviteTokens.userId, userId))

  await db.insert(externalMemberInviteTokens).values({
    userId,
    token,
    expires,
  })

  return token
}

export async function findExternalInviteUserId(
  token: string
): Promise<string | null> {
  const trimmed = token.trim()
  if (!trimmed) return null

  const row = await db.query.externalMemberInviteTokens.findFirst({
    where: and(
      eq(externalMemberInviteTokens.token, trimmed),
      gt(externalMemberInviteTokens.expires, new Date())
    ),
    columns: { userId: true },
  })

  return row?.userId ?? null
}

export async function consumeExternalInviteToken(
  token: string,
  userId: string
): Promise<boolean> {
  const trimmed = token.trim()
  if (!trimmed) return false

  const tokenHash = hashExternalInviteToken(trimmed)

  const inserted = await db
    .insert(usedExternalInviteTokens)
    .values({ tokenHash, userId })
    .onConflictDoNothing()
    .returning({ tokenHash: usedExternalInviteTokens.tokenHash })

  if (inserted.length === 0) return false

  await db
    .delete(externalMemberInviteTokens)
    .where(eq(externalMemberInviteTokens.token, trimmed))

  return true
}

export async function pruneExpiredExternalInviteTokens(): Promise<void> {
  await db
    .delete(externalMemberInviteTokens)
    .where(lt(externalMemberInviteTokens.expires, new Date()))
}

export function inviteTokenHashForAudit(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12)
}
