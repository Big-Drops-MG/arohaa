"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import {
  db,
  users,
  VIEWER_ROLE_KEY,
  MEMBER_ROLE_KEY,
} from "@workspace/database"
import {
  type InternalAccessLevel,
  parseInternalAccessLevel,
} from "@/features/team/model/access-level"
import { isExternalTeamKind } from "@/features/team/model/external-privileges"
import { actorCan, getRoleById } from "@/lib/server/actor-can"
import { isApprovedAccess } from "@/lib/server/access-status"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { assignRole } from "@/lib/server/role-management"
import {
  clientIpFromNextHeaders,
  userAgentFromHeaders,
} from "@/lib/server/request-client-meta"
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
