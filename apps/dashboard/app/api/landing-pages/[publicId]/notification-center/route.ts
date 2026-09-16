import { NextResponse } from "next/server"
import { route } from "@/lib/server/route"
import { loadNotificationCenterDashboard } from "@/lib/server/web-push-dashboard"
import { getNotificationCenterEmptyData } from "@/features/notification-center/controller/notification-center-empty-data"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "notification-center",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const segment = params.publicId!
    const res = await loadNotificationCenterDashboard(actor.id, segment)
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(getNotificationCenterEmptyData(segment))
      }
      return NextResponse.json({ error: res.error }, { status: res.status })
    }
    return NextResponse.json(res.data)
  }
)
