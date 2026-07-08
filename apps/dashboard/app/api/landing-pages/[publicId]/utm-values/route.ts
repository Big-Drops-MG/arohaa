import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { isUtmFilterDimension } from "@/features/dashboard/model/utm-attribution-filter"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"

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
  const row = await getActiveLandingPageForActor(actor.id, publicId)
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) {
    return NextResponse.json([])
  }

  const url = new URL(`${apiBase}/v1/analytics/utm-values`)
  url.searchParams.set("workspace_id", row.id)
  url.searchParams.set("dim", dim)

  const resp = await fetch(url.toString(), {
    headers: { "x-arohaa-internal": secret },
    cache: "no-store",
  })

  if (!resp.ok) {
    return NextResponse.json([])
  }

  const values = (await resp.json()) as string[]
  return NextResponse.json(values)
}
