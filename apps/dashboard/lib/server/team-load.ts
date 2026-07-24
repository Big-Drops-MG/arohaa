import { notFound } from "next/navigation"
import { asc, db, eq, users } from "@workspace/database"
import { isCeoRole } from "@/features/auth/model/role-options"
import type {
  AccessRequestItem,
  TeamDashboardData,
  TeamMember,
} from "@/features/team/model/team"
import { listPendingAccessRequests } from "@/lib/server/access-requests"
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

export async function loadTeamDashboardData(): Promise<TeamDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  await touchUserLastSeen(actor.id)

  const [memberRows, pendingRows] = await Promise.all([
    db.query.users.findMany({
      where: eq(users.accessStatus, "approved"),
      orderBy: [asc(users.firstName), asc(users.lastName), asc(users.email)],
    }),
    listPendingAccessRequests(),
  ])

  const now = new Date()
  const members: TeamMember[] = memberRows.map((row) => {
    const person = toPersonFields(row)
    const lastSeenAt = row.lastSeenAt?.toISOString() ?? null
    const active =
      row.id === actor.id ? true : isUserActive(row.lastSeenAt, now)

    return {
      ...person,
      isCurrentUser: row.id === actor.id,
      status: active ? "active" : "inactive",
      lastSeenAt: row.id === actor.id ? now.toISOString() : lastSeenAt,
    }
  })

  const accessRequests: AccessRequestItem[] = pendingRows.map((row) =>
    toPersonFields(row)
  )

  return {
    members,
    accessRequests,
    canReviewAccessRequests: isCeoRole(actor.role),
  }
}
