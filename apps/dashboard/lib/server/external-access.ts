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
import { mapLegacyInsightSectionToDataLab } from "@/features/data-lab/model/data-lab-sections"
import { isReadOnlyAccessLevel } from "@/features/team/model/access-level"
import { requireLandingPageActor } from "@/lib/server/landing-auth"

type UserRow = InferSelectModel<typeof users>

export type ExternalAccessSnapshot = {
  isExternal: true
  projectIds: Set<string>
  /** key: `${publicId}::${tab}` → set of section ids (empty set = whole tab) */
  tabSections: Map<string, Set<string>>
  /** Forced utm_source values per landing page public id */
  utmSourceByProject: Map<string, string[]>
}

export type ActorAccess = { isExternal: false } | ExternalAccessSnapshot

function tabKey(publicId: string, tab: string) {
  return `${publicId}::${tab}`
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

export function buildAccessFromGrants(
  grants: ExternalPrivilegeGrant[],
  scopes: ExternalProjectScope[] = []
): ExternalAccessSnapshot {
  const projectIds = new Set<string>()
  const tabSections = new Map<string, Set<string>>()
  const utmSourceByProject = new Map<string, string[]>()

  for (const grant of grants) {
    projectIds.add(grant.landingPagePublicId)
    const key = tabKey(grant.landingPagePublicId, grant.tab)
    let sections = tabSections.get(key)
    if (!sections) {
      sections = new Set()
      tabSections.set(key, sections)
    }
    if (grant.section) {
      sections.add(grant.section)
    }
  }

  for (const scope of scopes) {
    const source = scope.utmSource.trim()
    if (!source) continue
    const existing = utmSourceByProject.get(scope.landingPagePublicId) ?? []
    if (!existing.includes(source)) {
      existing.push(source)
      utmSourceByProject.set(scope.landingPagePublicId, existing)
    }
  }

  for (const [publicId, sources] of utmSourceByProject) {
    utmSourceByProject.set(
      publicId,
      [...sources].sort((a, b) => a.localeCompare(b))
    )
  }

  return { isExternal: true, projectIds, tabSections, utmSourceByProject }
}

export async function getActorAccess(
  actor: UserRow | null | undefined
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

export function canAccessProject(
  access: ActorAccess,
  publicId: string
): boolean {
  if (!access.isExternal) return true
  return access.projectIds.has(publicId)
}

export function canAccessTab(
  access: ActorAccess,
  publicId: string,
  tab: ProjectTabValue
): boolean {
  if (!access.isExternal) return true
  return access.tabSections.has(tabKey(publicId, tab))
}

export function allowedTabsForProject(
  access: ActorAccess,
  publicId: string
): ProjectTabValue[] | null {
  if (!access.isExternal) return null
  const tabs: ProjectTabValue[] = []
  for (const def of EXTERNAL_PRIVILEGE_TABS) {
    if (access.tabSections.has(tabKey(publicId, def.value))) {
      tabs.push(def.value)
    }
  }
  return tabs
}

export function canAccessSection(
  access: ActorAccess,
  publicId: string,
  tab: ProjectTabValue,
  sectionId: string
): boolean {
  if (!access.isExternal) return true
  const sections = access.tabSections.get(tabKey(publicId, tab))
  if (!sections) return false
  if (sections.size === 0) return true
  return sections.has(sectionId)
}

export function allowedSectionsForTab(
  access: ActorAccess,
  publicId: string,
  tab: ProjectTabValue
): string[] | null {
  if (!access.isExternal) return null
  const sections = access.tabSections.get(tabKey(publicId, tab))
  if (!sections) return []
  if (sections.size === 0) {
    const def = EXTERNAL_PRIVILEGE_TABS.find((t) => t.value === tab)
    return def?.sections.map((s) => s.id) ?? []
  }
  return [...sections]
}

export function getForcedUtmSources(
  access: ActorAccess,
  publicId: string
): string[] | null {
  if (!access.isExternal) return null
  const sources = access.utmSourceByProject.get(publicId)
  return sources && sources.length > 0 ? sources : null
}

/** @deprecated Prefer getForcedUtmSources */
export function getForcedUtmSource(
  access: ActorAccess,
  publicId: string
): string | null {
  const sources = getForcedUtmSources(access, publicId)
  return sources?.[0] ?? null
}

/** Force external collaborators onto their assigned utm_source values for a project. */
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
    // No scope configured — return a filter that matches no real traffic.
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
  if (isReadOnlyAccessLevel(actor.accessLevel)) return null
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
