import "server-only"

import { eq, lt } from "drizzle-orm"
import { db, revokedJti, users } from "@workspace/database"
import {
  isTokenInvalidatedBySessionsInvalidBefore,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/server/session-token-utils"

export { isTokenInvalidatedBySessionsInvalidBefore, SESSION_MAX_AGE_SECONDS }

export async function revokeSessionJti(params: {
  jti: string
  userId: string
}): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)
  await db
    .insert(revokedJti)
    .values({
      jti: params.jti,
      userId: params.userId,
      expiresAt,
    })
    .onConflictDoNothing()

  void pruneExpiredRevokedJtis()
}

export async function invalidateAllSessionsForUser(
  userId: string
): Promise<void> {
  await db
    .update(users)
    .set({ sessionsInvalidBefore: new Date() })
    .where(eq(users.id, userId))
}

export async function isSessionTokenRevoked(token: {
  jti?: string
  sub?: string
  iat?: number
}): Promise<boolean> {
  if (token.jti) {
    const row = await db.query.revokedJti.findFirst({
      where: eq(revokedJti.jti, token.jti),
      columns: { jti: true },
    })
    if (row) return true
  }

  if (token.sub && typeof token.iat === "number") {
    const user = await db.query.users.findFirst({
      where: eq(users.id, token.sub),
      columns: { sessionsInvalidBefore: true },
    })
    if (
      isTokenInvalidatedBySessionsInvalidBefore(
        token.iat,
        user?.sessionsInvalidBefore
      )
    ) {
      return true
    }
  }

  return false
}

export async function pruneExpiredRevokedJtis(): Promise<void> {
  await db.delete(revokedJti).where(lt(revokedJti.expiresAt, new Date()))
}
