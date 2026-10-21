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
      path: "/v1/warehouse/review/history",
      request,
    })
  }
)
