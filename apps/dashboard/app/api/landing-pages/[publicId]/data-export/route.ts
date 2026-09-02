import { NextResponse } from "next/server"
import { parseDashboardCustomRange } from "@/features/traffic/model/traffic-range"
import { loadDataExportDashboardDataForApi } from "@/lib/server/data-export-dashboard-load"
import { route } from "@/lib/server/route"
import {
  DEFAULT_ROUTE_MAX_OFFSET,
  MAX_DASHBOARD_CUSTOM_SPAN_DAYS,
  parseRouteOffset,
} from "@/lib/server/route-query"

export const GET = route(
  {
    permission: "data_export.read",
    actor: "read",
    tab: "data-lab",
    section: "leads",
    rateLimit: "landing",
    query: {
      maxCustomRangeDays: MAX_DASHBOARD_CUSTOM_SPAN_DAYS,
      maxOffset: DEFAULT_ROUTE_MAX_OFFSET,
    },
  },
  async ({ params, request }) => {
    const { searchParams } = new URL(request.url)
    const res = await loadDataExportDashboardDataForApi(
      params.publicId!,
      searchParams.get("range_id"),
      parseDashboardCustomRange(
        searchParams.get("from"),
        searchParams.get("to")
      ),
      searchParams.get("limit"),
      String(parseRouteOffset(searchParams.get("offset")))
    )

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }

    return NextResponse.json(res.data)
  }
)
