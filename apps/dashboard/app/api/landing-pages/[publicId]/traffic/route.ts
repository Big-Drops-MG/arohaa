import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { loadTrafficDashboardDataForApi } from "@/lib/server/traffic-dashboard-load"
import {
  parseDashboardCustomRange,
  parseTrafficRangeId,
} from "@/features/traffic/model/traffic-range"
import { parseUtmFilterFromSearchParams } from "@/lib/server/analytics-utm-params"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import { requireLandingPageActor } from "@/lib/server/landing-auth"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> }
) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const { publicId } = await context.params
  const rangeId = parseTrafficRangeId(
    request.nextUrl.searchParams.get("range_id")
  )
  const customRange = parseDashboardCustomRange(
    request.nextUrl.searchParams.get("from"),
    request.nextUrl.searchParams.get("to")
  )
  const utmFilter = parseUtmFilterFromSearchParams(request.nextUrl.searchParams)

  const result = await loadTrafficDashboardDataForApi(
    publicId,
    rangeId,
    utmFilter,
    customRange
  )
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
