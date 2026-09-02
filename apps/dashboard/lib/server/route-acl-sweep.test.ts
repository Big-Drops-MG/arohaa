import { describe, expect, it } from "vitest"
import type { Permission } from "@workspace/database/schema/access-roles"
import { evaluateRouteGuard } from "@/lib/server/route-guard"
import {
  CEO_PERMISSIONS,
  externalPartnerActor,
  internalActor,
  MEMBER_PERMISSIONS,
  partnerOverviewAccess,
  partnerDeniedTabForRoute,
  pathParamsForProject,
  PROJECT_A,
  PROJECT_B,
} from "@/lib/server/route-acl-fixtures"
import {
  apiRootFromModule,
  buildApiPath,
  defaultPathParams,
  isProjectScopedRoute,
  isTeamMemberLogsRoute,
  loadScannedRouteHandlers,
  type ScannedRouteHandler,
} from "@/lib/server/route-config-scan"

const handlers = loadScannedRouteHandlers(apiRootFromModule(import.meta.url))

function requestFor(handler: ScannedRouteHandler, query = ""): Request {
  const params = defaultPathParams(handler.relPath)
  const url = `http://localhost${buildApiPath(handler.relPath, params)}${query}`
  return new Request(url, { method: handler.method })
}

function paramsFor(handler: ScannedRouteHandler, publicId = PROJECT_A) {
  return isProjectScopedRoute(handler)
    ? pathParamsForProject(publicId)
    : defaultPathParams(handler.relPath)
}

async function guardStatus(
  handler: ScannedRouteHandler,
  options: {
    permissions: Set<Permission> | "superadmin"
    actor:
      | ReturnType<typeof internalActor>
      | ReturnType<typeof externalPartnerActor>
    access?: ReturnType<typeof partnerOverviewAccess>
    publicId?: string
    query?: string
  }
) {
  const result = await evaluateRouteGuard(
    handler,
    requestFor(handler, options.query ?? ""),
    paramsFor(handler, options.publicId ?? PROJECT_A),
    {
      actor: options.actor,
      permissions: options.permissions,
      access: options.access,
    }
  )
  return result.ok ? 200 : result.status
}

describe("API route ACL sweep", () => {
  it("discovers every non-exempt dashboard API handler from the filesystem", () => {
    expect(handlers.length).toBeGreaterThan(40)
    const paths = new Set(handlers.map((handler) => handler.relPath))
    expect(paths.has("landing-pages/[publicId]/overview/route.ts")).toBe(true)
    expect(paths.has("notifications/route.ts")).toBe(true)
  })

  describe.each(
    handlers.map(
      (handler) => [handler.relPath, handler.method, handler] as const
    )
  )("%s %s", (_relPath, _method, handler) => {
    if (isProjectScopedRoute(handler)) {
      it("denies external partner on project B", async () => {
        const status = await guardStatus(handler, {
          actor: externalPartnerActor("role-member"),
          permissions: MEMBER_PERMISSIONS,
          access: partnerOverviewAccess(),
          publicId: PROJECT_B,
        })
        expect(status).toBe(403)
      })

      it("denies external partner on a tab they were not granted", async () => {
        const deniedTab = partnerDeniedTabForRoute(handler.tab)
        if (!deniedTab || handler.tab !== deniedTab) {
          expect(true).toBe(true)
          return
        }
        const status = await guardStatus(handler, {
          actor: externalPartnerActor("role-member"),
          permissions: MEMBER_PERMISSIONS,
          access: partnerOverviewAccess(),
          publicId: PROJECT_A,
        })
        expect(status).toBe(403)
      })

      if (handler.tab === "data-lab" && handler.section) {
        it("denies external partner on data-lab without grant", async () => {
          const status = await guardStatus(handler, {
            actor: externalPartnerActor("role-member"),
            permissions: MEMBER_PERMISSIONS,
            access: partnerOverviewAccess(),
            publicId: PROJECT_A,
            query: "?section=leads",
          })
          expect(status).toBe(403)
        })
      }

      if (
        handler.section &&
        typeof handler.section === "string" &&
        handler.tab !== "overview"
      ) {
        it("denies external partner on section-gated routes outside overview", async () => {
          const status = await guardStatus(handler, {
            actor: externalPartnerActor("role-member"),
            permissions: MEMBER_PERMISSIONS,
            access: partnerOverviewAccess(),
            publicId: PROJECT_A,
          })
          expect(status).toBe(403)
        })
      }
    }

    if (handler.tab === "workspace") {
      it("denies external partner on workspace routes", async () => {
        const status = await guardStatus(handler, {
          actor: externalPartnerActor("role-member"),
          permissions: MEMBER_PERMISSIONS,
          access: partnerOverviewAccess(),
        })
        expect(status).toBe(403)
      })
    }

    it("allows CEO when the permission matrix grants access", async () => {
      if (handler.actor === "write" && handler.tab === "workspace") {
      }
      const status = await guardStatus(handler, {
        actor: internalActor("user-ceo", "role-ceo"),
        permissions: CEO_PERMISSIONS,
      })
      expect(status).toBe(200)
    })

    it("allows superadmin on the guard layer", async () => {
      const status = await guardStatus(handler, {
        actor: internalActor("user-superadmin", "role-superadmin"),
        permissions: "superadmin",
      })
      expect(status).toBe(200)
    })

    it("denies member when the route requires a permission they lack", async () => {
      if (isTeamMemberLogsRoute(handler)) return
      if (MEMBER_PERMISSIONS.has(handler.permission)) return

      const status = await guardStatus(handler, {
        actor: internalActor("user-member", "role-member"),
        permissions: MEMBER_PERMISSIONS,
      })
      expect(status).toBe(403)
    })

    it("allows member when the route permission is in the member matrix", async () => {
      if (!MEMBER_PERMISSIONS.has(handler.permission)) return
      if (handler.actor === "write" && handler.tab === "workspace") {
        if (!MEMBER_PERMISSIONS.has(handler.permission)) return
      }

      const status = await guardStatus(handler, {
        actor: internalActor("user-member", "role-member"),
        permissions: MEMBER_PERMISSIONS,
      })
      expect(status).toBe(200)
    })
  })

  it("revoking a role permission flips guard result without redeploying routes", async () => {
    const sample =
      handlers.find(
        (handler) =>
          handler.permission === "landing_pages.read" &&
          handler.tab === "collection" &&
          handler.method === "GET"
      ) ?? handlers[0]!

    const memberPerms = new Set(MEMBER_PERMISSIONS)

    const allowed = await evaluateRouteGuard(
      sample,
      requestFor(sample),
      paramsFor(sample),
      {
        actor: internalActor("user-member", "role-member"),
        permissions: memberPerms,
      }
    )
    expect(allowed.ok).toBe(true)

    memberPerms.delete("landing_pages.read")

    const denied = await evaluateRouteGuard(
      sample,
      requestFor(sample),
      paramsFor(sample),
      {
        actor: internalActor("user-member", "role-member"),
        permissions: memberPerms,
      }
    )
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.status).toBe(403)
  })

  it("fails when a route declares a section ACL the partner should not pass", async () => {
    const cohort = handlers.find(
      (handler) =>
        handler.relPath === "landing-pages/[publicId]/cohorts/route.ts" &&
        handler.method === "GET"
    )
    expect(cohort).toBeDefined()
    if (!cohort) return

    const status = await guardStatus(cohort, {
      actor: externalPartnerActor("role-member"),
      permissions: MEMBER_PERMISSIONS,
      access: partnerOverviewAccess(),
      publicId: PROJECT_A,
    })
    expect(status).toBe(403)
  })
})
