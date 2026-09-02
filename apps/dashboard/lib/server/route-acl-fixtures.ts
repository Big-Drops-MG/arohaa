import type { Permission } from "@workspace/database/schema/access-roles"
import type { ProjectTabValue } from "@/features/dashboard/model/project-tab"
import type { ActorAccess } from "@/lib/server/external-access-acl"

export type FixtureUser = {
  id: string
  roleId: string
  teamKind: "internal" | "external"
  accessLevel: "full" | "read_only"
  accessStatus: "approved"
}

export const PROJECT_A = "lp-project-a"
export const PROJECT_B = "lp-project-b"
export const FIXTURE_USER_ID = "user-fixture"

export const MEMBER_PERMISSIONS = new Set<Permission>([
  "landing_pages.read",
  "landing_pages.write",
  "experiments.write",
  "webhooks.write",
])

export const CEO_PERMISSIONS = new Set<Permission>([
  ...MEMBER_PERMISSIONS,
  "data_export.read",
  "team.review_access",
  "team.assign_roles",
  "audit_logs.read",
  "team.manage_external",
  "api_keys.write",
])

function tabKey(publicId: string, tab: string) {
  return `${publicId}::${tab}`
}

export type ExternalAccessSnapshot = Extract<ActorAccess, { isExternal: true }>

export function partnerOverviewAccess(): ExternalAccessSnapshot {
  return {
    isExternal: true,
    projectIds: new Set([PROJECT_A]),
    tabSections: new Map([[tabKey(PROJECT_A, "overview"), new Set<string>()]]),
    utmSourceByProject: new Map(),
  }
}

export function internalActor(
  id: string,
  roleId: string,
  accessLevel: "full" | "read_only" = "full"
): FixtureUser {
  return {
    id,
    roleId,
    teamKind: "internal",
    accessLevel,
    accessStatus: "approved",
  }
}

export function externalPartnerActor(roleId: string): FixtureUser {
  return {
    id: "user-external-partner",
    roleId,
    teamKind: "external",
    accessLevel: "full",
    accessStatus: "approved",
  }
}

export function pathParamsForProject(publicId: string) {
  return {
    publicId,
    userId: FIXTURE_USER_ID,
    id: "fixture-id",
    segmentId: "fixture-segment",
    experimentId: "fixture-experiment",
  }
}

export function partnerDeniedTabForRoute(tab: string): ProjectTabValue | null {
  if (tab === "workspace" || tab === "collection") return null
  if (tab === "overview") return null
  return tab as ProjectTabValue
}

export function partnerDeniedOverviewSection(): string {
  return "funnel"
}
