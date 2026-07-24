import { and, count, eq, ne, sql } from "drizzle-orm"
import { createNotification, db, users } from "@workspace/database"
import { CEO_ROLE } from "@/features/auth/model/role-options"
import type { AccessStatus } from "@/lib/server/access-status"

export async function countApprovedUsers(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(eq(users.accessStatus, "approved"))
  return Number(row?.value ?? 0)
}

export async function setUserAccessStatus(params: {
  userId: string
  status: AccessStatus
  reviewedByUserId?: string | null
}): Promise<void> {
  await db
    .update(users)
    .set({
      accessStatus: params.status,
      accessReviewedAt: new Date(),
      accessReviewedByUserId: params.reviewedByUserId ?? null,
    })
    .where(eq(users.id, params.userId))
}

/** Notify approved CEOs about a new access request. */
export async function notifyApprovedUsersOfAccessRequest(params: {
  requesterUserId: string
  requesterName: string
  requesterEmail: string
}): Promise<void> {
  const ceos = await db.query.users.findMany({
    where: and(
      eq(users.accessStatus, "approved"),
      eq(users.role, CEO_ROLE),
      ne(users.id, params.requesterUserId)
    ),
    columns: { id: true },
  })

  await Promise.all(
    ceos.map((member) =>
      createNotification({
        userId: member.id,
        type: "access_request",
        title: "New user request",
        body: `${params.requesterName} (${params.requesterEmail}) requested access to Arohaa.`,
        severity: "info",
        href: "/dashboard/team",
        sourceType: "access_request",
        sourceId: params.requesterUserId,
      })
    )
  )
}

export async function listPendingAccessRequests() {
  return db.query.users.findMany({
    where: and(
      eq(users.accessStatus, "pending"),
      sql`trim(coalesce(${users.firstName}, '')) <> ''`,
      sql`trim(coalesce(${users.lastName}, '')) <> ''`,
      sql`trim(coalesce(${users.role}, '')) <> ''`
    ),
    orderBy: (u, { asc }) => [asc(u.firstName), asc(u.lastName), asc(u.email)],
  })
}
