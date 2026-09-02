import "server-only"

import { eq } from "drizzle-orm"
import { db, users } from "@workspace/database"
import type { TeamActivityLogEntry } from "@/features/team/model/activity-log"
import {
  formatAuditLogAction,
  formatAuditLogDetail,
} from "@/features/settings/utils/audit-log-format"
import { actorCan, type Actor } from "@/lib/server/actor-can"
import { listAuditLogsByActorUserId } from "@/lib/server/landing-audit-log"
import { listUserActivityLogsByActor } from "@/lib/server/user-activity-log"

export async function canAccessMemberLogs(
  actor: Actor,
  targetUserId: string
): Promise<boolean> {
  if (actor.id === targetUserId) return true
  return actorCan(actor, "audit_logs.read")
}

export async function loadTeamMemberLogsForApi(targetUserId: string): Promise<
  | {
      ok: true
      data: {
        member: { id: string; name: string; email: string | null }
        items: TeamActivityLogEntry[]
      }
    }
  | { ok: false; status: number; error: string }
> {
  const member = await db.query.users.findFirst({
    where: eq(users.id, targetUserId),
    columns: {
      id: true,
      accessStatus: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  })

  if (!member || member.accessStatus !== "approved") {
    return { ok: false, status: 404, error: "Not found" }
  }

  const [activityRows, auditRows] = await Promise.all([
    listUserActivityLogsByActor(member.id, 250),
    listAuditLogsByActorUserId(member.id, 100),
  ])

  const activityItems: TeamActivityLogEntry[] = activityRows.map((row) => ({
    id: `activity:${row.id}`,
    source: "activity",
    eventType: row.eventType,
    summary: row.summary,
    detail: null,
    path: row.path,
    tab: row.tab,
    projectPublicId: row.projectPublicId,
    projectName: null,
    targetLabel: row.targetLabel,
    targetHref: row.targetHref,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
  }))

  const auditItems: TeamActivityLogEntry[] = auditRows.map((row) => ({
    id: `audit:${row.id}`,
    source: "audit",
    eventType: row.action,
    summary: formatAuditLogAction(row.action),
    detail: formatAuditLogDetail(row),
    path: row.landingPagePublicId
      ? `/dashboard/${row.landingPagePublicId}`
      : null,
    tab: "settings",
    projectPublicId: row.landingPagePublicId ?? null,
    projectName: row.landingPageBrandName ?? null,
    targetLabel: null,
    targetHref: null,
    ipAddress: null,
    userAgent: null,
    createdAt: row.createdAt,
  }))

  const items = [...activityItems, ...auditItems]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 300)

  return {
    ok: true,
    data: {
      member: {
        id: member.id,
        name:
          `${member.firstName?.trim() ?? ""} ${member.lastName?.trim() ?? ""}`.trim() ||
          member.email?.trim() ||
          "User",
        email: member.email,
      },
      items,
    },
  }
}
