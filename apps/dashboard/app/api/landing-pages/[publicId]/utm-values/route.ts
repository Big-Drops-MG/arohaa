import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { isUtmFilterDimension } from "@/features/dashboard/model/utm-attribution-filter"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { loadUtmDashboardDataForApi } from "@/lib/server/utm-dashboard-load"

/**
 * Returns UTM Source / S1 values from the same discovery + Postgres store
 * used by UTM Control (not a separate ClickHouse dim query).
 */
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

  const dim = request.nextUrl.searchParams.get("dim")
  if (!isUtmFilterDimension(dim)) {
    return NextResponse.json({ error: "Invalid dim" }, { status: 400 })
  }

  const { publicId } = await context.params
  const res = await loadUtmDashboardDataForApi(publicId)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status })
  }

  const values = [
    ...new Set(
      res.data.items
        .filter((item) => item.key === dim)
        .map((item) => item.value)
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

  return NextResponse.json(values)
}
