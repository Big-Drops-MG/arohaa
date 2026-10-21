import { route } from "@/lib/server/route"
import {
  assertWarehouseReviewer,
  proxyWarehouseApi,
} from "@/lib/server/warehouse-proxy"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "collection",
    rateLimit: "landing",
  },
  async ({ actor, request }) => {
    const denied = await assertWarehouseReviewer(actor)
    if (denied) return denied
    return proxyWarehouseApi({
      path: "/v1/warehouse/review",
      request,
    })
  }
)

export const PATCH = route(
  {
    permission: "landing_pages.read",
    actor: "write",
    tab: "collection",
    rateLimit: "landing",
  },
  async ({ actor, request }) => {
    const denied = await assertWarehouseReviewer(actor)
    if (denied) return denied
    const incoming = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const actorLabel = actor.email?.trim() || actor.id || "warehouse-reviewer"
    return proxyWarehouseApi({
      path: "/v1/warehouse/review",
      request,
      method: "PATCH",
      bodyText: JSON.stringify({
        ...incoming,
        decisionBy: actorLabel,
        callOutcomeBy: actorLabel,
      }),
    })
  }
)
