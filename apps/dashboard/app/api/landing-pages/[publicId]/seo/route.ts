import { NextResponse } from "next/server"
import { parseDashboardCustomRange } from "@/features/traffic/model/traffic-range"
import { parseUtmFilterFromSearchParams } from "@/lib/server/analytics-utm-params"
import {
  loadSeoDashboardDataForApi,
  syncSeoFromGscForApi,
  syncSeoRowsForApi,
} from "@/lib/server/seo-dashboard-load"
import { route } from "@/lib/server/route"
import { seoPostBodySchema } from "@/lib/server/route-schemas"
import { MAX_DASHBOARD_CUSTOM_SPAN_DAYS } from "@/lib/server/route-query"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "seo",
    rateLimit: "landing",
    query: { maxCustomRangeDays: MAX_DASHBOARD_CUSTOM_SPAN_DAYS },
  },
  async ({ params, request }) => {
    const { searchParams } = new URL(request.url)
    const rangeId = searchParams.get("range_id")
    const customRange = parseDashboardCustomRange(
      searchParams.get("from"),
      searchParams.get("to")
    )
    const sortBy = searchParams.get("sort_by")
    const sortOrder = searchParams.get("sort_order")

    const res = await loadSeoDashboardDataForApi(
      params.publicId!,
      rangeId,
      sortBy,
      sortOrder,
      customRange,
      parseUtmFilterFromSearchParams(searchParams)
    )

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }

    return NextResponse.json(res.data)
  }
)

export const POST = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "seo",
    rateLimit: "landing",
    schema: seoPostBodySchema,
  },
  async ({ params, body }) => {
    if (body.action === "gsc_sync") {
      const res = await syncSeoFromGscForApi(params.publicId!)
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: res.status })
      }
      return NextResponse.json({ inserted: res.inserted })
    }

    const res = await syncSeoRowsForApi(
      params.publicId!,
      (body.rows ?? []).map((row, index) => ({
        id: row.id ?? `import:${index}`,
        query: row.query,
        pageUrl: row.pageUrl,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        reportDate: row.reportDate,
      }))
    )
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status })
    }

    return NextResponse.json({ inserted: res.inserted })
  }
)
