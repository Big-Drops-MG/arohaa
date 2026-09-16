"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import {
  db,
  users,
  userActivityLogs,
  VIEWER_ROLE_KEY,
  MEMBER_ROLE_KEY,
  SUPERADMIN_ROLE_KEY,
} from "@workspace/database"
import {
  type InternalAccessLevel,
  parseInternalAccessLevel,
} from "@/features/team/model/access-level"
import { isExternalTeamKind } from "@/features/team/model/external-privileges"
import {
  actorCan,
  canRemoveInternalTeamMembers,
  getRoleById,
  isSuperadmin,
} from "@/lib/server/actor-can"
import { isApprovedAccess } from "@/lib/server/access-status"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { assignRole } from "@/lib/server/role-management"
import {
  clientIpFromNextHeaders,
  userAgentFromHeaders,
} from "@/lib/server/request-client-meta"
import {
  countSuperadminsExcluding,
  resolveInternalOwnershipRecipient,
  transferOwnedAssetsBeforeUserDelete,
} from "@/lib/server/transfer-ownership-on-user-remove"
import { writeUserActivityLog } from "@/lib/server/user-activity-log"
import { headers } from "next/headers"

function roleKeyForAccessLevel(accessLevel: InternalAccessLevel): string {
  return accessLevel === "read_only" ? VIEWER_ROLE_KEY : MEMBER_ROLE_KEY
}

export async function updateInternalMemberAccessLevel(input: {
  userId: string
  accessLevel: InternalAccessLevel
}): Promise<{ error?: string; success?: true }> {
  const actor = await requireLandingPageActor()
  if (
    !actor ||
    !isApprovedAccess(actor.accessStatus) ||
    isExternalTeamKind(actor.teamKind) ||
    !(await actorCan(actor, "landing_pages.write")) ||
    !(await actorCan(actor, "team.assign_roles"))
  ) {
    return { error: "Unauthorized." }
  }

  const targetId = typeof input.userId === "string" ? input.userId.trim() : ""
  if (!targetId) return { error: "Invalid request." }
  if (targetId === actor.id) {
    return { error: "You cannot change your own access level." }
  }

  const accessLevel = parseInternalAccessLevel(input.accessLevel)
  const targetRoleKey = roleKeyForAccessLevel(accessLevel)

  const target = await db.query.users.findFirst({
    where: eq(users.id, targetId),
  })
  if (!target) return { error: "User not found." }
  if (isExternalTeamKind(target.teamKind)) {
    return { error: "Access level applies to internal members only." }
  }
  if (target.accessStatus !== "approved") {
    return { error: "Member is not approved." }
  }

  const currentRole = target.roleId ? await getRoleById(target.roleId) : null
  if (currentRole?.key === targetRoleKey) {
    return { success: true }
  }

  const assigned = await assignRole(actor, target.id, targetRoleKey)
  if (assigned.error) return { error: assigned.error }

  const headerStore = await headers()
  await writeUserActivityLog({
    actorUserId: actor.id,
    eventType: "action",
    summary: `Changed access for ${target.email ?? target.id} to ${accessLevel === "read_only" ? "Read only" : "Full access"}`,
    path: "/dashboard/team",
    targetLabel: target.email ?? target.id,
    ipAddress: await clientIpFromNextHeaders(),
    userAgent: userAgentFromHeaders(headerStore),
    metadata: {
      targetUserId: target.id,
      accessLevel,
      roleKey: targetRoleKey,
    },
  })

  revalidatePath("/dashboard/team")
  return { success: true }
}

export async function removeInternalTeamMember(
  userId: string
): Promise<{ error?: string; success?: true }> {
  const actor = await requireLandingPageActor()
  if (!actor || !(await canRemoveInternalTeamMembers(actor))) {
    return { error: "Unauthorized." }
  }

  const targetId = typeof userId === "string" ? userId.trim() : ""
  if (!targetId) return { error: "Invalid request." }
  if (targetId === actor.id) {
    return { error: "You cannot remove your own account." }
  }

  const target = await db.query.users.findFirst({
    where: eq(users.id, targetId),
  })
  if (!target || isExternalTeamKind(target.teamKind)) {
    return { error: "Internal member not found." }
  }
  if (!isApprovedAccess(target.accessStatus)) {
    return { error: "Internal member not found." }
  }

  const targetRole = target.roleId ? await getRoleById(target.roleId) : null
  const callerIsSuperadmin = await isSuperadmin(actor)
  if (targetRole?.key === SUPERADMIN_ROLE_KEY && !callerIsSuperadmin) {
    return { error: "Only a superadmin can remove a superadmin." }
  }

  if (targetRole?.key === SUPERADMIN_ROLE_KEY) {
    const remaining = await countSuperadminsExcluding(targetId)
    if (remaining < 1) {
      return { error: "Cannot remove the last superadmin." }
    }
  }

  const ownershipRecipientId = await resolveInternalOwnershipRecipient(
    actor.id,
    targetId
  )
  if (!ownershipRecipientId) {
    return {
      error:
        "No superadmin or CEO is available to receive this member's projects.",
    }
  }

  const headerStore = await headers()
  const ipAddress = await clientIpFromNextHeaders()
  const userAgent = userAgentFromHeaders(headerStore)

  try {
    const transfer = await transferOwnedAssetsBeforeUserDelete({
      fromUserId: targetId,
      toUserId: ownershipRecipientId,
    })

    await db.insert(userActivityLogs).values({
      id: crypto.randomUUID(),
      actorUserId: actor.id,
      eventType: "action",
      summary: `Removed internal member ${target.email ?? targetId}`,
      path: "/dashboard/team",
      targetLabel: target.email ?? targetId,
      ipAddress,
      userAgent,
      metadata: {
        targetUserId: targetId,
        beforeRoleKey: targetRole?.key ?? null,
        ownershipRecipientId,
        recipientWorkspaceId: transfer.recipientWorkspaceId,
        transferredLandingPages: transfer.transferredLandingPages,
        hardDelete: true,
      },
    })

    await db.delete(users).where(eq(users.id, targetId))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("At least one superadmin required")) {
      return { error: "Cannot remove the last superadmin." }
    }
    throw err
  }

  revalidatePath("/dashboard/team")
  return { success: true }
}
