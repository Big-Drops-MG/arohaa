import { NextResponse } from "next/server"
import {
  parseDashboardCustomRange,
  parseTrafficRangeId,
} from "@/features/traffic/model/traffic-range"
import { parseUtmFilterFromSearchParams } from "@/lib/server/analytics-utm-params"
import { loadOverviewDashboardDataForApi } from "@/lib/server/overview-dashboard-load"
import { route } from "@/lib/server/route"
import { MAX_DASHBOARD_CUSTOM_SPAN_DAYS } from "@/lib/server/route-query"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "overview",
    rateLimit: "landing",
    query: { maxCustomRangeDays: MAX_DASHBOARD_CUSTOM_SPAN_DAYS },
  },
  async ({ params, request }) => {
    const { searchParams } = new URL(request.url)
    const result = await loadOverviewDashboardDataForApi(
      params.publicId!,
      parseTrafficRangeId(searchParams.get("range_id")),
      parseUtmFilterFromSearchParams(searchParams),
      parseDashboardCustomRange(
        searchParams.get("from"),
        searchParams.get("to")
      )
    )
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    return NextResponse.json(result.data)
  }
)
