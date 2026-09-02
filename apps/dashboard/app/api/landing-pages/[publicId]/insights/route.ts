import { NextResponse } from "next/server"
import { parseDashboardCustomRange } from "@/features/traffic/model/traffic-range"
import { parseUtmFilterFromSearchParams } from "@/lib/server/analytics-utm-params"
import { loadInsightsDashboardDataForApi } from "@/lib/server/insights-dashboard-load"
import { route } from "@/lib/server/route"
import { insightSectionToAclSection } from "@/lib/server/route-section"
import { MAX_DASHBOARD_CUSTOM_SPAN_DAYS } from "@/lib/server/route-query"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "data-lab",
    section: {
      queryParam: "section",
      resolve: insightSectionToAclSection,
    },
    rateLimit: "landing",
    query: { maxCustomRangeDays: MAX_DASHBOARD_CUSTOM_SPAN_DAYS },
  },
  async ({ params, request }) => {
    const { searchParams } = new URL(request.url)
    const result = await loadInsightsDashboardDataForApi(
      params.publicId!,
      searchParams.get("range_id"),
      searchParams.get("section"),
      parseUtmFilterFromSearchParams(searchParams),
      parseDashboardCustomRange(
        searchParams.get("from"),
        searchParams.get("to")
      ),
      searchParams.get("segment_id")
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
