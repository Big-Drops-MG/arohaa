import "server-only"

import { and, eq, isNull } from "drizzle-orm"
import { db, landingPageAuditLogs, landingPages } from "@workspace/database"
import { leaveExperimentForLandingPage } from "@/lib/server/experiments-store"
import { enqueueNotificationFromAuditLog } from "@/lib/server/notifications"
import type { LandingPageRow } from "@/lib/server/landing-pages-store"

class SoftDeleteAbort extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "SoftDeleteAbort"
  }
}

export type SoftDeleteAuditInput = {
  action: "delete" | "archive"
  actorUserId: string
  traceId: string | null
  beforePayload: Record<string, unknown>
  afterPayload:
    | Record<string, unknown>
    | null
    | ((deletedAt: Date) => Record<string, unknown>)
}

export async function scrubExperimentsAndSoftDeleteLandingPage(
  row: LandingPageRow,
  actorId: string,
  audit?: SoftDeleteAuditInput
): Promise<
  { ok: true; deletedAt: Date } | { ok: false; error: string; status: number }
> {
  const now = new Date()
  const auditLogId = audit ? crypto.randomUUID() : null
  let resolvedAfterPayload: Record<string, unknown> | null = null

  try {
    await db.transaction(async (tx) => {
      const detached = await leaveExperimentForLandingPage(row, tx)
      if (!detached.ok && detached.status !== 404) {
        throw new SoftDeleteAbort(detached.error, detached.status ?? 409)
      }

      await tx
        .update(landingPages)
        .set({
          deletedAt: now,
          updatedAt: now,
          updatedByUserId: actorId,
          status: "archived",
          sdkInstallStatus: "failed",
        })
        .where(and(eq(landingPages.id, row.id), isNull(landingPages.deletedAt)))

      if (audit && auditLogId) {
        resolvedAfterPayload =
          typeof audit.afterPayload === "function"
            ? audit.afterPayload(now)
            : audit.afterPayload

        await tx.insert(landingPageAuditLogs).values({
          id: auditLogId,
          actorUserId: audit.actorUserId,
          landingPageId: row.id,
          action: audit.action,
          beforePayload: audit.beforePayload,
          afterPayload: resolvedAfterPayload,
          traceId: audit.traceId,
        })
      }
    })
  } catch (err) {
    if (err instanceof SoftDeleteAbort) {
      return { ok: false, error: err.message, status: err.status }
    }
    throw err
  }

  if (audit && auditLogId) {
    await enqueueNotificationFromAuditLog({
      auditLogId,
      actorUserId: audit.actorUserId,
      landingPageId: row.id,
      action: audit.action,
      beforePayload: audit.beforePayload,
      afterPayload: resolvedAfterPayload,
    })
  }

  return { ok: true, deletedAt: now }
}
