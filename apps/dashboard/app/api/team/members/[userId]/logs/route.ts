import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db, users } from "@workspace/database"
import type { TeamActivityLogEntry } from "@/features/team/model/activity-log"
import {
  formatAuditLogAction,
  formatAuditLogDetail,
} from "@/features/settings/utils/audit-log-format"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { listAuditLogsByActorUserId } from "@/lib/server/landing-audit-log"
import { listUserActivityLogsByActor } from "@/lib/server/user-activity-log"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import { isTeamPrivilegeActor } from "@/lib/server/team-privilege-acl"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isTeamPrivilegeActor(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const { userId } = await context.params
  if (!userId?.trim()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const member = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      accessStatus: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  })

  if (!member || member.accessStatus !== "approved") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
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

  return NextResponse.json({
    member: {
      id: member.id,
      name:
        `${member.firstName?.trim() ?? ""} ${member.lastName?.trim() ?? ""}`.trim() ||
        member.email?.trim() ||
        "User",
      email: member.email,
    },
    items,
  })
}
