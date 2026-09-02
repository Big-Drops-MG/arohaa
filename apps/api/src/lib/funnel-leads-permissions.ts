import { and, eq } from 'drizzle-orm'
import {
  accessRoles,
  db,
  externalMemberPrivileges,
  landingPages,
  rolePermissions,
  SUPERADMIN_ROLE_KEY,
  users,
  type Permission,
} from '@workspace/database'

function isApprovedAccess(status: string | null | undefined): boolean {
  return status === 'approved'
}

async function hasRolePermission(
  roleId: string,
  perm: Permission,
): Promise<boolean> {
  const row = await db.query.rolePermissions.findFirst({
    where: and(
      eq(rolePermissions.roleId, roleId),
      eq(rolePermissions.permission, perm),
    ),
    columns: { permission: true },
  })
  return Boolean(row)
}

async function actorCan(
  actor: { roleId: string | null },
  perm: Permission,
): Promise<boolean> {
  if (!actor.roleId) return false
  const role = await db.query.accessRoles.findFirst({
    where: eq(accessRoles.id, actor.roleId),
  })
  if (!role) return false
  if (role.key === SUPERADMIN_ROLE_KEY) return true
  return hasRolePermission(role.id, perm)
}

function mapLegacyInsightSectionToDataLab(section: string): string {
  switch (section) {
    case 'volume':
      return 'glance'
    case 'source':
      return 'sources'
    case 'dropoff':
      return 'journey'
    case 'quality':
    case 'vehicle':
    case 'risk':
      return 'quality'
    case 'experiment':
      return 'tests'
    default:
      return 'intelligence'
  }
}

function externalCanAccessDataLabLeadsFromGrant(row: {
  landingPagePublicId: string
  tab: string
  section: string | null
  targetPublicId: string
}): boolean {
  let tab = row.tab
  let section = row.section ?? ''

  if (tab === 'insights') {
    tab = 'data-lab'
    section = section ? mapLegacyInsightSectionToDataLab(section) : ''
  } else if (tab === 'data-export') {
    tab = 'data-lab'
    section = section || 'leads'
  }

  if (row.landingPagePublicId !== row.targetPublicId) return false
  if (tab !== 'data-lab') return false
  if (!section) return true
  return section === 'leads'
}

async function externalCanAccessDataLabLeads(
  userId: string,
  landingPagePublicId: string,
): Promise<boolean> {
  const rows = await db
    .select({
      landingPagePublicId: externalMemberPrivileges.landingPagePublicId,
      tab: externalMemberPrivileges.tab,
      section: externalMemberPrivileges.section,
    })
    .from(externalMemberPrivileges)
    .where(eq(externalMemberPrivileges.userId, userId))

  return rows.some((row) =>
    externalCanAccessDataLabLeadsFromGrant({
      ...row,
      targetPublicId: landingPagePublicId,
    }),
  )
}

export async function userCanExportLeadsForLandingPage(params: {
  userId: string
  landingPageId: string
}): Promise<boolean> {
  const landingPage = await db.query.landingPages.findFirst({
    where: eq(landingPages.id, params.landingPageId),
    columns: { id: true, publicId: true },
  })
  if (!landingPage) return false

  const user = await db.query.users.findFirst({
    where: eq(users.id, params.userId),
    columns: {
      id: true,
      roleId: true,
      accessStatus: true,
      teamKind: true,
    },
  })
  if (!user || !isApprovedAccess(user.accessStatus)) return false

  if (!(await actorCan(user, 'data_export.read'))) return false

  if (user.teamKind === 'external') {
    return externalCanAccessDataLabLeads(user.id, landingPage.publicId)
  }

  return true
}
