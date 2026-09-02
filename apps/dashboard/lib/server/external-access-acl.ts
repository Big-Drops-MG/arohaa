import type { ProjectTabValue } from "@/features/dashboard/model/project-tab"
import { EXTERNAL_PRIVILEGE_TABS } from "@/features/team/model/external-privileges"
import type {
  ExternalPrivilegeGrant,
  ExternalProjectScope,
} from "@/features/team/model/external-privileges"

export type ExternalAccessSnapshot = {
  isExternal: true
  projectIds: Set<string>
  tabSections: Map<string, Set<string>>
  utmSourceByProject: Map<string, string[]>
}

export type ActorAccess = { isExternal: false } | ExternalAccessSnapshot

export function tabKey(publicId: string, tab: string) {
  return `${publicId}::${tab}`
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
