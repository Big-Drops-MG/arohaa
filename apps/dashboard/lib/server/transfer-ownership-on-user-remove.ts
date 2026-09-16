import "server-only"

import { and, count, eq, inArray, isNull, ne, sql } from "drizzle-orm"
import {
  accessRoles,
  CEO_ROLE_KEY,
  db,
  landingPageAuditLogs,
  landingPages,
  segments,
  SUPERADMIN_ROLE_KEY,
  users,
  workspaceAlertWebhooks,
  workspaceApiKeys,
  workspaces,
} from "@workspace/database"

async function resolveOwnershipRecipientUserId(
  preferredUserId: string,
  excludeUserId: string
): Promise<string | null> {
  if (preferredUserId !== excludeUserId) {
    const preferred = await db
      .select({ id: users.id, roleKey: accessRoles.key })
      .from(users)
      .innerJoin(accessRoles, eq(accessRoles.id, users.roleId))
      .where(
        and(
          eq(users.id, preferredUserId),
          eq(users.accessStatus, "approved"),
          eq(users.teamKind, "internal"),
          inArray(accessRoles.key, [SUPERADMIN_ROLE_KEY, CEO_ROLE_KEY])
        )
      )
      .limit(1)

    if (preferred[0]) return preferred[0].id
  }

  const candidates = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(accessRoles, eq(accessRoles.id, users.roleId))
    .where(
      and(
        eq(users.accessStatus, "approved"),
        eq(users.teamKind, "internal"),
        ne(users.id, excludeUserId),
        inArray(accessRoles.key, [SUPERADMIN_ROLE_KEY, CEO_ROLE_KEY])
      )
    )
    .orderBy(
      sql`CASE WHEN ${accessRoles.key} = ${SUPERADMIN_ROLE_KEY} THEN 0 ELSE 1 END`,
      users.email
    )
    .limit(1)

  return candidates[0]?.id ?? null
}

async function ensureOwnerWorkspaceId(ownerUserId: string): Promise<string> {
  const existing = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(eq(workspaces.ownerUserId, ownerUserId), isNull(workspaces.deletedAt))
    )
    .limit(1)

  if (existing[0]) return existing[0].id

  const [created] = await db
    .insert(workspaces)
    .values({
      ownerUserId,
      name: "Personal",
    })
    .returning({ id: workspaces.id })

  if (!created) {
    throw new Error("Could not resolve workspace for ownership transfer.")
  }
  return created.id
}

async function reassignUserFks(fromUserId: string, toUserId: string) {
  await db
    .update(landingPages)
    .set({ createdByUserId: toUserId, updatedAt: new Date() })
    .where(eq(landingPages.createdByUserId, fromUserId))

  await db
    .update(landingPageAuditLogs)
    .set({ actorUserId: toUserId })
    .where(eq(landingPageAuditLogs.actorUserId, fromUserId))

  await db
    .update(workspaceApiKeys)
    .set({ createdByUserId: toUserId })
    .where(eq(workspaceApiKeys.createdByUserId, fromUserId))

  await db
    .update(users)
    .set({ accessReviewedByUserId: null })
    .where(eq(users.accessReviewedByUserId, fromUserId))
}

export async function countSuperadminsExcluding(
  excludeUserId: string
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .innerJoin(accessRoles, eq(accessRoles.id, users.roleId))
    .where(
      and(eq(accessRoles.key, SUPERADMIN_ROLE_KEY), ne(users.id, excludeUserId))
    )
  return Number(row?.value ?? 0)
}

/**
 * Moves the removed user's projects into the recipient's workspace so a hard
 * delete cannot cascade-destroy landing pages.
 *
 * Uses sequential neon-http queries (no transactions — neon-http does not
 * support them).
 */
export async function transferOwnedAssetsBeforeUserDelete(params: {
  fromUserId: string
  toUserId: string
}): Promise<{ recipientWorkspaceId: string; transferredLandingPages: number }> {
  const { fromUserId, toUserId } = params
  const recipientWorkspaceId = await ensureOwnerWorkspaceId(toUserId)

  const ownedWorkspaces = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, fromUserId))

  const ownedWorkspaceIds = ownedWorkspaces.map((row) => row.id)
  let transferredLandingPages = 0

  if (ownedWorkspaceIds.length > 0) {
    const recipientActiveUrls = await db
      .select({ normalizedUrl: landingPages.normalizedUrl })
      .from(landingPages)
      .where(
        and(
          eq(landingPages.workspaceId, recipientWorkspaceId),
          isNull(landingPages.deletedAt)
        )
      )
    const takenUrls = new Set(
      recipientActiveUrls.map((row) => row.normalizedUrl)
    )

    const sourcePages = await db
      .select({
        id: landingPages.id,
        normalizedUrl: landingPages.normalizedUrl,
        deletedAt: landingPages.deletedAt,
      })
      .from(landingPages)
      .where(inArray(landingPages.workspaceId, ownedWorkspaceIds))

    for (const page of sourcePages) {
      const conflicts =
        page.deletedAt == null && takenUrls.has(page.normalizedUrl)
      await db
        .update(landingPages)
        .set({
          workspaceId: recipientWorkspaceId,
          createdByUserId: toUserId,
          deletedAt: conflicts ? new Date() : page.deletedAt,
          updatedAt: new Date(),
        })
        .where(eq(landingPages.id, page.id))
      transferredLandingPages += 1
      if (!conflicts && page.deletedAt == null) {
        takenUrls.add(page.normalizedUrl)
      }
    }

    await db
      .update(segments)
      .set({ workspaceId: recipientWorkspaceId, updatedAt: new Date() })
      .where(inArray(segments.workspaceId, ownedWorkspaceIds))

    await db
      .update(workspaceApiKeys)
      .set({
        workspaceId: recipientWorkspaceId,
        createdByUserId: toUserId,
      })
      .where(inArray(workspaceApiKeys.workspaceId, ownedWorkspaceIds))

    await db
      .update(workspaceAlertWebhooks)
      .set({ workspaceId: recipientWorkspaceId })
      .where(inArray(workspaceAlertWebhooks.workspaceId, ownedWorkspaceIds))

    await db
      .update(workspaces)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(inArray(workspaces.id, ownedWorkspaceIds))
  }

  await reassignUserFks(fromUserId, toUserId)

  return { recipientWorkspaceId, transferredLandingPages }
}

export async function resolveInternalOwnershipRecipient(
  actorUserId: string,
  targetUserId: string
): Promise<string | null> {
  return resolveOwnershipRecipientUserId(actorUserId, targetUserId)
}
