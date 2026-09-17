import { NextResponse } from "next/server"
import { route } from "@/lib/server/route"
import { flushWebPushStats } from "@/lib/server/web-push-dashboard"

export const POST = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "notification-center",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const res = await flushWebPushStats(actor.id, params.publicId!)
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }
    return NextResponse.json({
      deletedSubscriptions: res.deletedSubscriptions,
      deletedDeliveries: res.deletedDeliveries,
    })
  }
)
