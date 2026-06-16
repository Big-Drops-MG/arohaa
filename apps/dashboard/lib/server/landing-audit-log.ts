import { desc, eq } from "drizzle-orm"
import { db, landingPageAuditLogs, users } from "@workspace/database"
import { enqueueNotificationFromAuditLog } from "@/lib/server/notifications"

export type LandingPageAuditLogRow = {
  id: string
  action: string
  beforePayload: Record<string, unknown> | null
  afterPayload: Record<string, unknown> | null
  traceId: string | null
  createdAt: string
  actorUserId: string
  actorEmail: string | null
  actorFirstName: string | null
  actorLastName: string | null
}

export async function writeLandingPageAuditLog(input: {
  actorUserId: string
  landingPageId: string
  action: string
  beforePayload?: Record<string, unknown> | null
  afterPayload?: Record<string, unknown> | null
  traceId?: string | null
}): Promise<string> {
  const id = crypto.randomUUID()

  await db.insert(landingPageAuditLogs).values({
    id,
    actorUserId: input.actorUserId,
    landingPageId: input.landingPageId,
    action: input.action,
    beforePayload: input.beforePayload ?? null,
    afterPayload: input.afterPayload ?? null,
    traceId: input.traceId ?? null,
  })

  await enqueueNotificationFromAuditLog({
    auditLogId: id,
    actorUserId: input.actorUserId,
    landingPageId: input.landingPageId,
    action: input.action,
    beforePayload: input.beforePayload ?? null,
    afterPayload: input.afterPayload ?? null,
  })

  return id
}

export async function listLandingPageAuditLogs(
  landingPageId: string,
  limit = 100
): Promise<LandingPageAuditLogRow[]> {
  const rows = await db
    .select({
      id: landingPageAuditLogs.id,
      action: landingPageAuditLogs.action,
      beforePayload: landingPageAuditLogs.beforePayload,
      afterPayload: landingPageAuditLogs.afterPayload,
      traceId: landingPageAuditLogs.traceId,
      createdAt: landingPageAuditLogs.createdAt,
      actorUserId: landingPageAuditLogs.actorUserId,
      actorEmail: users.email,
      actorFirstName: users.firstName,
      actorLastName: users.lastName,
    })
    .from(landingPageAuditLogs)
    .innerJoin(users, eq(landingPageAuditLogs.actorUserId, users.id))
    .where(eq(landingPageAuditLogs.landingPageId, landingPageId))
    .orderBy(desc(landingPageAuditLogs.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    beforePayload: row.beforePayload,
    afterPayload: row.afterPayload,
    traceId: row.traceId,
    createdAt: row.createdAt.toISOString(),
    actorUserId: row.actorUserId,
    actorEmail: row.actorEmail,
    actorFirstName: row.actorFirstName,
    actorLastName: row.actorLastName,
  }))
}
