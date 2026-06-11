import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { loadTrafficDashboardDataForApi } from "@/lib/server/traffic-dashboard-load"
import { parseTrafficRangeId } from "@/features/traffic/model/traffic-range"
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

  const result = await loadTrafficDashboardDataForApi(publicId, rangeId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
