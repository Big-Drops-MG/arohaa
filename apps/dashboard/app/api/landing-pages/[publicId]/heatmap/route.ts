import { NextResponse } from "next/server"
import {
  parseDashboardCustomRange,
  parseTrafficRangeId,
} from "@/features/traffic/model/traffic-range"
import { loadHeatmapDashboardDataForApi } from "@/lib/server/heatmap-dashboard-load"
import { route } from "@/lib/server/route"
import { MAX_DASHBOARD_CUSTOM_SPAN_DAYS } from "@/lib/server/route-query"
import { sanitizeHeatmapPageUrl } from "@/lib/server/route-query-limits"
import { heatmapModeToAclSection } from "@/lib/server/route-section"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "heatmap",
    section: {
      queryParam: "mode",
      resolve: heatmapModeToAclSection,
    },
    rateLimit: "landing",
    query: { maxCustomRangeDays: MAX_DASHBOARD_CUSTOM_SPAN_DAYS },
  },
  async ({ params, request }) => {
    const { searchParams } = new URL(request.url)
    const result = await loadHeatmapDashboardDataForApi(
      params.publicId!,
      parseTrafficRangeId(searchParams.get("range_id")),
      {
        modeRaw: searchParams.get("mode"),
        deviceRaw: searchParams.get("device"),
        pageUrl: sanitizeHeatmapPageUrl(searchParams.get("page_url")),
        customRange: parseDashboardCustomRange(
          searchParams.get("from"),
          searchParams.get("to")
        ),
      }
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
