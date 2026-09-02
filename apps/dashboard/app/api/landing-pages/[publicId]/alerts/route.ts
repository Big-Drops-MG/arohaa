import { NextResponse } from "next/server"
import {
  parseDashboardCustomRange,
  parseTrafficRangeId,
} from "@/features/traffic/model/traffic-range"
import { parseUtmFilterFromSearchParams } from "@/lib/server/analytics-utm-params"
import { loadAlertsDashboardDataForApi } from "@/lib/server/alerts-dashboard-load"
import { route } from "@/lib/server/route"
import { MAX_DASHBOARD_CUSTOM_SPAN_DAYS } from "@/lib/server/route-query"

const rangeQuery = { maxCustomRangeDays: MAX_DASHBOARD_CUSTOM_SPAN_DAYS }

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "alerts",
    rateLimit: "landing",
    query: rangeQuery,
  },
  async ({ params, request }) => {
    const { searchParams } = new URL(request.url)
    const res = await loadAlertsDashboardDataForApi(
      params.publicId!,
      searchParams.get("range_id"),
      parseUtmFilterFromSearchParams(searchParams),
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
