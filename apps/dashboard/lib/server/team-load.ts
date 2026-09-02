import { notFound } from "next/navigation"
import { asc, db, eq, users, VIEWER_ROLE_KEY } from "@workspace/database"
import { parseInternalAccessLevel } from "@/features/team/model/access-level"
import { isExternalTeamKind } from "@/features/team/model/external-privileges"
import type {
  AccessRequestItem,
  TeamDashboardData,
  TeamMember,
} from "@/features/team/model/team"
import { listPendingAccessRequests } from "@/lib/server/access-requests"
import {
  actorCan,
  canManageExternalTeam,
  canWriteLandingPages,
} from "@/lib/server/actor-can"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { isUserActive, touchUserLastSeen } from "@/lib/server/user-last-seen"

function buildInitials(
  firstName: string,
  lastName: string,
  email: string
): string {
  const first = firstName.trim().charAt(0)
  const last = lastName.trim().charAt(0)
  const fromName = `${first}${last}`.trim().toUpperCase()
  if (fromName) return fromName
  const fromEmail = email.trim().charAt(0).toUpperCase()
  return fromEmail || "?"
}

function toPersonFields(row: {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  role: string | null
}) {
  const firstName = row.firstName?.trim() ?? ""
  const lastName = row.lastName?.trim() ?? ""
  const email = row.email?.trim() ?? ""
  const name = `${firstName} ${lastName}`.trim() || email || "User"
  return {
    id: row.id,
    name,
    email,
    roleLabel: row.role?.trim() || "—",
    initials: buildInitials(firstName, lastName, email),
  }
}

function accessLevelFromRoleKey(
  roleKey: string | undefined,
  teamKind: string
): ReturnType<typeof parseInternalAccessLevel> {
  if (teamKind === "external") return "full"
  return roleKey === VIEWER_ROLE_KEY ? "read_only" : "full"
}

export async function loadTeamDashboardData(): Promise<TeamDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  await touchUserLastSeen(actor.id)

  const [
    memberRows,
    roleRows,
    pendingRows,
    canReviewAccessRequests,
    canAssignRoles,
    canReadAuditLogs,
    canManageExternalMembers,
    actorCanWrite,
  ] = await Promise.all([
    db.query.users.findMany({
      where: eq(users.accessStatus, "approved"),
      orderBy: [asc(users.firstName), asc(users.lastName), asc(users.email)],
    }),
    db.query.accessRoles.findMany({
      columns: { id: true, key: true },
    }),
    listPendingAccessRequests(),
    actorCan(actor, "team.review_access"),
    actorCan(actor, "team.assign_roles"),
    actorCan(actor, "audit_logs.read"),
    canManageExternalTeam(actor),
    canWriteLandingPages(actor),
  ])

  const roleKeyById = new Map(roleRows.map((row) => [row.id, row.key]))

  const now = new Date()
  const members: TeamMember[] = memberRows.map((row) => {
    const person = toPersonFields(row)
    const lastSeenAt = row.lastSeenAt?.toISOString() ?? null
    const active =
      row.id === actor.id ? true : isUserActive(row.lastSeenAt, now)
    const roleKey = row.roleId ? roleKeyById.get(row.roleId) : undefined

    return {
      ...person,
      isCurrentUser: row.id === actor.id,
      status: active ? "active" : "inactive",
      kind: row.teamKind === "external" ? "external" : "internal",
      accessLevel: accessLevelFromRoleKey(roleKey, row.teamKind),
      roleKey,
      lastSeenAt: row.id === actor.id ? now.toISOString() : lastSeenAt,
    }
  })

  const accessRequests: AccessRequestItem[] = pendingRows.map((row) =>
    toPersonFields(row)
  )

  const isInternalWriter = !isExternalTeamKind(actor.teamKind) && actorCanWrite

  return {
    members,
    accessRequests,
    canReviewAccessRequests,
    canManageAccessLevels: canAssignRoles && isInternalWriter,
    canViewMemberLogs: canReadAuditLogs,
    canManageExternalMembers,
  }
}
