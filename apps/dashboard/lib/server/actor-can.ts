import { and, eq, inArray } from "drizzle-orm"
import {
  accessRoles,
  db,
  permissionEnum,
  rolePermissions,
  SUPERADMIN_ROLE_KEY,
  VIEWER_ROLE_KEY,
  MEMBER_ROLE_KEY,
  type Permission,
} from "@workspace/database"
import { isApprovedAccess } from "@/lib/server/access-status"
import { isExternalTeamKind } from "@/features/team/model/external-privileges"

export type Actor = {
  id: string
  roleId: string | null
}

export type DbQueryClient = Pick<typeof db, "query">

export async function getRoleById(roleId: string, client: DbQueryClient = db) {
  return client.query.accessRoles.findFirst({
    where: eq(accessRoles.id, roleId),
  })
}

export async function getRoleByKey(key: string) {
  return db.query.accessRoles.findFirst({
    where: eq(accessRoles.key, key),
  })
}

export async function getMemberRoleId(): Promise<string> {
  const role = await getRoleByKey(MEMBER_ROLE_KEY)
  if (!role) {
    throw new Error("Member role is not configured.")
  }
  return role.id
}

export async function getViewerRoleId(): Promise<string> {
  const role = await getRoleByKey(VIEWER_ROLE_KEY)
  if (!role) {
    throw new Error("Viewer role is not configured.")
  }
  return role.id
}

export async function canWriteLandingPages(actor: Actor): Promise<boolean> {
  return actorCan(actor, "landing_pages.write")
}

export async function hasRolePermission(
  roleId: string,
  perm: Permission
): Promise<boolean> {
  const row = await db.query.rolePermissions.findFirst({
    where: and(
      eq(rolePermissions.roleId, roleId),
      eq(rolePermissions.permission, perm)
    ),
    columns: { permission: true },
  })
  return Boolean(row)
}

export async function actorCan(
  actor: Actor,
  perm: Permission
): Promise<boolean> {
  if (!actor.roleId) return false
  const role = await getRoleById(actor.roleId)
  if (!role) return false
  if (role.key === SUPERADMIN_ROLE_KEY) return true
  return hasRolePermission(role.id, perm)
}

export async function isSuperadmin(actor: Actor): Promise<boolean> {
  if (!actor.roleId) return false
  const role = await getRoleById(actor.roleId)
  return role?.key === SUPERADMIN_ROLE_KEY
}

export async function canManageExternalTeam(
  actor: Actor & {
    accessStatus: string | null
    teamKind: string | null
  }
): Promise<boolean> {
  if (!isApprovedAccess(actor.accessStatus)) return false
  if (isExternalTeamKind(actor.teamKind)) return false
  return actorCan(actor, "team.manage_external")
}

export async function listUserIdsWithPermission(
  perm: Permission
): Promise<string[]> {
  const superadminRole = await getRoleByKey(SUPERADMIN_ROLE_KEY)
  const grantedRoleIds = await db
    .select({ roleId: rolePermissions.roleId })
    .from(rolePermissions)
    .where(eq(rolePermissions.permission, perm))

  const roleIds = new Set(grantedRoleIds.map((row) => row.roleId))
  if (superadminRole) {
    roleIds.add(superadminRole.id)
  }

  if (roleIds.size === 0) return []

  const { users } = await import("@workspace/database")
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.roleId, [...roleIds]))

  return rows.map((row) => row.id)
}

export async function listRolePermissions(
  roleId: string
): Promise<Permission[]> {
  const role = await getRoleById(roleId)
  if (!role) return []
  if (role.key === SUPERADMIN_ROLE_KEY) {
    return [...permissionEnum.enumValues]
  }
  const rows = await db.query.rolePermissions.findMany({
    where: eq(rolePermissions.roleId, roleId),
    columns: { permission: true },
  })
  return rows.map((row) => row.permission)
}
