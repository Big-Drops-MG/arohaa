import "server-only"

import { and, eq, gt, lt, sql } from "drizzle-orm"
import { verifySync } from "otplib"
import { db, twoFactorSessionStamp, usedTotp } from "@workspace/database"

const TOTP_PERIOD_SECONDS = 30
const TOTP_EPOCH_TOLERANCE_SECONDS = TOTP_PERIOD_SECONDS

const STAMP_TTL_MS = 60_000
const USED_TOTP_RETENTION_MS = 5 * 60_000

export async function consumeTotp(
  userId: string,
  secret: string,
  code: string
): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false

  const result = verifySync({
    token: code,
    secret,
    epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
  })

  if (!result.valid) return false
  const timeStep =
    "timeStep" in result && typeof result.timeStep === "number"
      ? result.timeStep
      : null
  if (timeStep == null) return false

  const inserted = await db
    .insert(usedTotp)
    .values({
      userId,
      periodCounter: timeStep,
    })
    .onConflictDoNothing()
    .returning({ userId: usedTotp.userId })

  if (inserted.length > 0) {
    void pruneStaleUsedTotp()
  }

  return inserted.length > 0
}

export async function issueTwoFactorSessionStamp(
  userId: string,
  sessionJti: string
): Promise<number> {
  const verifiedAt = Date.now()
  const expiresAt = new Date(verifiedAt + STAMP_TTL_MS)

  await db
    .insert(twoFactorSessionStamp)
    .values({
      userId,
      sessionJti,
      verifiedAt: new Date(verifiedAt),
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [twoFactorSessionStamp.userId, twoFactorSessionStamp.sessionJti],
      set: {
        verifiedAt: new Date(verifiedAt),
        expiresAt,
      },
    })

  return verifiedAt
}

export async function consumeTwoFactorSessionStamp(
  userId: string,
  sessionJti: string
): Promise<number | null> {
  const rows = await db
    .delete(twoFactorSessionStamp)
    .where(
      and(
        eq(twoFactorSessionStamp.userId, userId),
        eq(twoFactorSessionStamp.sessionJti, sessionJti),
        gt(twoFactorSessionStamp.expiresAt, new Date())
      )
    )
    .returning({ verifiedAt: twoFactorSessionStamp.verifiedAt })

  const row = rows[0]
  if (!row) return null
  return row.verifiedAt.getTime()
}

export async function pruneUsedTotp(userId: string): Promise<void> {
  const minCounter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS) - 4
  await db.execute(
    sql`DELETE FROM used_totp WHERE "userId" = ${userId} AND "periodCounter" < ${minCounter}`
  )
}

export async function pruneStaleUsedTotp(): Promise<void> {
  const cutoff = new Date(Date.now() - USED_TOTP_RETENTION_MS)
  await db.delete(usedTotp).where(lt(usedTotp.createdAt, cutoff))
}
