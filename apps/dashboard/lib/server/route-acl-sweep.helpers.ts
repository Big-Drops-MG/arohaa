import type { Permission } from "@workspace/database/schema/access-roles"
import type { RouteGuardTestOverrides } from "@/lib/server/route-guard"
import { evaluateRouteGuard } from "@/lib/server/route-guard"
import type { FixtureUser } from "@/lib/server/route-acl-fixtures"
import {
  apiRootFromModule,
  buildApiPath,
  defaultPathParams,
  isProjectScopedRoute,
  loadScannedRouteHandlers,
  type ScannedRouteHandler,
} from "@/lib/server/route-config-scan"

export const sweepHandlers = loadScannedRouteHandlers(
  apiRootFromModule(import.meta.url)
)

export function sweepRequestFor(
  handler: ScannedRouteHandler,
  query = ""
): Request {
  const params = defaultPathParams(handler.relPath)
  const url = `http://localhost${buildApiPath(handler.relPath, params)}${query}`
  return new Request(url, { method: handler.method })
}

export function sweepParamsFor(
  handler: ScannedRouteHandler,
  publicId = "lp-project-a"
) {
  return isProjectScopedRoute(handler)
    ? {
        publicId,
        userId: "user-fixture",
        id: "fixture-id",
        segmentId: "fixture-segment",
        experimentId: "fixture-experiment",
      }
    : defaultPathParams(handler.relPath)
}

export async function evaluateGuardWithDbActor(
  handler: ScannedRouteHandler,
  actor: FixtureUser,
  options?: {
    access?: RouteGuardTestOverrides["access"]
    publicId?: string
    query?: string
  }
) {
  return evaluateRouteGuard(
    handler,
    sweepRequestFor(handler, options?.query ?? ""),
    sweepParamsFor(handler, options?.publicId),
    {
      actor,
      access: options?.access,
    }
  )
}

export function findHandler(
  relPath: string,
  method: ScannedRouteHandler["method"]
): ScannedRouteHandler | undefined {
  return sweepHandlers.find(
    (handler) => handler.relPath === relPath && handler.method === method
  )
}

export const EXPECTED_MEMBER_PERMISSIONS: Permission[] = [
  "landing_pages.read",
  "landing_pages.write",
  "experiments.write",
  "webhooks.write",
]

export const EXPECTED_VIEWER_PERMISSIONS: Permission[] = ["landing_pages.read"]
