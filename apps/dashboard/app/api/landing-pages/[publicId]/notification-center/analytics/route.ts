import { NextResponse } from "next/server"
import { route } from "@/lib/server/route"
import { getNotificationCenterAnalyticsEmpty } from "@/features/notification-center/controller/notification-center-analytics-empty"
import { loadNotificationCenterAnalytics } from "@/lib/server/web-push-analytics"
import {
  parseDashboardCustomRange,
  parseTrafficRangeId,
} from "@/features/traffic/model/traffic-range"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "notification-center",
    rateLimit: "landing",
  },
  async ({ actor, params, request }) => {
    const segment = params.publicId!
    const url = new URL(request.url)
    const rangeId = parseTrafficRangeId(url.searchParams.get("range_id"))
    const customRange =
      rangeId === "custom"
        ? parseDashboardCustomRange(
            url.searchParams.get("from"),
            url.searchParams.get("to")
          )
        : null
    if (rangeId === "custom" && !customRange) {
      return NextResponse.json(
        { error: "from and to are required for custom range" },
        { status: 400 }
      )
    }

    const campaignId = url.searchParams.get("campaign_id")
    const res = await loadNotificationCenterAnalytics(actor.id, segment, {
      rangeId,
      customRange,
      campaignId,
    })
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(getNotificationCenterAnalyticsEmpty(rangeId))
      }
      return NextResponse.json({ error: res.error }, { status: res.status })
    }
    return NextResponse.json(res.data)
  }
)
