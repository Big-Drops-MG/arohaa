import { eq, sql } from "drizzle-orm"
import { headers } from "next/headers"
import {
  db,
  rolePermissions,
  SUPERADMIN_ROLE_KEY,
  userActivityLogs,
  users,
  type Permission,
} from "@workspace/database"
import {
  actorCan,
  getRoleById,
  getRoleByKey,
  isSuperadmin,
  listRolePermissions,
  type Actor,
  type DbQueryClient,
} from "@/lib/server/actor-can"
import {
  clientIpFromNextHeaders,
  userAgentFromHeaders,
} from "@/lib/server/request-client-meta"
import { writeUserActivityLog } from "@/lib/server/user-activity-log"

export async function updateRolePermissions(
  actor: Actor,
  roleId: string,
  perms: Permission[]
): Promise<{ error?: string; success?: true }> {
  if (!(await actorCan(actor, "manage_permissions"))) {
    return { error: "Forbidden" }
  }

  const role = await getRoleById(roleId)
  if (!role) return { error: "Role not found." }
  if (role.key === SUPERADMIN_ROLE_KEY) {
    return { error: "Superadmin permissions are fixed" }
  }
  if (perms.includes("manage_permissions")) {
    return { error: "Not grantable" }
  }

  const beforePayload = await listRolePermissions(roleId)
  const uniquePerms = [...new Set(perms)]

  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
    if (uniquePerms.length > 0) {
      await tx.insert(rolePermissions).values(
        uniquePerms.map((permission) => ({
          roleId,
          permission,
        }))
      )
    }
  })

  const headerStore = await headers()
  await writeUserActivityLog({
    actorUserId: actor.id,
    eventType: "action",
    summary: `Updated permissions for ${role.label}`,
    path: "/dashboard/team",
    targetLabel: role.key,
    ipAddress: await clientIpFromNextHeaders(),
    userAgent: userAgentFromHeaders(headerStore),
    metadata: {
      roleId,
      roleKey: role.key,
      beforePayload,
      afterPayload: uniquePerms,
    },
  })

  return { success: true }
}

export async function assignRole(
  actor: Actor,
  userId: string,
  roleKey: string
): Promise<{ error?: string; success?: true }> {
  if (!(await actorCan(actor, "team.assign_roles"))) {
    return { error: "Forbidden" }
  }

  const trimmedKey = roleKey.trim()
  if (!trimmedKey) return { error: "Invalid role." }
  if (userId === actor.id) {
    return { error: "Cannot change your own role" }
  }

  const callerIsSuperadmin = await isSuperadmin(actor)
  if (trimmedKey === SUPERADMIN_ROLE_KEY && !callerIsSuperadmin) {
    return { error: "Only a superadmin can grant superadmin" }
  }

  const targetRole = await getRoleByKey(trimmedKey)
  if (!targetRole) return { error: "Role not found." }

  const headerStore = await headers()
  const ipAddress = await clientIpFromNextHeaders()
  const userAgent = userAgentFromHeaders(headerStore)

  type AssignRoleTxResult =
    | { error: string }
    | { success: true; skipped: true }
    | { success: true; skipped: false }

  const txResult = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('superadmin_membership'))`
    )

    const [target] = await tx
      .select({ roleId: users.roleId, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .for("update")

    if (!target) {
      return { error: "User not found." } satisfies AssignRoleTxResult
    }

    const previous = target.roleId
      ? await getRoleById(target.roleId, tx as DbQueryClient)
      : null

    if (previous?.key === SUPERADMIN_ROLE_KEY && !callerIsSuperadmin) {
      return {
        error: "Only a superadmin can change a superadmin's role",
      } satisfies AssignRoleTxResult
    }

    if (previous?.id === targetRole.id) {
      return { success: true, skipped: true } satisfies AssignRoleTxResult
    }

    await tx
      .update(users)
      .set({ roleId: targetRole.id })
      .where(eq(users.id, userId))

    await tx.insert(userActivityLogs).values({
      id: crypto.randomUUID(),
      actorUserId: actor.id,
      eventType: "action",
      summary: `Assigned ${targetRole.label} to ${target.email ?? userId}`,
      path: "/dashboard/team",
      targetLabel: target.email ?? userId,
      ipAddress,
      userAgent,
      metadata: {
        targetUserId: userId,
        beforeRoleKey: previous?.key ?? null,
        afterRoleKey: targetRole.key,
      },
    })

    return { success: true, skipped: false } satisfies AssignRoleTxResult
  })

  if ("error" in txResult) {
    return { error: txResult.error }
  }

  return { success: true }
}

export async function listEditableAccessRoles() {
  return db.query.accessRoles.findMany({
    where: (r, { ne }) => ne(r.key, SUPERADMIN_ROLE_KEY),
    orderBy: (r, { asc }) => [asc(r.label)],
  })
}
