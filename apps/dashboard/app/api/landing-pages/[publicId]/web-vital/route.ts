import { NextResponse } from "next/server"
import { parseDashboardCustomRange } from "@/features/traffic/model/traffic-range"
import { loadWebVitalDashboardDataForApi } from "@/lib/server/web-vital-dashboard-load"
import { route } from "@/lib/server/route"
import { MAX_DASHBOARD_CUSTOM_SPAN_DAYS } from "@/lib/server/route-query"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "web-vital",
    rateLimit: "landing",
    query: { maxCustomRangeDays: MAX_DASHBOARD_CUSTOM_SPAN_DAYS },
  },
  async ({ params, request }) => {
    const { searchParams } = new URL(request.url)
    const res = await loadWebVitalDashboardDataForApi(
      params.publicId!,
      searchParams.get("range_id"),
      parseDashboardCustomRange(
        searchParams.get("from"),
        searchParams.get("to")
      )
    )

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }

    return NextResponse.json(res.data)
  }
)
