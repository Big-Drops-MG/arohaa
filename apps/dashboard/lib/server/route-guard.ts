import type { Permission } from "@workspace/database/schema/access-roles"
import type { ProjectTabValue } from "@/features/dashboard/model/project-tab"
import {
  canAccessSection,
  canAccessTab,
  type ActorAccess,
} from "@/lib/server/external-access-acl"
import {
  resolveRouteSectionId,
  type RouteSectionConfig,
} from "@/lib/server/route-section"
import {
  enforceRouteQueryLimits,
  type RouteQueryLimits,
} from "@/lib/server/route-query"
import type { RateLimitBucket, RouteTab } from "@/lib/server/route"

export type RouteGuardActor = {
  id: string
  roleId: string
  teamKind?: string | null
  accessLevel?: string | null
}

export type RouteGuardConfig = {
  permission: Permission
  actor: "read" | "write"
  tab: RouteTab
  section?: RouteSectionConfig
  rateLimit: RateLimitBucket
  query?: RouteQueryLimits
}

export type RouteGuardResult =
  | { ok: true; actor: RouteGuardActor }
  | { ok: false; status: 401 | 403 | 429 | 400 }

export type RouteGuardTestOverrides = {
  actor?: RouteGuardActor | null
  permissions?: Set<Permission> | "superadmin"
  access?: ActorAccess
  rateLimited?: boolean
}

function unauthorized(): RouteGuardResult {
  return { ok: false, status: 401 }
}

function forbidden(): RouteGuardResult {
  return { ok: false, status: 403 }
}

function enforceTabAccess(
  tab: RouteTab,
  params: Record<string, string>,
  access: ActorAccess
): RouteGuardResult | null {
  if (tab === "collection") return null

  if (access.isExternal) {
    if (tab === "workspace") return forbidden()

    const publicId = params.publicId
    if (!publicId) return forbidden()
    if (!canAccessTab(access, publicId, tab as ProjectTabValue)) {
      return forbidden()
    }
  }

  return null
}

function enforceSectionAccess(
  tab: RouteTab,
  params: Record<string, string>,
  request: Request,
  sectionCfg: RouteSectionConfig | undefined,
  access: ActorAccess
): RouteGuardResult | null {
  if (tab === "workspace" || tab === "collection" || !sectionCfg) return null
  if (!access.isExternal) return null

  const publicId = params.publicId
  if (!publicId) return forbidden()

  const sectionId = resolveRouteSectionId(sectionCfg, request)
  if (!sectionId) return forbidden()

  if (!canAccessSection(access, publicId, tab as ProjectTabValue, sectionId)) {
    return forbidden()
  }

  return null
}

export async function evaluateRouteGuard(
  cfg: RouteGuardConfig,
  request: Request,
  params: Record<string, string>,
  overrides?: RouteGuardTestOverrides
): Promise<RouteGuardResult> {
  let actor: RouteGuardActor | null

  if (overrides && "actor" in overrides) {
    actor = overrides.actor ?? null
  } else {
    const [{ requireLandingPageActor }, { requireWritableLandingPageActor }] =
      await Promise.all([
        import("@/lib/server/landing-auth"),
        import("@/lib/server/external-access"),
      ])
    actor =
      cfg.actor === "write"
        ? await requireWritableLandingPageActor()
        : await requireLandingPageActor()
  }

  if (!actor) return unauthorized()

  const actorRef = { id: actor.id, roleId: actor.roleId }

  if (overrides?.permissions) {
    if (
      overrides.permissions !== "superadmin" &&
      !overrides.permissions.has(cfg.permission)
    ) {
      return forbidden()
    }
  } else {
    const { actorCan } = await import("@/lib/server/actor-can")
    if (!(await actorCan(actorRef, cfg.permission))) {
      return forbidden()
    }
  }

  if (overrides?.rateLimited) {
    return { ok: false, status: 429 }
  }

  if (!overrides) {
    const { enforceLandingApiRateLimit } =
      await import("@/lib/server/rate-limit-landing")
    const limited = await enforceLandingApiRateLimit(actor.id)
    if (limited) return { ok: false, status: 429 }
  }

  const queryBlocked = enforceRouteQueryLimits(request, cfg.query)
  if (queryBlocked) {
    return { ok: false, status: 400 }
  }

  let access: ActorAccess
  if (overrides?.access) {
    access = overrides.access
  } else if (
    overrides &&
    "actor" in overrides &&
    actor &&
    actor.teamKind !== "external"
  ) {
    access = { isExternal: false }
  } else {
    const { getActorAccess } = await import("@/lib/server/external-access")
    access = await getActorAccess(actor)
  }

  const tabBlocked = enforceTabAccess(cfg.tab, params, access)
  if (tabBlocked) return tabBlocked

  const sectionBlocked = enforceSectionAccess(
    cfg.tab,
    params,
    request,
    cfg.section,
    access
  )
  if (sectionBlocked) return sectionBlocked

  return { ok: true, actor }
}
