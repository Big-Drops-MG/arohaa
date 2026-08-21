import { desc, eq } from "drizzle-orm"
import {
  db,
  landingPageAuditLogs,
  landingPages,
  users,
} from "@workspace/database"
import { enqueueNotificationFromAuditLog } from "@/lib/server/notifications"
import {
  clientIpFromNextHeaders,
  userAgentFromHeaders,
} from "@/lib/server/request-client-meta"
import { writeUserActivityLog } from "@/lib/server/user-activity-log"
import { headers } from "next/headers"
import { formatAuditLogAction } from "@/features/settings/utils/audit-log-format"

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
  landingPageId?: string
  landingPageBrandName?: string | null
  landingPagePublicId?: string | null
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

  try {
    const headerStore = await headers()
    const page = await db.query.landingPages.findFirst({
      where: eq(landingPages.id, input.landingPageId),
      columns: { publicId: true, brandName: true },
    })
    await writeUserActivityLog({
      actorUserId: input.actorUserId,
      eventType: "action",
      summary: formatAuditLogAction(input.action),
      path: page?.publicId ? `/dashboard/${page.publicId}` : null,
      tab: "settings",
      projectPublicId: page?.publicId ?? null,
      ipAddress: await clientIpFromNextHeaders(),
      userAgent: userAgentFromHeaders(headerStore),
      metadata: {
        auditLogId: id,
        landingPageId: input.landingPageId,
        brandName: page?.brandName ?? null,
        beforePayload: input.beforePayload ?? null,
        afterPayload: input.afterPayload ?? null,
      },
    })
  } catch {
    // Never fail the primary audit write because of activity enrichment.
  }

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

export async function listAuditLogsByActorUserId(
  actorUserId: string,
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
      landingPageId: landingPageAuditLogs.landingPageId,
      landingPageBrandName: landingPages.brandName,
      landingPagePublicId: landingPages.publicId,
    })
    .from(landingPageAuditLogs)
    .innerJoin(users, eq(landingPageAuditLogs.actorUserId, users.id))
    .innerJoin(
      landingPages,
      eq(landingPageAuditLogs.landingPageId, landingPages.id)
    )
    .where(eq(landingPageAuditLogs.actorUserId, actorUserId))
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
    landingPageId: row.landingPageId,
    landingPageBrandName: row.landingPageBrandName,
    landingPagePublicId: row.landingPagePublicId,
  }))
}
