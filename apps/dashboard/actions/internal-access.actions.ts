"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { db, users } from "@workspace/database"
import {
  isFullAccessLevel,
  parseInternalAccessLevel,
  type InternalAccessLevel,
} from "@/features/team/model/access-level"
import { isExternalTeamKind } from "@/features/team/model/external-privileges"
import { isApprovedAccess } from "@/lib/server/access-status"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import {
  clientIpFromNextHeaders,
  userAgentFromHeaders,
} from "@/lib/server/request-client-meta"
import { writeUserActivityLog } from "@/lib/server/user-activity-log"
import { isTeamPrivilegeActor } from "@/lib/server/team-privilege-acl"
import { headers } from "next/headers"

export async function updateInternalMemberAccessLevel(input: {
  userId: string
  accessLevel: InternalAccessLevel
}): Promise<{ error?: string; success?: true }> {
  const actor = await requireLandingPageActor()
  if (
    !actor ||
    !isApprovedAccess(actor.accessStatus) ||
    isExternalTeamKind(actor.teamKind) ||
    !isFullAccessLevel(actor.accessLevel) ||
    !isTeamPrivilegeActor(actor)
  ) {
    return { error: "Unauthorized." }
  }

  const targetId = typeof input.userId === "string" ? input.userId.trim() : ""
  if (!targetId) return { error: "Invalid request." }
  if (targetId === actor.id) {
    return { error: "You cannot change your own access level." }
  }

  const accessLevel = parseInternalAccessLevel(input.accessLevel)

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

  if (parseInternalAccessLevel(target.accessLevel) === accessLevel) {
    return { success: true }
  }

  await db.update(users).set({ accessLevel }).where(eq(users.id, target.id))

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
    },
  })

  revalidatePath("/dashboard/team")
  return { success: true }
}
