import "server-only"

import { and, eq } from "drizzle-orm"
import {
  db,
  externalMemberPrivileges,
  externalMemberProjectScopes,
  type InferSelectModel,
  users,
} from "@workspace/database"
import type { ProjectTabValue } from "@/features/dashboard/model/project-tab"
import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import { normalizeDashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import {
  EXTERNAL_PRIVILEGE_TABS,
  isExternalTeamKind,
  type ExternalPrivilegeGrant,
  type ExternalProjectScope,
} from "@/features/team/model/external-privileges"
import {
  mapLegacyInsightSectionToDataLab,
  normalizeDataLabSectionId,
} from "@/features/data-lab/model/data-lab-sections"
import { requireLandingPageActor } from "@/lib/server/landing-auth"

type UserRow = InferSelectModel<typeof users>

import {
  buildAccessFromGrants,
  canAccessProject,
  canAccessSection,
  canAccessTab,
  allowedSectionsForTab,
  allowedTabsForProject,
  type ActorAccess,
  type ExternalAccessSnapshot,
} from "@/lib/server/external-access-acl"

export type { ActorAccess, ExternalAccessSnapshot }
export {
  buildAccessFromGrants,
  canAccessProject,
  canAccessSection,
  canAccessTab,
  allowedSectionsForTab,
  allowedTabsForProject,
}

function normalizePrivilegeGrant(row: {
  landingPagePublicId: string
  tab: string
  section: string | null
}): ExternalPrivilegeGrant | null {
  let tab = row.tab
  let section = row.section ?? ""

  if (tab === "insights") {
    tab = "data-lab"
    section = section ? mapLegacyInsightSectionToDataLab(section) : ""
  } else if (tab === "data-export") {
    tab = "data-lab"
    section = section || "leads"
  }

  if (tab === "data-lab" && section) {
    section = normalizeDataLabSectionId(section)
  }

  const allowedTabs = new Set(EXTERNAL_PRIVILEGE_TABS.map((t) => t.value))
  if (!allowedTabs.has(tab as ProjectTabValue)) return null

  return {
    landingPagePublicId: row.landingPagePublicId,
    tab: tab as ProjectTabValue,
    section,
  }
}

export async function loadExternalPrivileges(
  userId: string
): Promise<ExternalPrivilegeGrant[]> {
  const rows = await db
    .select({
      landingPagePublicId: externalMemberPrivileges.landingPagePublicId,
      tab: externalMemberPrivileges.tab,
      section: externalMemberPrivileges.section,
    })
    .from(externalMemberPrivileges)
    .where(eq(externalMemberPrivileges.userId, userId))

  return rows
    .map((row) => normalizePrivilegeGrant(row))
    .filter((row): row is ExternalPrivilegeGrant => row !== null)
}

export async function loadExternalProjectScopes(
  userId: string
): Promise<ExternalProjectScope[]> {
  const rows = await db
    .select({
      landingPagePublicId: externalMemberProjectScopes.landingPagePublicId,
      utmSource: externalMemberProjectScopes.utmSource,
    })
    .from(externalMemberProjectScopes)
    .where(eq(externalMemberProjectScopes.userId, userId))

  return rows
    .map((row) => ({
      landingPagePublicId: row.landingPagePublicId,
      utmSource: row.utmSource.trim(),
    }))
    .filter((row) => row.utmSource.length > 0)
}

export async function getActorAccess(
  actor: { id: string; teamKind?: string | null } | null | undefined
): Promise<ActorAccess> {
  if (!actor || !isExternalTeamKind(actor.teamKind)) {
    return { isExternal: false }
  }
  const [grants, scopes] = await Promise.all([
    loadExternalPrivileges(actor.id),
    loadExternalProjectScopes(actor.id),
  ])
  return buildAccessFromGrants(grants, scopes)
}

export async function getAccessibleProjectIds(
  actor: { id: string; teamKind?: string | null } | null | undefined
): Promise<ReadonlySet<string> | null> {
  const access = await getActorAccess(actor)
  return access.isExternal ? access.projectIds : null
}

export function getForcedUtmSources(
  access: ActorAccess,
  publicId: string
): string[] | null {
  if (!access.isExternal) return null
  const sources = access.utmSourceByProject.get(publicId)
  return sources && sources.length > 0 ? sources : null
}

export function getForcedUtmSource(
  access: ActorAccess,
  publicId: string
): string | null {
  const sources = getForcedUtmSources(access, publicId)
  return sources?.[0] ?? null
}

export function applyExternalUtmScope(
  access: ActorAccess,
  publicId: string,
  filter?: DashboardUtmFilter | null
): DashboardUtmFilter | undefined {
  if (!access.isExternal) {
    return normalizeDashboardUtmFilter(filter) ?? undefined
  }

  const forced = access.utmSourceByProject.get(publicId) ?? []
  if (forced.length === 0) {
    return { utm_source: ["__external_unscoped__"] }
  }

  return (
    normalizeDashboardUtmFilter({
      utm_source: forced,
      segment_id: filter?.segment_id,
    }) ?? { utm_source: forced }
  )
}

export async function requireWritableLandingPageActor(): Promise<UserRow | null> {
  const actor = await requireLandingPageActor()
  if (!actor || isExternalTeamKind(actor.teamKind)) return null
  return actor
}

export async function replaceExternalPrivileges(
  userId: string,
  grants: ExternalPrivilegeGrant[],
  scopes: ExternalProjectScope[] = []
): Promise<void> {
  await db
    .delete(externalMemberPrivileges)
    .where(eq(externalMemberPrivileges.userId, userId))
  await db
    .delete(externalMemberProjectScopes)
    .where(eq(externalMemberProjectScopes.userId, userId))

  if (grants.length > 0) {
    await db.insert(externalMemberPrivileges).values(
      grants.map((grant) => ({
        userId,
        landingPagePublicId: grant.landingPagePublicId,
        tab: grant.tab,
        section: grant.section || "",
      }))
    )
  }

  const cleanedScopes = scopes
    .map((scope) => ({
      landingPagePublicId: scope.landingPagePublicId.trim(),
      utmSource: scope.utmSource.trim(),
    }))
    .filter((scope) => scope.landingPagePublicId && scope.utmSource)

  if (cleanedScopes.length > 0) {
    await db.insert(externalMemberProjectScopes).values(
      cleanedScopes.map((scope) => ({
        userId,
        landingPagePublicId: scope.landingPagePublicId,
        utmSource: scope.utmSource,
      }))
    )
  }
}

export async function assertExternalTarget(
  userId: string
): Promise<UserRow | null> {
  const row = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.teamKind, "external")),
  })
  return row ?? null
}
