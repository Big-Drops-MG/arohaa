import { NextRequest, NextResponse } from "next/server"
import { parseDashboardCustomRange } from "@/features/traffic/model/traffic-range"
import { loadEventTrackingDashboardDataForApi } from "@/lib/server/event-tracking-dashboard-load"
import { parseUtmFilterFromSearchParams } from "@/lib/server/analytics-utm-params"

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params

  const { searchParams } = new URL(request.url)
  const rangeIdRaw = searchParams.get("range_id")
  const customRange = parseDashboardCustomRange(
    searchParams.get("from"),
    searchParams.get("to")
  )
  const utmFilter = parseUtmFilterFromSearchParams(searchParams)

  const result = await loadEventTrackingDashboardDataForApi(
    publicId,
    rangeIdRaw,
    utmFilter,
    customRange
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
